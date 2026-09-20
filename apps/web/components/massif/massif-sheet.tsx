'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useMapData } from '@/components/map/map-shell';
import { SheetFailure } from '@/components/sheet/sheet-failure';
import { useSheet } from '@/components/sheet/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useResource } from '@/components/use-resource';
import type { RouteList } from '@/lib/api';
import { formatWhole } from '@/lib/format';
import { TrailList, TrailListSkeleton } from './trail-list';

/**
 * The massif view's half of the sheet: what this massif is, then its trails.
 *
 * `limit=200` is one call for the whole massif. The server caps the limit there and the
 * largest massif holds 64 routes, so paging would be machinery for a case that cannot
 * happen. No `sort` and no `season` are sent, so the catalogue's own default order and the
 * season the server is in are what the reader gets.
 */
export function MassifSheet({ massifId }: { massifId: string }): ReactNode {
  const { massifs } = useMapData();
  const { setRest } = useSheet();
  const { state, reload } = useResource<RouteList>(
    `/api/routes?massif=${encodeURIComponent(massifId)}&limit=200`,
  );

  const massif =
    massifs.status === 'ready'
      ? (massifs.data.find((candidate) => candidate.id === massifId) ?? null)
      : null;

  const known = massif === null ? null : massif.routesKnown;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex min-h-11 items-center truncate text-lg font-medium">
          {massif?.name ?? 'Massif'}
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{formatWhole(known)}</span> routes known
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
        {state.status === 'loading' && <TrailListSkeleton />}
        {state.status === 'failed' && (
          <div className="mt-3">
            <SheetFailure kind={state.kind} message={state.message} onRetry={reload} />
          </div>
        )}
        {state.status === 'ready' && <TrailList list={state.data} massifId={massifId} />}
      </section>
    </div>
  );
}
