import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // The workspace root, so file tracing follows the pnpm symlinks out of apps/web.
  // pnpm runs this script from apps/web, so the root is two levels up.
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),

  async headers() {
    return [
      {
        /*
         * The map's glyphs and sprites, cached the way the tiles are. Next serves
         * everything in public/ with `max-age=0` by default, so without this the browser
         * revalidates every glyph range on every load, and on a bad signal that is the
         * difference between a map with labels and a map waiting for them. These files
         * change only when somebody replaces them by hand, which is the same argument
         * Caddy uses for /tiles/*, and the same trap: a replacement needs a new name or a
         * hard reload. See public/basemap/README.md.
         */
        source: '/basemap/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default config;
