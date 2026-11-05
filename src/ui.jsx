import { useEffect, useRef, useState } from 'react';
import { supabase as _sb } from './lib/supabase.js';

const BASE = import.meta.env.BASE_URL;
export const LOGO_DARK = `${BASE}brand/logo-dark.png`;
export const LOGO_WHITE = `${BASE}brand/logo-white.png`;

export function Logo({ h = 38 }) {
  return (
    <>
      <img className="logo-img" src={LOGO_DARK} alt="سبارك للابتكار والإبداع" height={h} />
      <img className="logo-img w" src={LOGO_WHITE} alt="" height={h} />
    </>
  );
}

// Spark's four colours drifting at random under the glass
export function Light() {
  const host = useRef(null);
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cols = ['var(--b1)', 'var(--b2)', 'var(--b3)', 'var(--b4)', 'var(--b1)', 'var(--b3)'];
    const timers = [];
    const blobs = cols.map((c) => {
      const i = document.createElement('i');
      const s = 28 + Math.random() * 22;
      i.style.width = i.style.height = `${s}vmax`;
      i.style.background = `radial-gradient(circle, ${c}, transparent 68%)`;
      host.current.appendChild(i);
      return i;
    });
    const move = (i, first) => {
      const t = 7 + Math.random() * 6;
      i.style.setProperty('--t', first ? '0s' : `${t}s`);
      i.style.transform = `translate(${Math.random() * 100 - 20}vw, ${Math.random() * 100 - 20}vh) scale(${0.75 + Math.random() * 0.6})`;
      if (!reduce) timers.push(setTimeout(() => move(i), first ? 50 : t * 1000));
    };
    blobs.forEach((b) => move(b, true));
    return () => { timers.forEach(clearTimeout); blobs.forEach((b) => b.remove()); };
  }, []);
  return <div className="light" aria-hidden="true" ref={host} />;
}

// press-down + ripple from the touch point, spring back on release
export function installPressEffects() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.press');
    if (!el || reduce) return;
    // a tiny tap of feedback on the main action buttons (Android only; iOS ignores vibrate)
    if (el.matches('.cta,.save,.pbtn.primary') && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* ignore */ } }
    // cards tilt toward the finger
    if (el.classList.contains('tilt')) {
      const b = el.getBoundingClientRect();
      el.style.setProperty('--ry', `${((e.clientX - b.left) / b.width - 0.5) * 10}deg`);
      el.style.setProperty('--rx', `${-((e.clientY - b.top) / b.height - 0.5) * 10}deg`);
    }
    el.classList.add('down');
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2.2;
    const rp = document.createElement('span');
    rp.className = 'ripple';
    rp.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.appendChild(rp);
    setTimeout(() => rp.remove(), 650);
  });
  const release = () => document.querySelectorAll('.press.down').forEach((el) => el.classList.remove('down'));
  ['pointerup', 'pointercancel', 'pointerleave', 'dragstart'].forEach((t) => document.addEventListener(t, release));
}

// photo, or a soft brand-coloured placeholder until one is uploaded
const GRADS = ['linear-gradient(140deg,#FFB067,#F47B20)', 'linear-gradient(140deg,#6FA8EE,#134F96)', 'linear-gradient(140deg,#A6E08F,#4BB454)', 'linear-gradient(140deg,#FFE58A,#FFCD05)'];
export const gradFor = (id = '') => GRADS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];
export function Photo({ url, id, className = '', style, ...rest }) {
  return (
    <span className={`ph ${className}`} style={{ '--g': gradFor(id), ...style }} {...rest}>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <circle cx="50" cy="40" r="17" fill="#fff" opacity=".32" />
            <path d="M14 100c3-26 17-38 36-38s33 12 36 38z" fill="#fff" opacity=".32" />
          </svg>
        )}
    </span>
  );
}

export const Tick = () => (
  <svg className="tick" role="img" aria-label="موثّق: مسجّل بدورتين أو أكثر" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill="#2D7BD8" />
    <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TIER = { silver: 'فضي', gold: 'ذهبي', diamond: 'ماسي' };
const GLOW = { silver: 'rgba(160,170,185,.8)', gold: 'rgba(240,180,30,.85)', diamond: 'rgba(61,143,232,.85)' };
const EMB = {
  silver: (
    <svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F4F6F9" /><stop offset="1" stopColor="#9AA4B2" /></linearGradient></defs><path d="M16 4h16l-4 12h-8z" fill="#2D7BD8" /><circle cx="24" cy="29" r="14" fill="url(#gs)" stroke="#7D8796" strokeWidth="2" /><path d="M24 21l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#FFFFFF" /></svg>
  ),
  gold: (
    <svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE9A6" /><stop offset="1" stopColor="#E3A20F" /></linearGradient></defs><path d="M16 4h16l-4 12h-8z" fill="#F47B20" /><circle cx="24" cy="29" r="14" fill="url(#gg)" stroke="#B57E06" strokeWidth="2" /><path d="M17 33l2-9 5 4 5-4 2 9z" fill="#FFFFFF" /></svg>
  ),
  diamond: (
    <svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E3F7FF" /><stop offset="1" stopColor="#3D8FE8" /></linearGradient></defs><path d="M13 8h22l9 11-20 25L4 19z" fill="url(#gd)" stroke="#1C5FB0" strokeWidth="2" strokeLinejoin="round" /><path d="M4 19h40M13 8l11 36M35 8L24 44M17 19l7-11 7 11" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" opacity=".8" /></svg>
  ),
};
export function TierRow({ tier }) {
  return (
    <span className="tiers" role="img" aria-label={tier ? `التصنيف: ${TIER[tier]}` : 'بدون تصنيف'}>
      {['silver', 'gold', 'diamond'].map((k) => (
        <span key={k} className={`emb ${k === tier ? 'on' : ''}`} style={{ '--glow': GLOW[k] }} aria-hidden="true">{EMB[k]}{TIER[k]}</span>
      ))}
    </span>
  );
}

export const Spinner = () => <div className="spin" role="status" aria-label="جارٍ التحميل"><i /></div>;

// ---- loading skeletons (shimmering shapes of what's coming) ----
export function SkCards({ n = 6 }) {
  return <div className="cards" aria-busy="true" aria-label="جارٍ التحميل">{Array.from({ length: n }, (_, i) => <div key={i} className="sk sk-card" />)}</div>;
}
export function SkCourses({ n = 3 }) {
  return <div className="courses" aria-busy="true" aria-label="جارٍ التحميل">{Array.from({ length: n }, (_, i) => <div key={i} className="sk sk-course" />)}</div>;
}
export function SkLines({ n = 3 }) {
  return <div className="sk-lines" aria-busy="true" aria-label="جارٍ التحميل">{Array.from({ length: n }, (_, i) => <div key={i} className="sk sk-line" style={{ width: `${90 - i * 18}%` }} />)}</div>;
}

// ---- friendly empty states ----
const ART = {
  people: <><circle cx="40" cy="34" r="12" fill="var(--blue)" opacity=".18" /><circle cx="70" cy="40" r="9" fill="var(--orange)" opacity=".22" /><path d="M18 74c3-14 12-21 22-21s19 7 22 21z" fill="var(--blue)" opacity=".18" /><path d="M56 74c2-10 8-15 14-15s12 5 14 15z" fill="var(--orange)" opacity=".22" /></>,
  stories: <><circle cx="50" cy="44" r="24" fill="none" stroke="var(--orange)" strokeWidth="4" strokeDasharray="8 6" opacity=".5" /><circle cx="50" cy="44" r="14" fill="var(--yellow)" opacity=".35" /></>,
  courses: <><path d="M14 38l36-16 36 16-36 16z" fill="var(--blue)" opacity=".2" /><path d="M28 46v14c0 6 10 11 22 11s22-5 22-11V46" fill="none" stroke="var(--green)" strokeWidth="4" opacity=".45" /></>,
  certs: <><rect x="18" y="20" width="64" height="46" rx="6" fill="var(--yellow)" opacity=".25" /><circle cx="50" cy="56" r="10" fill="var(--orange)" opacity=".35" /><path d="M44 64l-4 14 10-5 10 5-4-14" fill="var(--orange)" opacity=".35" /></>,
  inbox: <><rect x="16" y="26" width="68" height="44" rx="10" fill="var(--green)" opacity=".2" /><path d="M16 50h20l6 8h16l6-8h20" fill="none" stroke="var(--green)" strokeWidth="4" opacity=".5" /></>,
};
export function Empty({ art = 'people', title, text, children }) {
  return (
    <div className="emptyx">
      <svg viewBox="0 0 100 90" aria-hidden="true"><g className="float">{ART[art]}</g>
        <circle cx="84" cy="18" r="3" fill="var(--yellow)" /><circle cx="16" cy="22" r="2.5" fill="var(--green)" /><circle cx="88" cy="70" r="2" fill="var(--blue)" />
      </svg>
      {title && <b>{title}</b>}
      {text && <span>{text}</span>}
      {children}
    </div>
  );
}

// ---- numbers that count up when they appear ----
export function CountUp({ to = 0, ms = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf; const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    // rAF doesn't run in background tabs: make sure the real number always lands
    const done = setTimeout(() => setV(to), ms + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [to, ms]);
  return <>{v}</>;
}

// ---- confetti in Spark colours (loaded only when needed) ----
export async function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { default: confetti } = await import('canvas-confetti');
  const colors = ['#4BB454', '#134F96', '#F47B20', '#FFCD05'];
  confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin: { y: 0.7 }, colors, zIndex: 9999, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 60, spread: 110, origin: { y: 0.6 }, colors, zIndex: 9999, disableForReducedMotion: true }), 250);
}

// ---- photo tone: the main colour of a member's photo, for a soft matching glow ----
// Only our own storage (it allows cross-origin reads, and the <img> uses the same CORS mode, so
// the browser reuses the downloaded file — no second download).
export const isOurs = (u = '') => u.includes('.supabase.co/storage/');
const tones = new Map();
export function usePhotoTone(url) {
  const [tone, setTone] = useState(() => tones.get(url) || null);
  useEffect(() => {
    if (!url || !isOurs(url)) return;
    if (tones.has(url)) { setTone(tones.get(url)); return; }
    let dead = false;
    const run = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 8;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(img, 0, 0, 8, 8);
          const d = x.getImageData(0, 0, 8, 8).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
            const w = 1 + (mx - mn) / 40; // favour colourful pixels over greys
            r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w;
          }
          const t = `${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`;
          tones.set(url, t);
          if (!dead) setTone(t);
        } catch { /* tainted or unsupported: no glow */ }
      };
      img.src = url;
    };
    const id = (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(run);
    return () => { dead = true; (window.cancelIdleCallback || clearTimeout)(id); };
  }, [url]);
  return tone;
}

// ---- who has a story right now (shared, refreshed at most once a minute) ----
let liveCache = { t: 0, p: null };
export function useLiveAuthors() {
  const [set, setSet] = useState(null);
  useEffect(() => {
    if (!liveCache.p || Date.now() - liveCache.t > 60000) {
      liveCache = { t: Date.now(), p: _sb.from('stories').select('author_id').gte('created_at', new Date(Date.now() - 864e5).toISOString()).then(({ data }) => new Set((data || []).map((x) => x.author_id))) };
    }
    let alive = true;
    liveCache.p.then((s) => alive && setSet(s));
    return () => { alive = false; };
  }, []);
  return set || new Set();
}

// course → one of the four Spark colours (stable)
export const courseColor = (id) => ['var(--green)', 'var(--blue)', 'var(--orange)', 'var(--yellow)'][Math.abs(Number(id) || 0) % 4];
