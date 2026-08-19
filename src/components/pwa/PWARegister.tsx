'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    __PWA_INSTALL_PROMPT__?: any;
  }
}

export default function PWARegister() {
  useEffect(() => {
    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[📱 PWA] Service Worker registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('[📱 PWA] Service Worker registration failed:', err);
          });
      });
    }

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__PWA_INSTALL_PROMPT__ = e;
      window.dispatchEvent(new Event('pwa-prompt-available'));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return null;
}
