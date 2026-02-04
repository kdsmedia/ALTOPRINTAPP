
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App'; 

/**
 * Registrasi Service Worker untuk Progressive Web App (PWA)
 * Menggunakan jalur relatif './sw.js' untuk menghindari error origin mismatch di lingkungan sandbox.
 */
if ('serviceWorker' in navigator) {
  // Hanya registrasi jika bukan di dalam iframe yang membatasi origin
  const isSandboxed = window.origin === 'null' || window.location.hostname.includes('usercontent.goog');
  
  window.addEventListener('load', () => {
    // Di lingkungan AI Studio, SW sering dibatasi. Kita gunakan try-catch agar tidak mengganggu rendering utama.
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => {
        console.log('HERNIPRINT SW registered:', reg.scope);
      })
      .catch(err => {
        // Log sebagai debug saja agar tidak muncul sebagai error merah besar jika memang diblokir platform
        console.debug('Service Worker skip/failed (expected in some sandboxes):', err.message);
      });
  });
}

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Critical Error: Failed to find root element.");
}
