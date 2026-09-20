'use client';

import type { ReactNode } from 'react';

import type { RouteDetail } from '@/lib/api';
import {
  formatAscentM,
  formatDistanceKm,
  formatDuration,
  formatEffortPoints,
  formatKcal,
  formatWhole,
} from '@/lib/format';

import { EditField, readable } from './edit-field';

/**
 * The figures, in two halves: what the catalogue was told, and what follows from it.
 *
 * They are one section and not two screens because the point of the page is the line
 * between them. Correct the distance in the top half and every figure in the bottom half
 * moves in the same response, because `route_derived` computed all of them and the API
 * read the route back through the view inside the transaction that wrote the edit. Nothing
 * here parses a number out of a string, rounds one, or works one out: `km`, the times, the
 * effort and the energy arrive as text with the view's full precision and go straight to
 * the formatters, which is the only thing the browser is allowed to do to them.
 */

// The Prisma enums, in their declared order, which is also the order of severity.
const TERRAIN = [
  'FLAT',
  'ROAD',
  'FOREST',
  'TRAIL',
  'ROCKY',
  'SCREE',
  'LADDERS',
  'CHAINS',
  'EXPOSED',
  'FERRATA',
  'CLIMB',
] as const;

const TECHNICAL = [
  'NONE',
  'STEEP',
  'LADDERS',
  'CHAINS',
  'SCRAMBLE',
  'BEGINNER_CLIMB',
  'EXPOSED',
  'FERRATA_D',
  'CLIMB',
] as const;

const CONFIDENCE = ['high', 'medium', 'verify'] as const;

/** numeric(5,2) in the schema: three digits before the point and two after. */
const KM = /^\d{1,3}(\.\d{1,2})?$/;

export function TrailFigures({
  route,
  onSaved,
}: {
  route: RouteDetail;
  onSaved: (next: RouteDetail) => void;
}): ReactNode {
  const derived = route.derived;

  return (
    <>
      <section aria-labelledby="recorded-heading" className="border-t pt-4">
        <h3 id="recorded-heading" className="font-medium">
          What is recorded
        </h3>
        <div className="mt-1 divide-y">
          <EditField
            routeId={route.id}
            field="nameRo"
            label="Name"
            display={route.nameRo}
            initial={route.nameRo}
            control={{ kind: 'text', maxLength: 200 }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="nameEn"
            label="Name in English"
            display={
              route.nameEn ?? <span className="text-muted-foreground">Not recorded</span>
            }
            initial={route.nameEn ?? ''}
            control={{ kind: 'text', maxLength: 200 }}
            nullable
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="km"
            label="Distance"
            display={<Figure>{formatDistanceKm(route.km)}</Figure>}
            initial={route.km}
            control={{ kind: 'decimal', pattern: KM, message: 'Use a distance like 16.5.' }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="ascentM"
            label="Ascent"
            display={<Figure>{formatAscentM(route.ascentM)}</Figure>}
            initial={String(route.ascentM)}
            control={{ kind: 'integer', min: 0, max: 10000 }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="terrain"
            label="Terrain"
            display={readable(route.terrain)}
            initial={route.terrain}
            control={{ kind: 'choice', options: TERRAIN }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="technical"
            label="Technical"
            display={readable(route.technical)}
            initial={route.technical}
            control={{ kind: 'choice', options: TECHNICAL }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="quiet"
            label="Quiet"
            display={
              <Figure>
                {formatWhole(route.quiet)}
                <span className="text-muted-foreground">/5</span>
              </Figure>
            }
            initial={String(route.quiet)}
            control={{ kind: 'level', min: 1, max: 5 }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="confidence"
            label="Confidence"
            display={readable(route.confidence)}
            initial={route.confidence}
            control={{ kind: 'choice', options: CONFIDENCE }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="seasonWindow"
            label="Season window"
            display={route.seasonWindow}
            initial={route.seasonWindow}
            control={{ kind: 'text', maxLength: 100 }}
            onSaved={onSaved}
          />
          <EditField
            routeId={route.id}
            field="shape"
            label="Shape"
            display={
              route.shape ?? <span className="text-muted-foreground">Not recorded</span>
            }
            initial={route.shape ?? ''}
            control={{ kind: 'text', maxLength: 100 }}
            nullable
            onSaved={onSaved}
          />
        </div>
      </section>

      <section aria-labelledby="computed-heading" className="border-t pt-4">
        <h3 id="computed-heading" className="font-medium">
          What follows from it
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          One SQL view owns every figure here. Correct a distance above and all of them
          move.
        </p>

        {derived === null ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            No figures have been computed for this route.
          </p>
        ) : (
          <dl className="mt-3 divide-y">
            <Row label="Moving time" value={formatDuration(derived.movingNowH)} />
            <Row label="Travel time" value={formatDuration(derived.trainH)} />
            <Row label="Day length" value={formatDuration(derived.dayLengthH)} />
            <Row label="Effort" value={formatEffortPoints(derived.effortPoints)} />
            <Row
              label="Walking difficulty"
              value={
                <>
                  {formatWhole(derived.hikingDifficulty)}
                  <span className="text-muted-foreground">/10</span>
                </>
              }
            />
            <Row label="Technical grade" value={formatWhole(derived.technicalScore)} />
            <Row
              label="Overall"
              value={
                <>
                  {formatWhole(derived.overallDifficulty)}
                  <span className="text-muted-foreground">/10</span>
                </>
              }
            />
            <Row label="Stage" value={formatWhole(derived.stage)} />
            <Row label="Trip type" value={derived.tripType ?? '-'} mono={false} />
            <Row
              label="Energy"
              value={formatKcal(derived.kcalNet)}
              /*
               * Net leads because the catalogue's own figure is gross: it includes the
               * roughly 130 kcal an hour a body burns sitting still, which is about 1100 of
               * route 52's 6830. The band is not decoration either. It is the plus or minus
               * 25 percent the spec requires, and it is wide enough to bracket the figure
               * the ACSM formula gives for the same day, which is an honest statement of
               * how little anybody knows about this.
               */
              note={`Give or take ${formatWhole(derived.kcalNetLow)} to ${formatWhole(
                derived.kcalNetHigh,
              )}. Gross ${formatKcal(derived.kcal)}, ${formatWhole(
                derived.kcalLow,
              )} to ${formatWhole(derived.kcalHigh)}.`}
            />
          </dl>
        )}
      </section>
    </>
  );
}

/** Numbers are mono and tabular, so a column of them lines up. Prose is not. */
function Figure({ children }: { children: ReactNode }): ReactNode {
  return <span className="font-mono tabular-nums">{children}</span>;
}

/**
 * A computed figure. The right hand padding matches the 48 px correct button on the rows
 * above, so the two halves of this section read as one column rather than two.
 */
function Row({
  label,
  value,
  note,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  mono?: boolean;
}): ReactNode {
  return (
    <div className="flex min-h-14 flex-col justify-center gap-0.5 py-2 pr-15">
      <div className="flex items-baseline gap-3">
        <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
        <dd className={`min-w-0 flex-1 text-right ${mono ? 'font-mono tabular-nums' : ''}`}>
          {value}
        </dd>
      </div>
      {note !== undefined && (
        <p className="text-right text-xs leading-5 text-muted-foreground">{note}</p>
      )}
    </div>
  );
}
