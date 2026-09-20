import { Suspense } from 'react';

import { SheetSkeleton } from '@/components/sheet/sheet-skeleton';
import { TrailSheet } from '@/components/trail/trail-sheet';

/**
 * The third rest of the sheet.
 *
 * It sits under the map layout, so opening a trail keeps the same MapLibre instance that
 * drew the massif behind it. The Suspense boundary is there because the page reads the
 * query string: the filter set the reader arrived with travels on the URL so that going
 * back returns the list exactly as they left it.
 */
export default async function TrailPage({
  params,
}: {
  params: Promise<{ massifId: string; routeId: string }>;
}) {
  const { massifId, routeId } = await params;
  return (
    <Suspense fallback={<SheetSkeleton />}>
      <TrailSheet massifId={massifId} routeId={routeId} />
    </Suspense>
  );
}
