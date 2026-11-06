// Re-encodes a phone video in the browser before upload: ≤720p, ~1.5 Mbps, ≤30 s,
// plus a still frame used as the poster (and as the archive image once the video expires).
// A 25 MB phone clip typically comes out around 3–5 MB. Runs in real time, so a 20 s clip takes ~20 s.
export const MAX_SECONDS = 30;
const MAX_SHORT = 720, MAX_LONG = 1280; // 720p

const pickType = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
    if (MediaRecorder.isTypeSupported(t)) return t;
  return null;
};

const loadVideo = (file) => new Promise((res, rej) => {
  const v = document.createElement('video');
  v.preload = 'auto'; v.playsInline = true; v.muted = true; v.crossOrigin = 'anonymous';
  v.src = URL.createObjectURL(file);
  v.onloadedmetadata = () => res(v);
  v.onerror = () => rej(new Error('video-load'));
});

const seek = (v, t) => new Promise((res) => { v.onseeked = () => res(); v.currentTime = t; });

export async function videoInfo(file) {
  const v = await loadVideo(file);
  const info = { duration: v.duration || 0, width: v.videoWidth, height: v.videoHeight };
  URL.revokeObjectURL(v.src);
  return info;
}

async function poster(v, w, h) {
  await seek(v, Math.min(0.6, (v.duration || 1) / 3));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(v, 0, 0, w, h);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  return blob ? new File([blob], 'poster.jpg', { type: 'image/jpeg' }) : null;
}

// onProgress(0..1). Returns { file, poster }. Falls back to the original file if the browser can't re-encode.
export async function compressVideo(file, onProgress = () => {}) {
  const v = await loadVideo(file);
  const vw = v.videoWidth || MAX_SHORT, vh = v.videoHeight || MAX_LONG;
  const scale = Math.min(1, MAX_SHORT / Math.min(vw, vh), MAX_LONG / Math.max(vw, vh));
  const w = Math.round((v.videoWidth * scale) / 2) * 2 || 720, h = Math.round((v.videoHeight * scale) / 2) * 2 || 1280;
  const still = await poster(v, w, h).catch(() => null);
  const length = Math.min(v.duration || MAX_SECONDS, MAX_SECONDS);
  const type = pickType();
  const small = file.size < 6 * 1024 * 1024 && scale === 1 && (v.duration || 0) <= MAX_SECONDS;
  if (!type || small) { URL.revokeObjectURL(v.src); onProgress(1); return { file, poster: still }; }

  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  // route the sound into the recording without playing it out loud
  let actx;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(v);
    const dest = actx.createMediaStreamDestination();
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    v.muted = false;
  } catch { /* no audio track: fine */ }

  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 96_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = res));

  await seek(v, 0);
  rec.start(1000);
  await v.play();
  await new Promise((resolve) => {
    const draw = () => {
      ctx.drawImage(v, 0, 0, w, h);
      onProgress(Math.min(0.99, v.currentTime / length));
      if (v.currentTime >= length || v.ended) return resolve();
      v.requestVideoFrameCallback ? v.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
    };
    draw();
    v.onended = resolve;
  });
  v.pause();
  rec.stop();
  await done;
  actx?.close?.();
  URL.revokeObjectURL(v.src);
  const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
  const out = new File(chunks, `story.${ext}`, { type: type.split(';')[0] });
  onProgress(1);
  // if re-encoding didn't help (rare), keep the smaller one
  return { file: out.size && out.size < file.size ? out : file, poster: still };
}
