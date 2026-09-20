'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { SeasonStatus } from '@/components/season-status';
import { Button } from '@/components/ui/button';
import type { RouteSeason } from '@/lib/api';
import { formatWhole } from '@/lib/format';

/**
 * The current season first, which is the promise phase 1 makes about this page.
 *
 * The API returns the four rows already ordered with the current one at the front, so the
 * order is not decided here. A trail is not one difficulty: Prapastiile Zarnestiului is 5
 * in July and 8 in February, and a page that showed one number for both would be making
 * the single biggest error the catalogue can make. The other three are one tap away rather
 * than gone.
 */
export function TrailSeasons({
  seasons,
  derivedOverall,
}: {
  seasons: RouteSeason[];
  /** `route_derived.overall_difficulty`, computed live from the figures on this page. */
  derivedOverall: number | null;
}): ReactNode {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  if (seasons.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        No season has been recorded for this route.
      </p>
    );
  }

  const [current, ...others] = seasons;
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="text-base font-medium capitalize">{current.season}</h4>
        {current.status !== 'normal' && (
          <SeasonStatus status={current.status} season={current.season} />
        )}
      </div>

      <SeasonFigures season={current} />

      {/*
        The one gap docs/phase-1.md records and this page must not paper over.
        route_season.overall is a number the seed stored; route_derived.overall_difficulty
        is computed from the figures below. Correcting a distance moves the second and
        leaves the first behind, and no endpoint in phase 1 can write a season row. So the
        row stays, the computed figure is not quietly put in its place, and the disagreement
        is stated where it happens.
      */}
      {derivedOverall !== null && current.overall !== derivedOverall && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This season row was stored before the last correction. From the figures below the
          catalogue now computes an overall of{' '}
          <span className="font-mono tabular-nums">{formatWhole(derivedOverall)}</span>.
        </p>
      )}

      {current.note !== null && (
        <p className="mt-2 text-sm leading-6">{current.note}</p>
      )}
      {current.daylightNote !== null && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{current.daylightNote}</p>
      )}
      {current.requiredGear.length > 0 && (
        <p className="mt-2 text-sm leading-6">
          <span className="text-muted-foreground">Gear: </span>
          {current.requiredGear.join(', ')}
        </p>
      )}

      {others.length > 0 && (
        <>
          <Button
            type="button"
            variant="outline"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
            className="mt-4 w-auto justify-between px-4"
          >
            <span>The other seasons</span>
            <Chevron aria-hidden strokeWidth={1.75} />
          </Button>

          {open && (
            <div id={panelId} className="mt-3 divide-y border-t">
              {others.map((season) => (
                <div key={season.season} className="py-3">
                  <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
                    <h5 className="font-medium capitalize">{season.season}</h5>
                    {season.status !== 'normal' && (
                      <SeasonStatus status={season.status} season={season.season} />
                    )}
                  </div>
                  <SeasonFigures season={season} />
                  {season.note !== null && (
                    <p className="mt-2 text-sm leading-6">{season.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The four figures a season row carries, read down rather than across. */
function SeasonFigures({ season }: { season: RouteSeason }): ReactNode {
  return (
    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1">
      <Figure label="Walking" value={season.hikingDifficulty} />
      <Figure label="Technical" value={season.technicalGrade} />
      <Figure label="Overall" value={season.overall} />
    </dl>
  );
}

function Figure({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-base tabular-nums">
        {formatWhole(value)}
        <span className="text-muted-foreground">/10</span>
      </dd>
    </div>
  );
}
