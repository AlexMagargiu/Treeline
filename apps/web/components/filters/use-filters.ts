'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { type FilterState, parseFilters, toQueryString } from '@/lib/filters';

/**
 * The filter set, read from the URL and written back to it.
 *
 * docs/spec.md puts filter state in the URL so that a set is a link, which means the URL
 * is the state and not a copy of it. Nothing here holds a second version in React state:
 * a chip reads whether it is on from the query string, and turning it on writes the query
 * string. There is therefore nothing that can fall out of step with the address bar, and a
 * pasted link needs no special path to restore.
 *
 * `history.pushState` rather than `router.push`, for a change that only touches the query
 * string. The App Router treats router.push at the same path as a navigation and fetches
 * the page's payload again, so every chip tap would cost a round trip to answer a question
 * the browser already has. Next patches the History API and `useSearchParams` sees the
 * change, so the back button still steps through the sets, which is the behaviour the spec
 * asks for. Changing massif is a real route change and goes through the router.
 */
export interface Filters {
  /** The set the URL currently describes. */
  filters: FilterState;
  /** Write a set to this massif, one history entry. */
  apply: (next: FilterState) => void;
  /** Write a set to another massif, which is a navigation rather than a filter change. */
  applyTo: (massifId: string, next: FilterState) => void;
  /** The query string as it stands, for a saved set and for a link out of this screen. */
  query: string;
}

export function useFilters(): Filters {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(params.toString())),
    [params],
  );

  const query = useMemo(() => toQueryString(filters), [filters]);

  const apply = useCallback(
    (next: FilterState) => {
      const written = toQueryString(next);
      window.history.pushState(null, '', written === '' ? pathname : `${pathname}?${written}`);
    },
    [pathname],
  );

  const applyTo = useCallback(
    (massifId: string, next: FilterState) => {
      const written = toQueryString(next);
      const path = `/massif/${massifId}`;
      router.push(written === '' ? path : `${path}?${written}`);
    },
    [router],
  );

  return { filters, apply, applyTo, query };
}
