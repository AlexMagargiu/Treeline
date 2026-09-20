import { FilterX, RouteOff } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SeasonStatus } from '@/components/season-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RouteList, RouteListItem } from '@/lib/api';
import type { Sort } from '@/lib/filters';
import { formatAscentM, formatDistanceKm, formatDuration, formatWhole } from '@/lib/format';
import { createGloss } from '@/lib/gloss';

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
export function TrailList({
  list,
  massifId,
  query,
  sort,
  filtered,
  onClear,
}: {
  list: RouteList;
  massifId: string;
  /** The filter set as a query string, carried onto every row so going back restores it. */
  query: string;
  sort: Sort;
  filtered: boolean;
  onClear: () => void;
}): ReactNode {
  if (list.routes.length === 0) {
    return <EmptyTrails filtered={filtered} onClear={onClear} />;
  }

  const gloss = createGloss();

  return (
    <>
      {/* The drawer can change the order, so the line that describes it has to follow. */}
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {orderNote(sort, list.season)}
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
              query={query}
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
  query,
  name,
  season,
}: {
  route: RouteListItem;
  massifId: string;
  query: string;
  name: string;
  season: string;
}): ReactNode {
  const status = route.season?.status ?? 'normal';
  const path = `/massif/${massifId}/trail/${route.id}`;

  return (
    <Link
      href={query === '' ? path : `${path}?${query}`}
      className="flex min-h-14 flex-col justify-center gap-1 rounded-md px-1 py-2 active:translate-y-px"
    >
      <span className="truncate font-medium">{name}</span>

      {/* Warnings render above the description, never below it. */}
      {status !== 'normal' && <SeasonStatus status={status} season={season} />}

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

/** What the order actually is, in the reader's terms rather than a parameter name. */
function orderNote(sort: Sort, season: string): string {
  switch (sort) {
    case 'km':
      return 'Shortest distance first.';
    case 'ascent':
      return 'Least ascent first.';
    case 'difficulty':
      return `Easiest for ${season} first.`;
    case 'dayLength':
      return 'Shortest day first.';
    case 'name':
      return 'In alphabetical order.';
    default:
      return `Anything unusual for ${season} is last. Otherwise the shortest days come first.`;
  }
}

/**
 * The two ways a list can be empty, which are not the same fact.
 *
 * A filter set that matches nothing is the one that will actually be seen, and it needs a
 * way back out or it is a dead end: the chips are still on screen above it, but the reader
 * who narrowed too far wants one tap, not six. The other case, a massif whose routes are
 * not in the catalogue, cannot happen today and is still worth telling apart, because
 * "nothing matched" and "nothing is here" would otherwise be the same picture.
 */
function EmptyTrails({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}): ReactNode {
  const Icon = filtered ? FilterX : RouteOff;

  return (
    <div className="mt-3 rounded-lg border border-dashed p-4">
      <Icon aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
      <h4 className="mt-3 font-medium">
        {filtered ? 'Nothing matches those filters' : 'No trails here yet'}
      </h4>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {filtered
          ? 'Every route in this massif is outside the set you have on. Widen one of them, or clear the lot and start again.'
          : 'This massif is in the catalogue but none of its routes are.'}
      </p>
      {filtered && (
        <Button type="button" variant="outline" onClick={onClear} className="mt-4 w-auto px-6">
          <FilterX aria-hidden strokeWidth={1.75} />
          Clear the filters
        </Button>
      )}
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
