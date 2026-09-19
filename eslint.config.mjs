// The root config lints prisma/seed.ts and nothing else. The two apps carry their own,
// and `pnpm lint` runs all three: the seed sits outside every workspace package, so
// `pnpm -r lint` would never read it.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['apps', 'packages', 'node_modules'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
);
