import { CloudOff, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { BASEMAP_LAND, type ThemeName } from '@/lib/shading';

export type MapState = 'loading' | 'offline' | 'failed';

/**
 * What stands in for the map until there is one.
 *
 * While it is loading this is the basemap's own ground colour and a quiet line, so the
 * real map arrives without anything flashing. That is deliberately not a spinner over a
 * grey box: the skeletons that carry weight are in the sheet, where the content is.
 *
 * Offline is its own state rather than a blank map, because a map with no network and a
 * map with no massifs look identical and mean completely different things.
 */
export function MapPlaceholder({
  state,
  theme,
  onRetry,
}: {
  state: MapState;
  theme: ThemeName;
  onRetry: () => void;
}): ReactNode {
  if (state === 'loading') {
    return (
      <div
        aria-hidden
        style={{ backgroundColor: BASEMAP_LAND[theme] }}
        className="absolute inset-0"
      >
        <p className="p-4 text-sm text-muted-foreground">The map is loading.</p>
      </div>
    );
  }

  const offline = state === 'offline';
  const Icon = offline ? CloudOff : TriangleAlert;

  return (
    <div
      role="status"
      style={{ backgroundColor: BASEMAP_LAND[theme] }}
      className="absolute inset-0 flex items-start p-4"
    >
      <div className="w-full max-w-sm rounded-lg border bg-card p-4 text-card-foreground">
        <Icon aria-hidden className="size-6 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-medium">
          {offline ? 'No connection' : 'The map did not start'}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {offline
            ? 'The map and the massifs both need the network. Nothing here is out of date, there is simply nothing yet.'
            : 'The map tiles or the browser refused. The trail lists below still work.'}
        </p>
        <Button type="button" onClick={onRetry} variant="outline" className="mt-4 w-auto px-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
