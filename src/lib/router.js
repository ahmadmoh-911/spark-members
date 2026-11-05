import { useEffect, useRef, useState } from 'react';

// Hash routes work on any static host (GitHub Pages) and keep ?code= free for sign-in.
export const TABS = ['students', 'stories', 'courses'];

export function parse(hash = location.hash) {
  const h = hash.replace(/^#\/?/, '');
  if (TABS.includes(h)) return { tab: h, page: h, depth: 0 };
  if (h === 'login') return { tab: null, page: 'login', depth: 1 };
  if (h === 'help') return { tab: null, page: 'help', depth: 1 };
  if (h === 'panel') return { tab: null, page: 'panel', depth: 1 };
  if (h === 'me') return { tab: null, page: 'me', depth: 1 };
  let m;
  if ((m = h.match(/^member\/([0-9a-f-]{36})$/))) return { tab: 'students', page: 'member', id: m[1], depth: 1 };
  if ((m = h.match(/^course\/(\d+)$/))) return { tab: 'courses', page: 'course', id: m[1], depth: 1 };
  return { tab: 'students', page: 'students', depth: 0 };
}

export const go = (path) => { location.hash = '#/' + path; };

// What we already know about a member when their card is tapped, so the profile header can
// render instantly (and be the landing spot of the photo's flight).
export const peek = new Map();
let morphing = false;
export const isMorphing = () => morphing;

// Shared-element navigation: the tapped photo flies into its place on the next page.
export function goMorph(path, el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce || !el) return go(path);
  el.style.viewTransitionName = 'morph';
  morphing = true;
  const t = document.startViewTransition(() => new Promise((res) => {
    el.style.viewTransitionName = '';
    go(path);
    const t0 = performance.now();
    const wait = () => (document.querySelector('[data-morph]') || performance.now() - t0 > 400 ? res() : requestAnimationFrame(wait));
    requestAnimationFrame(wait);
  }));
  t.finished.finally(() => { morphing = false; document.querySelectorAll('[data-morph]').forEach((n) => { n.style.viewTransitionName = ''; n.removeAttribute('data-morph'); }); });
}

// returns the route plus the transition to play: forward, back, or a tab switch
export function useRoute() {
  const [route, setRoute] = useState(() => ({ ...parse(), anim: 'tab-anim' }));
  const depth = useRef(route.depth);
  useEffect(() => {
    const on = () => {
      const r = parse();
      const anim = morphing ? 'no-anim' : r.depth > depth.current ? 'fwd-anim' : r.depth < depth.current ? 'back-anim' : 'tab-anim';
      depth.current = r.depth;
      setRoute({ ...r, anim, key: Date.now() });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
