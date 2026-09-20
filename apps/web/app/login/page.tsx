import type { Metadata } from 'next';

import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log in to Treeline',
};

/*
 * The one page a stranger can reach. It does one thing: take a password.
 *
 * No image, no logo lockup, no marketing line. Settled on 2026-09-19 and recorded in
 * section 7 of docs/design.md: there is no photograph here that is the user's own, and a
 * stock mountain on a login screen is a gesture this product has no reason to make.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Treeline</h1>
      <p className="mt-2 text-base text-muted-foreground">
        One password covers the whole site.
      </p>
      <LoginForm next={Array.isArray(next) ? next[0] : next} />
    </main>
  );
}
