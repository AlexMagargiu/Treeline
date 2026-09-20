import { OctagonX, RouteOff, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import type { RouteList, RouteListItem } from '@/lib/api';
import { formatAscentM, formatDistanceKm, formatDuration, formatWhole } from '@/lib/format';
import { createGloss } from '@/lib/gloss';
import { cn } from '@/lib/utils';

/**
 * The trails in a massif, as a column of figures you can read down.
 *
 * Every number comes from lib/format.ts and nothing is rounded here. `km`, `dayLengthH`
 * and `effortPoints` arrive as text because the view keeps full precision and the API
 * refuses to put it through a double, so they are never compared or sorted in this file
 * either: "9.00" sorts after "16.00" and the server has `sort=km` for that.
 *
 * The column headings are written once above the list rather than on every row, because
 * the reason this reads as an instrument is that four figures line up down the screen.
 */
export function TrailList({ list, massifId }: { list: RouteList; massifId: string }): ReactNode {
  if (list.routes.length === 0) return <EmptyTrails />;

  const gloss = createGloss();

  return (
    <>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Anything unusual for {list.season} is last. Otherwise the shortest days come first.
      </p>

      <div
        aria-hidden
        className="mt-3 grid grid-cols-4 gap-x-2 border-b pb-1 text-xs text-muted-foreground"
      >
        <span>Distance</span>
        <span>Ascent</span>
        <span>Day</span>
        <span>Difficulty</span>
      </div>

      <ul className="divide-y">
        {list.routes.map((route) => (
          <li key={route.id}>
            <TrailRow
              route={route}
              massifId={massifId}
              name={gloss(route.nameRo, route.nameEn)}
              season={list.season}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function TrailRow({
  route,
  massifId,
  name,
  season,
}: {
  route: RouteListItem;
  massifId: string;
  name: string;
  season: string;
}): ReactNode {
  const status = route.season?.status ?? 'normal';

  return (
    <Link
      href={`/massif/${massifId}/trail/${route.id}`}
      className="flex min-h-14 flex-col justify-center gap-1 rounded-md px-1 py-2 active:translate-y-px"
    >
      <span className="truncate font-medium">{name}</span>

      {/* Warnings render above the description, never below it. */}
      {status !== 'normal' && <SeasonWarning status={status} season={season} />}

      <span className="grid grid-cols-4 gap-x-2 font-mono text-sm tabular-nums">
        <span>{formatDistanceKm(route.km)}</span>
        <span>{formatAscentM(route.ascentM)}</span>
        <span>{formatDuration(route.dayLengthH)}</span>
        <span>
          {formatWhole(route.season?.overall ?? null)}
          <span className="text-muted-foreground">/10</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * Status is state, not identity, so it never travels on colour alone: an icon and the word
 * carry it, and the colour only reinforces them.
 */
function SeasonWarning({ status, season }: { status: string; season: string }): ReactNode {
  const severe = status === 'dangerous' || status === 'closed';
  const Icon = status === 'closed' ? OctagonX : TriangleAlert;
  const wording: Record<string, string> = {
    harder: `Harder in ${season}`,
    dangerous: `Dangerous in ${season}`,
    closed: `Closed in ${season}`,
  };

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs',
        severe ? 'border-destructive text-destructive' : 'text-muted-foreground',
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-3.5" />
      {wording[status] ?? `Not normal in ${season}`}
    </span>
  );
}

/**
 * Cannot happen today, because there are no filters yet and every massif has at least one
 * route. It is here because the next prompt adds six filter chips and a drawer, and the
 * first thing a filter does is return nothing.
 */
function EmptyTrails(): ReactNode {
  return (
    <div className="mt-3 rounded-lg border border-dashed p-4">
      <RouteOff aria-hidden className="size-6 text-muted-foreground" />
      <h4 className="mt-3 font-medium">No trails here yet</h4>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        This massif is in the catalogue but none of its routes are.
      </p>
    </div>
  );
}

/** The shape the rows will be: a name over four figures. */
export function TrailListSkeleton(): ReactNode {
  return (
    <ul aria-hidden className="mt-4 divide-y">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="flex min-h-14 flex-col justify-center gap-2 px-1 py-2">
          <Skeleton className="h-4" style={{ width: `${50 + ((index * 11) % 35)}%` }} />
          <div className="grid grid-cols-4 gap-x-2">
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3.5 w-8" />
          </div>
        </li>
      ))}
    </ul>
  );
}
