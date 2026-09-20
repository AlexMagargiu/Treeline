/*
 * The offline shell, and nothing more.
 *
 * This worker caches the offline page and the icons and never caches an API response.
 * Offline data is phase 9 of docs/spec.md; until then a cached route would be a statement
 * about a mountain that may since have been corrected, read by somebody standing on it.
 *
 * Because nothing that can go stale is held, navigations are always network first and a
 * new deploy takes effect the moment it lands. skipWaiting and claim mean a changed
 * worker replaces the old one without every tab being closed first.
 */

const CACHE = 'treeline-shell-v1';
const OFFLINE = '/offline';
const SHELL = [OFFLINE, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only page loads. Build output carries its own immutable cache headers, and the API is
  // never touched here.
  if (request.mode !== 'navigate') return;
  if (new URL(request.url).pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE).then((cached) => cached ?? Response.error())),
  );
});
