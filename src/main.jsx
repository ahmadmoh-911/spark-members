import { registerSW } from 'virtual:pwa-register';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { installPressEffects } from './ui.jsx';
import { ErrorBoundary, installMonitor } from './lib/monitor.js';
import { installOutbox } from './lib/outbox.js';

installMonitor();
installOutbox();

installPressEffects();

// installed app (home-screen / APK): behave like a native app — no pinch or double-tap zoom
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  || document.referrer.startsWith('android-app://');
if (standalone) {
  document.documentElement.classList.add('app');
  document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  ['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
}

// pick up new deploys quickly: check on open, when the app comes back to the foreground, and hourly
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  },
});
createRoot(document.getElementById('root')).render(
  <ErrorBoundary><AuthProvider><App /></AuthProvider></ErrorBoundary>
);
