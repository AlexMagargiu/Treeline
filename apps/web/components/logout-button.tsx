'use client';

import * as React from 'react';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * One control, one label. "Log out" is the only wording this action ever uses.
 *
 * It goes to /login with a full navigation rather than a client route change, so the
 * middleware runs against the cleared cookie and there is no chance of a guarded page
 * rendering from a cache after the session is gone. The API clears the cookie whether or
 * not the session was still live, so a failure here still ends at the gate.
 */
export function LogoutButton() {
  const [pending, setPending] = React.useState(false);

  async function logOut() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Offline, or the API is down. The gate is still the right place to land.
    }
    window.location.assign('/login');
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={logOut}
      className="justify-start"
    >
      <LogOut aria-hidden="true" strokeWidth={1.75} />
      {pending ? 'Logging out' : 'Log out'}
    </Button>
  );
}
