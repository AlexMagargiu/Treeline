import { MapPinOff } from 'lucide-react';
import type { ReactNode } from 'react';

import type { RouteAccess } from '@/lib/api';
import { formatApproachMin, formatAscentM } from '@/lib/format';
import { createGloss } from '@/lib/gloss';

import { readable } from './edit-field';

/**
 * Where the day starts and where it ends.
 *
 * The approach time renders as the absent marker on every row today, because
 * `route_access.approach_min` is null on all 370 seeded rows. A figure invented to fill the
 * column would be a lie about how long it takes to walk from a platform to a trailhead,
 * which is exactly the kind of number this catalogue exists to get right.
 *
 * The return problem is not here either. docs/spec.md says a point to point route planned
 * with a car has to show it, because a car has to be collected and that inverts which
 * routes are good. Every seeded access row is `train`, so the branch could never render,
 * and unreachable code that nobody can test is worse than the gap. It arrives with the
 * first car access point.
 */
export function TrailAccess({ access }: { access: RouteAccess[] }): ReactNode {
  if (access.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <MapPinOff aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
        <h4 className="mt-3 font-medium">No way in recorded</h4>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          This route has no station, car park or trailhead against it, so the day length
          above rests on nothing.
        </p>
      </div>
    );
  }

  const gloss = createGloss();

  return (
    <ul className="divide-y">
      {access.map((point) => (
        <li key={`${point.accessPointId}-${point.role}`} className="py-3">
          <div className="flex min-h-11 items-baseline gap-3">
            <span className="min-w-0 flex-1 font-medium break-words">
              {gloss(point.name)}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground capitalize">
              {point.role}
            </span>
          </div>
          <dl className="mt-1 grid grid-cols-3 gap-x-3">
            <Cell label="Arrive by" value={readable(point.mode)} mono={false} />
            <Cell label="Approach" value={formatApproachMin(point.approachMin)} />
            <Cell label="Altitude" value={formatAscentM(point.altitudeM)} />
          </dl>
          {point.note !== null && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{point.note}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Cell({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactNode {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-sm ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</dd>
    </div>
  );
}
