'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { SheetFailure } from '@/components/sheet/sheet-failure';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/components/use-resource';
import type { RouteDetail } from '@/lib/api';
import { parseFilters, toQueryString } from '@/lib/filters';
import { createGloss } from '@/lib/gloss';

import { EditField } from './edit-field';
import { TrailAccess } from './trail-access';
import { TrailCategories } from './trail-categories';
import { TrailFigures } from './trail-figures';
import { TrailSeasons } from './trail-seasons';

/**
 * Everything known about one route, for the season you are in.
 *
 * It fills the sheet's third rest over the same map instance the list was read on, so
 * opening a trail costs no WebGL context and no tile request. The order of the page is
 * fixed by the spec and by rule 7 of CLAUDE.md, and the one thing that moves is the reader
 * correcting a figure, which is answered from the PATCH response rather than by asking the
 * server again.
 */
export function TrailSheet({
  massifId,
  routeId,
}: {
  massifId: string;
  routeId: string;
}): ReactNode {
  const params = useSearchParams();
  const { state, reload } = useResource<RouteDetail>(`/api/routes/${routeId}`);

  /*
   * The edited route, which replaces the fetched one until the fetch itself changes.
   *
   * Comparing ids rather than clearing this in an effect: opening a different trail brings
   * a different id, so the override falls away by itself and there is no effect to get
   * wrong. The PATCH response is the whole route read back through `route_derived` inside
   * the transaction that wrote the edit, so putting it here is what makes the difficulty,
   * the stage, the trip type and the energy move on screen without a second request.
   */
  const [edited, setEdited] = useState<RouteDetail | null>(null);
  const fetched = state.status === 'ready' ? state.data : null;
  const route =
    edited !== null && fetched !== null && edited.id === fetched.id ? edited : fetched;

  // The filter set the reader came in with, carried back so the list is as they left it.
  const query = toQueryString(parseFilters(new URLSearchParams(params.toString())));
  const back = query === '' ? `/massif/${massifId}` : `/massif/${massifId}?${query}`;

  const gloss = createGloss();

  return (
    <div className="space-y-5">
      <Button asChild variant="outline" className="w-auto px-4">
        <Link href={back}>
          <ChevronLeft aria-hidden strokeWidth={1.75} />
          Back to the trails
        </Link>
      </Button>

      {state.status === 'loading' && <TrailSkeleton />}
      {state.status === 'failed' && (
        <SheetFailure kind={state.kind} message={state.message} onRetry={reload} />
      )}

      {route !== null && (
        <>
          <div>
            <h2 className="text-lg leading-7 font-medium break-words">
              {gloss(route.nameRo, route.nameEn)}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{gloss(route.massif.name)}</p>
          </div>

          {/*
            The warnings slot. Rule 7 of CLAUDE.md: warnings render above the description
            and never below it, so the place is fixed now even though nothing fills it.
            Warnings are a phase 6 table and no row of them exists, and inventing one to
            prove the slot works would be the worst thing this page could print. The season
            status is not put here either: it belongs to the season block, where the row it
            describes is.
          */}

          <EditField
            routeId={route.id}
            field="notes"
            label="Note"
            layout="block"
            display={
              route.notes ?? (
                <span className="text-muted-foreground">Nothing written down yet.</span>
              )
            }
            initial={route.notes ?? ''}
            control={{ kind: 'note', maxLength: 10000 }}
            nullable
            onSaved={setEdited}
          />

          <section aria-labelledby="season-heading" className="border-t pt-4">
            <h3 id="season-heading" className="font-medium">
              This season
            </h3>
            <div className="mt-2">
              <TrailSeasons
                seasons={route.seasons}
                derivedOverall={route.derived?.overallDifficulty ?? null}
              />
            </div>
          </section>

          <TrailFigures route={route} onSaved={setEdited} />

          <section aria-labelledby="categories-heading" className="border-t pt-4">
            <h3 id="categories-heading" className="font-medium">
              Kind of route
            </h3>
            <div className="mt-2">
              <TrailCategories categories={route.categories} />
            </div>
          </section>

          <section aria-labelledby="access-heading" className="border-t pt-4">
            <h3 id="access-heading" className="font-medium">
              Getting there
            </h3>
            <div className="mt-1">
              <TrailAccess access={route.access} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** The shape the page will be: a name, a season block and two columns of figures. */
function TrailSkeleton(): ReactNode {
  return (
    <div aria-hidden className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-12" />
      <div className="space-y-2 border-t pt-4">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
      <div className="space-y-2 border-t pt-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    </div>
  );
}
