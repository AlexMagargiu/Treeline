'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Legend } from '@/components/map/legend';
import { useMapData } from '@/components/map/map-shell';
import { SheetFailure } from '@/components/sheet/sheet-failure';
import { LogoutButton } from '@/components/logout-button';
import { ThemeControl } from '@/components/theme';
import { Skeleton } from '@/components/ui/skeleton';
import { useThemeName } from '@/components/use-theme-name';
import { DEM_ATTRIBUTION_FULL } from '@/components/map/map-style';
import { formatWhole } from '@/lib/format';
import { createGloss } from '@/lib/gloss';
import { type ThemeName, shadingClass, shadingSwatch } from '@/lib/shading';
import type { Massif } from '@/lib/api';

/**
 * The country view's half of the sheet.
 *
 * The index below the legend is not decoration and it is not a second map. Fifteen massifs
 * cluster so tightly around Brasov and Prahova that labelling them on the map at country
 * zoom hides most of them behind each other, which would leave the shading carrying the
 * counts by itself. Colour alone fails the accessibility rules, a continuous scale wants a
 * table beside it, and a map polygon is not something a keyboard can reach. One list
 * answers all three, and it is the fastest way to open a massif anyway.
 */
export function CountrySheet(): ReactNode {
  const theme = useThemeName();
  const { massifs, reload } = useMapData();

  return (
    <div className="space-y-5">
      <Legend theme={theme} />

      <section aria-labelledby="controls-heading" className="border-t pt-4">
        <h2 id="controls-heading" className="sr-only">
          Display and session
        </h2>
        <ThemeControl />
        <div className="mt-2">
          <LogoutButton />
        </div>
      </section>

      <section aria-labelledby="massifs-heading" className="border-t pt-4">
        <h2 id="massifs-heading" className="font-medium">
          Massifs
        </h2>
        {massifs.status === 'loading' && <MassifIndexSkeleton />}
        {massifs.status === 'failed' && (
          <div className="mt-3">
            <SheetFailure kind={massifs.kind} message={massifs.message} onRetry={reload} />
          </div>
        )}
        {massifs.status === 'ready' && <MassifIndex massifs={massifs.data} theme={theme} />}
      </section>

      <section aria-labelledby="map-data-heading" className="border-t pt-4">
        <h2 id="map-data-heading" className="font-medium">
          Map data
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Basemap and trails from{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-4"
          >
            OpenStreetMap
          </a>
          , under the Open Database Licence.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{DEM_ATTRIBUTION_FULL}</p>
      </section>
    </div>
  );
}

function MassifIndex({ massifs, theme }: { massifs: Massif[]; theme: ThemeName }): ReactNode {
  const gloss = createGloss();

  return (
    <ul className="mt-1 divide-y">
      {massifs.map((massif) => {
        const band = shadingClass(massif.routesKnown);
        return (
          <li key={massif.id}>
            <Link
              href={`/massif/${massif.id}`}
              className="flex min-h-14 items-center gap-3 rounded-md px-1 active:translate-y-px"
            >
              <span
                aria-hidden
                style={{
                  backgroundColor: band === null ? 'transparent' : shadingSwatch(theme, band),
                }}
                className="h-4 w-4 shrink-0 rounded-xs border"
              />
              <span className="min-w-0 flex-1 truncate">{gloss(massif.name)}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                {formatWhole(massif.routesKnown)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The shape the list will be: a swatch, a name and a count, fifteen times. */
function MassifIndexSkeleton(): ReactNode {
  return (
    <ul aria-hidden className="mt-1 divide-y">
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index} className="flex min-h-14 items-center gap-3 px-1">
          <Skeleton className="h-4 w-4 rounded-xs" />
          <Skeleton className="h-4 flex-1" style={{ maxWidth: `${55 + ((index * 7) % 30)}%` }} />
          <Skeleton className="h-4 w-6" />
        </li>
      ))}
    </ul>
  );
}
