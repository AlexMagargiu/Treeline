import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

import { ServiceWorker } from '@/components/service-worker';
import { themeBootScript } from '@/components/theme';

import './globals.css';

/*
 * next/font/google downloads and self hosts both faces at build time, so no request ever
 * leaves for fonts.googleapis.com. The latin-ext subset is not optional: it carries
 * U+0218 to U+021B, which is where ș and ț live, and a route named Prapastiile
 * Zarnestiului has to be spelled the way the signpost spells it.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Treeline',
  description: 'A private catalogue of hikes in the Romanian Carpathians.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Treeline' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The phone address bar takes the light theme's ground. The manifest carries the same
  // value, so an installed window and a browser tab agree.
  themeColor: '#f6f8fa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme attribute is written by the boot script below before the first paint, so
    // the server markup and the first client render differ by design.
    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-[100dvh] antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
