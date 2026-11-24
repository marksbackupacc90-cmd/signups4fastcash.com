import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { RewardsDashboard } from './components/RewardsDashboard.tsx';
import './index.css';

const isDashboardPreview = window.location.pathname.replace(/\/+$/, '') === '/dashboard-preview';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDashboardPreview ? <RewardsDashboard /> : <App />}
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.error('Could not register the offline app worker.');
    });
  });
}
