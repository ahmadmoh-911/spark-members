import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { installPressEffects } from './ui.jsx';

installPressEffects();
createRoot(document.getElementById('root')).render(
  <AuthProvider><App /></AuthProvider>
);
