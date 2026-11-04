import { useEffect, useRef } from 'react';

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
export function Photo({ url, id, className = '', style }) {
  return (
    <span className={`ph ${className}`} style={{ '--g': gradFor(id), ...style }}>
      {url ? <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
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
