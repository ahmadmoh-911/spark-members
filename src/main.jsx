import { registerSW } from 'virtual:pwa-register';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { installPressEffects } from './ui.jsx';

installPressEffects();

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
  <AuthProvider><App /></AuthProvider>
);
