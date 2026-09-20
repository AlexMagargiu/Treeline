import type { MetadataRoute } from 'next';

/**
 * Served at /manifest.webmanifest. The colours are the light theme's ground and accent:
 * a manifest carries one pair, and the installed window picks up the real theme from the
 * page as soon as it paints.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Treeline',
    short_name: 'Treeline',
    description: 'A private catalogue of hikes in the Romanian Carpathians.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f8fa',
    theme_color: '#2a5f87',
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
