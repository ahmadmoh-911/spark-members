// Sends uncaught errors to the admins' error list (client_errors), deduped and throttled.
import { Component, createElement } from 'react';
import { supabase } from './supabase.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const seen = new Map();

// noise we can't act on: extensions, aborted fetches, flaky networks
const IGNORE = /ResizeObserver loop|Script error\.?$|AbortError|The user aborted|Failed to fetch|NetworkError|Load failed|chrome-extension:|moz-extension:/i;

export function report(err, where) {
  try {
    const message = String((err && (err.message || err.reason?.message)) || err || 'unknown').slice(0, 500);
    if (IGNORE.test(message)) return;
    const now = Date.now();
    if (now - (seen.get(message) || 0) < 60_000) return; // same error at most once a minute per device
    seen.set(message, now);
    const stack = (err && (err.stack || err.reason?.stack)) || '';
    supabase.rpc('log_client_error', {
      p_message: where ? `${where}: ${message}` : message,
      p_stack: String(stack).slice(0, 3000),
      p_url: location.hash || location.pathname,
      p_ua: navigator.userAgent,
      p_version: VERSION,
    }).then(() => {}, () => {});
  } catch { /* never let reporting break the app */ }
}

export function installMonitor() {
  addEventListener('error', (e) => report(e.error || e.message));
  addEventListener('unhandledrejection', (e) => report(e.reason));
}

// catches render crashes and shows a friendly screen instead of a blank page
export class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) {
    report(err, 'render');
    // a stale chunk after a deploy: one quiet reload fixes it
    if (/Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(err?.message)) && !sessionStorage.getItem('chunk-reload')) {
      try { sessionStorage.setItem('chunk-reload', '1'); } catch { /* private mode */ }
      location.reload();
    }
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return createElement('div', { className: 'crash glass', role: 'alert' },
      createElement('b', null, 'صار خطأ صغير 😅'),
      createElement('p', null, 'وصلنا تقرير عنه وبنصلّحه. جرّب ترجع للصفحة الرئيسية.'),
      createElement('button', { className: 'btn press', onClick: () => { location.hash = '#/students'; location.reload(); } }, 'رجوع للرئيسية'));
  }
}
