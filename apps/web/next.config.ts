import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // The workspace root, so file tracing follows the pnpm symlinks out of apps/web.
  // pnpm runs this script from apps/web, so the root is two levels up.
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
};

export default config;
