// Stories written without internet wait here (IndexedDB) and go out by themselves once the connection is back.
import { supabase, uploadMedia } from './supabase.js';
import { compressVideo } from './video.js';

const DB = 'spark-outbox', STORE = 'stories';
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
};

// one story: compress (video), upload media + still, insert the row
export async function postStory(userId, { course_id, kind, body, file }, onProgress) {
  let upload = file, thumb_url = null;
  if (kind === 'video') {
    onProgress?.(0);
    const out = await compressVideo(file, onProgress).catch(() => ({ file, poster: null }));
    onProgress?.(null);
    if (out.file.size > 25 * 1024 * 1024) throw new Error('Payload too large');
    upload = out.file;
    if (out.poster) thumb_url = await uploadMedia(userId, out.poster, 'story').catch(() => null);
  }
  const media_url = kind === 'text' ? null : await uploadMedia(userId, upload, 'story');
  const row = { author_id: userId, course_id, kind, body: body || null, media_url, ...(thumb_url ? { thumb_url } : null) };
  const { error } = await supabase.from('stories').insert(row);
  if (error) throw error;
}

export const queueStory = (item) => tx('readwrite', (s) => s.add({ ...item, queued_at: Date.now() }));
export const pendingCount = () => tx('readonly', (s) => s.count()).catch(() => 0);

let flushing = false;
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    const items = await tx('readonly', (s) => s.getAll());
    for (const it of items || []) {
      try {
        await postStory(it.user_id, it);
        await tx('readwrite', (s) => s.delete(it.id));
        sent++;
      } catch (e) {
        // permanent problems (no permission, course closed) shouldn't block the queue forever
        if (/row-level security|permission|violates/i.test(e?.message || '')) await tx('readwrite', (s) => s.delete(it.id));
        else break;
      }
    }
  } catch { /* IndexedDB unavailable */ } finally { flushing = false; }
  if (sent) dispatchEvent(new CustomEvent('outbox-sent', { detail: sent }));
  return sent;
}

export function installOutbox() {
  addEventListener('online', () => flushOutbox());
  setTimeout(flushOutbox, 3000);
}
