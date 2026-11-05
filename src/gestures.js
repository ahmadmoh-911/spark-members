// Native-app gestures, kept light: passive listeners, no React re-renders while the finger moves.
import { go, parse, TABS } from './lib/router.js';

const blocked = (t) => !!t.closest('input,textarea,select,.overlay,.sheet-wrap,.chips,.strip,.react2,.sbar,[data-noswipe]');
const overlayOpen = () => !!document.querySelector('.overlay,.sheet-wrap');

// Pull down at the top of a page → the four Spark dots bounce → page reloads its data.
export function installPullToRefresh(onRefresh) {
  const el = document.createElement('div');
  el.className = 'ptr';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i><i></i><i></i><i></i>';
  document.body.appendChild(el);
  let y0 = null, x0 = 0, dy = 0, busy = false, raf = 0;
  const paint = () => { raf = 0; const d = Math.min(dy, 110); el.style.transform = `translate(-50%, ${d - 60}px)`; el.style.opacity = String(Math.min(1, d / 70)); el.classList.toggle('ready', d >= 75); };
  document.addEventListener('touchstart', (e) => {
    if (busy || e.touches.length !== 1 || window.scrollY > 2 || overlayOpen() || blocked(e.target)) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    const ny = e.touches[0].clientY - y0, nx = Math.abs(e.touches[0].clientX - x0);
    if (ny < 0 || nx > ny) { if (dy) { dy = 0; paint(); } return; }
    dy = ny * 0.55;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (y0 == null) return;
    y0 = null;
    if (dy >= 75) {
      busy = true; el.classList.add('spin'); el.style.transform = 'translate(-50%, 18px)';
      onRefresh();
      setTimeout(() => { busy = false; el.classList.remove('spin', 'ready'); el.style.opacity = '0'; el.style.transform = 'translate(-50%, -60px)'; }, 900);
    } else { el.style.opacity = '0'; el.style.transform = 'translate(-50%, -60px)'; }
    dy = 0;
  }, { passive: true });
}

// Swipe sideways between the three tabs; from the screen's start edge, swipe to go back.
export function installSwipeNav() {
  let x0 = null, y0 = 0, t0 = 0, edge = false;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || overlayOpen() || blocked(e.target)) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    edge = x0 > window.innerWidth - 28; // RTL: the page "starts" on the right
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    const fast = Date.now() - t0 < 600;
    x0 = null;
    if (!fast || Math.abs(dx) < 80 || Math.abs(dy) > 50) return;
    const r = parse();
    if (r.depth === 0) {
      const i = TABS.indexOf(r.tab);
      // RTL: tabs run right→left, so a leftward swipe moves to the next tab
      const n = dx < 0 ? i + 1 : i - 1;
      if (n >= 0 && n < TABS.length) go(TABS[n]);
    } else if (edge && dx < 0) {
      history.length > 1 ? history.back() : go(r.tab || 'students');
    }
  }, { passive: true });
}

// Run a callback with the page's scroll position, once per frame at most (no React state).
export function onScrollFrame(fn) {
  let raf = 0;
  const h = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; fn(window.scrollY); }); };
  window.addEventListener('scroll', h, { passive: true });
  fn(window.scrollY);
  return () => { window.removeEventListener('scroll', h); cancelAnimationFrame(raf); };
}
