import { createClient } from '@supabase/supabase-js';

// Public project URL and anon key. Safe in the browser: every table is protected by row-level security.
export const SUPABASE_URL = 'https://eqifcrpkwyzvgdbwzydg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWZjcnBrd3l6dmdkYnd6eWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mzc0NzIsImV4cCI6MjEwOTIxMzQ3Mn0.33XDUD5REAXNrKhto-lywI3W8ddfiRFl0dG0rIvzULk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const membershipNo = (n) => (n ? `SPK-M-${String(n).padStart(4, '0')}` : '');

export const uploadAvatar = (userId, file) => uploadMedia(userId, file, 'avatar');

// Phone photos are often 3–8 MB. Shrink them before upload (longest side ≤ max, WebP/JPEG ~80%):
// faster for students on weak connections and ~20x less bandwidth for everyone viewing them.
async function shrinkImage(file, max) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 250 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const type = canvas.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((res) => canvas.toBlob(res, type, 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, type === 'image/webp' ? '.webp' : '.jpg'), { type });
  } catch { return file; }
}

const MAX_SIDE = { avatar: 800, work: 1400, story: 1600, course: 1600, cert: 2400 };

export async function uploadMedia(userId, original, prefix = 'file') {
  const file = await shrinkImage(original, MAX_SIDE[prefix] || 1600);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `u/${userId}/${prefix}-${Date.now()}.${ext}`;
  // file names never change, so browsers and the CDN may keep them for a year
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export function friendlyError(e) {
  const m = e?.message || '';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'ما في اتصال بالإنترنت. جرّب كمان شوي.';
  if (/provider is not enabled|Unsupported provider/i.test(m)) return 'تسجيل الدخول بـ Google لسا مش مفعّل بقاعدة البيانات.';
  if (/row-level security|permission denied/i.test(m)) return 'ما عندك صلاحية لهالعملية.';
  if (/Unexpected token|not valid JSON|504|timed? ?out/i.test(m)) return 'السيرفر ما ردّ بالوقت. جرّب كمان مرة.';
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return 'الصورة أكبر من الحجم المسموح (50 ميغا).';
  if (m) console.warn('[spark]', m);
  return 'صار خطأ غير متوقع. جرّب كمان شوي.';
}
