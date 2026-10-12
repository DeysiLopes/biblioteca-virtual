import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles/global.css';

// Registro automático do Service Worker gerado pelo VitePWA
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Nova versão no ar: ativa o SW novo e recarrega, limpando caches antigos
        updateSW(true);
      },
      onOfflineReady() {
        console.log('App pronto para funcionar offline.');
      },
    });
  }).catch(() => {
    // ignora falha em dev
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
