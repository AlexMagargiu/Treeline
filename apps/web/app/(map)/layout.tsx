import type { ReactNode } from 'react';

import { MapShell } from '@/components/map/map-shell';

/**
 * Everything the map is the spine of lives under here.
 *
 * The map instance belongs to this layout and not to any page in it. Next.js keeps a
 * layout's subtree mounted while its children change, so moving from the country view into
 * a massif and back swaps only what the sheet holds. That is the whole structural point of
 * the screen: the map never goes away, a bottom sheet grows over it.
 */
export default function MapLayout({ children }: { children: ReactNode }) {
  return <MapShell>{children}</MapShell>;
}
