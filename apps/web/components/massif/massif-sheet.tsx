'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';

import { FilterChips } from '@/components/filters/filter-chips';
import { FilterDrawer } from '@/components/filters/filter-drawer';
import { SavedSets } from '@/components/filters/saved-sets';
import { useFilters } from '@/components/filters/use-filters';
import { useMapData } from '@/components/map/map-shell';
import { SheetFailure } from '@/components/sheet/sheet-failure';
import { useSheet } from '@/components/sheet/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useResource } from '@/components/use-resource';
import type { RouteList } from '@/lib/api';
import {
  type SeasonName,
  DEFAULT_SORT,
  activeCount,
  clearFilters,
  toApiQuery,
  toSeasonName,
} from '@/lib/filters';
import { formatWhole } from '@/lib/format';
import { TrailList, TrailListSkeleton } from './trail-list';

/**
 * The massif view's half of the sheet: what this massif is, then its trails.
 *
 * The catalogue call takes the whole massif in one request. The server caps the limit at
 * 200 and the largest massif holds 64 routes, so paging would be machinery for a case that
 * cannot happen. The filters are the URL, so the call rebuilds itself whenever the query
 * string changes and there is no second copy of the set to keep in step.
 */
export function MassifSheet({ massifId }: { massifId: string }): ReactNode {
  const { massifs } = useMapData();
  const { setRest } = useSheet();
  const { filters, apply, applyTo, query } = useFilters();

  const { state, reload } = useResource<RouteList>(
    `/api/routes?${toApiQuery(filters, massifId)}`,
  );

  /*
   * What the last answer said, kept across the next request.
   *
   * The chips are above the list and stay on screen while it reloads, and every one of the
   * three facts below comes from a response rather than from an assumption: which season
   * the server read, whether it applied the not-walked filter, and whether every route it
   * returned is normal for that season. Dropping them during a reload would make the
   * honesty line under the chips flicker once per tap.
   */
  const [answer, setAnswer] = useState<{
    season: SeasonName | null;
    notWalkedApplied: boolean;
    allNormal: boolean;
  }>({ season: null, notWalkedApplied: false, allNormal: true });

  useEffect(() => {
    if (state.status !== 'ready') return;
    const list = state.data;
    setAnswer({
      season: toSeasonName(list.season),
      notWalkedApplied: list.notWalkedApplied,
      allNormal: list.routes.every((route) => (route.season?.status ?? 'normal') === 'normal'),
    });
  }, [state]);

  const massif =
    massifs.status === 'ready'
      ? (massifs.data.find((candidate) => candidate.id === massifId) ?? null)
      : null;

  const known = massif === null ? null : massif.routesKnown;
  const filtered = activeCount(filters) > 0;
  const total = state.status === 'ready' ? state.data.total : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex min-h-11 items-center truncate text-lg font-medium">
          {massif?.name ?? 'Massif'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {filtered && total !== null ? (
            <>
              <span className="font-mono tabular-nums">{formatWhole(total)}</span> of{' '}
              <span className="font-mono tabular-nums">{formatWhole(known)}</span> routes
              match
            </>
          ) : (
            <>
              <span className="font-mono tabular-nums">{formatWhole(known)}</span> routes
              known
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setRest('list')} className="w-auto flex-1 px-6">
          Show the trails
        </Button>
        <Button asChild variant="outline" className="w-auto flex-1 px-6">
          <Link href="/">
            <ChevronLeft aria-hidden strokeWidth={1.75} />
            All massifs
          </Link>
        </Button>
      </div>

      <section aria-labelledby="trails-heading" className="border-t pt-4">
        <h3 id="trails-heading" className="font-medium">
          Trails
        </h3>

        <div className="mt-3 space-y-3">
          <SavedSets currentQuery={query} apply={apply} />
          <FilterChips
            filters={filters}
            apply={apply}
            season={answer.season}
            notWalkedApplied={answer.notWalkedApplied}
            allNormal={answer.allNormal}
          />
        </div>
        <FilterDrawer
          filters={filters}
          massifId={massifId}
          apply={apply}
          applyTo={applyTo}
        />

        <div className="mt-4 border-t pt-3">
          {state.status === 'loading' && <TrailListSkeleton />}
          {state.status === 'failed' && (
            <SheetFailure kind={state.kind} message={state.message} onRetry={reload} />
          )}
          {state.status === 'ready' && (
            <TrailList
              list={state.data}
              massifId={massifId}
              query={query}
              sort={filters.sort ?? DEFAULT_SORT}
              filtered={filtered}
              onClear={() => apply(clearFilters(filters))}
            />
          )}
        </div>
      </section>
    </div>
  );
}
