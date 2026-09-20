import type { ReactNode } from 'react';

import { DEM_ATTRIBUTION_SHORT } from './map-style';

/**
 * The credit that rides on the map itself.
 *
 * OpenStreetMap is ODbL and the Copernicus DEM carries its own line. Neither is optional
 * and neither belongs in a file nobody opens, so the basemap credit is on screen whenever
 * the basemap is, and the elevation credit appears when contours and hillshade are
 * actually drawn, which is inside a massif. The full Copernicus text is in the sheet, which
 * is the reachable long form infra/tiles/README.md allows on a small screen.
 *
 * The link is the only thing here a thumb can hit, and it gets the full target height.
 */
export function MapAttribution({ elevation }: { elevation: boolean }): ReactNode {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-25 z-10 px-3">
      <p className="text-xs leading-5 text-muted-foreground">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto inline-flex min-h-12 items-center rounded-md bg-background/85 px-2 underline decoration-border underline-offset-4"
        >
          © OpenStreetMap
        </a>
        {elevation ? (
          <span className="ml-1 inline-block rounded-md bg-background/85 px-2 py-1">
            {DEM_ATTRIBUTION_SHORT}
          </span>
        ) : null}
      </p>
    </div>
  );
}
