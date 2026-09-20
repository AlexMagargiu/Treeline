'use client';

import * as React from 'react';

/**
 * Registers the offline shell worker.
 *
 * `update()` on every mount, together with the worker's own skipWaiting and claim, is
 * what makes a new deploy take effect without the user clearing anything: the browser
 * re-fetches sw.js, and a changed file installs and activates immediately instead of
 * waiting for every tab to close.
 */
export function ServiceWorker() {
  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.update())
      .catch(() => {
        // An unregistered worker costs the offline page and nothing else, so a failure
        // here is not worth showing to the user.
      });
  }, []);

  return null;
}
