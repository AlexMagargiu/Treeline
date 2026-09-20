'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiGet } from '@/lib/api';

/**
 * One read from the API, with the three states a screen has to draw.
 *
 * There is no data library in this app and this is not one. It fetches, it aborts on
 * unmount, and it can be asked again. A 401 never reaches here: `apiGet` sends the browser
 * back to the gate before it throws.
 */
export type Resource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; kind: 'offline' | 'server'; message: string };

export function useResource<T>(path: string | null): {
  state: Resource<T>;
  reload: () => void;
} {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    if (path === null) return;

    const controller = new AbortController();
    setState({ status: 'loading' });

    apiGet<T>(path, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.kind !== 'unauthorized') {
          setState({ status: 'failed', kind: cause.kind, message: cause.message });
        }
        // An unauthorized read is already on its way to /login, so it leaves the screen
        // as it is rather than flashing an error the reader cannot act on.
      });

    return () => controller.abort();
  }, [path, attempt]);

  return { state, reload };
}
