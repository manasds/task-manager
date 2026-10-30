'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Dev chunks keep the same URL across edits, so a caching worker would serve stale code.
    // Remove any worker and caches left from an earlier visit instead.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      void caches.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });

      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline cache is optional.
    });
  }, []);

  return null;
}
