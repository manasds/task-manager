import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA service worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('PWA Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.log('PWA Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
