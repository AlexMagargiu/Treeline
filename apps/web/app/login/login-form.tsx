'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeNextPath } from '@/lib/next-path';

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/** The wait a 429 asks for, as plain minutes. Nobody converts 900 seconds in their head. */
function waitMessage(retryAfter: string | null): string {
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Too many login attempts. Try again later.';
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const unit = minutes === 1 ? 'minute' : 'minutes';
  return `Too many login attempts. Try again in ${minutes} ${unit}.`;
}

export function LoginForm({ next }: { next: string | undefined }) {
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  // This page is used at 05:40 with cold hands and a screen the user can barely see, so
  // the error is not left to be noticed. Focus moves to it the moment it appears.
  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      });
    } catch {
      setError('No connection. Check the network and try again.');
      setPending(false);
      return;
    }

    if (response.ok) {
      // A full navigation, not a client route change, so the middleware runs against the
      // cookie the API has just set.
      window.location.assign(safeNextPath(next));
      return;
    }

    if (response.status === 429) {
      setError(waitMessage(response.headers.get('Retry-After')));
      setPending(false);
      return;
    }

    // The API sends one message for every refusal and never says whether the password
    // exists. It is shown as it arrives, with nothing added.
    const body: ErrorBody = await response.json().catch(() => ({}));
    setError(body.error?.message ?? 'Login failed.');
    setPending(false);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : 'login-error'}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in' : 'Log in'}
      </Button>

      <div aria-live="polite">
        {error !== null && (
          <p
            id="login-error"
            ref={errorRef}
            tabIndex={-1}
            className="rounded-md border border-destructive px-3 py-2 text-base text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
