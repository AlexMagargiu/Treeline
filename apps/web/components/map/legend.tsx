import type { ReactNode } from 'react';

import { SHADING_CLASSES, type ThemeName, shadingSwatch } from '@/lib/shading';

/**
 * What the shading means, said plainly and never implying anything it does not.
 *
 * The first line is the whole legend at the sheet's lowest rest, which is where the map
 * opens, so the reader is never looking at a shaded map with no key to it. Raising the
 * sheet gives the breaks and the one sentence that rules out the reading this screen would
 * otherwise invite: that a pale massif is one you have not been to.
 */
export function Legend({ theme }: { theme: ThemeName }): ReactNode {
  return (
    <section aria-labelledby="legend-heading">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="legend-heading" className="min-w-0 truncate font-medium">
          Shaded by routes known
        </h2>
        <span aria-hidden className="flex shrink-0 gap-0.5">
          {SHADING_CLASSES.map((band, index) => (
            <span
              key={band.label}
              style={{ backgroundColor: shadingSwatch(theme, index) }}
              className="h-4 w-4 rounded-xs"
            />
          ))}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {SHADING_CLASSES.map((band, index) => (
          <li key={band.label} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              style={{ backgroundColor: shadingSwatch(theme, index) }}
              className="h-4 w-6 shrink-0 rounded-xs"
            />
            <span className="font-mono tabular-nums">{band.label}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Darker means more routes in the catalogue. It does not mean you have walked them.
      </p>
    </section>
  );
}
