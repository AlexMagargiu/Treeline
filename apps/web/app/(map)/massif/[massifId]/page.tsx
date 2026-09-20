import { Suspense } from 'react';

import { MassifSheet } from '@/components/massif/massif-sheet';
import { SheetSkeleton } from '@/components/sheet/sheet-skeleton';

/**
 * The Suspense boundary is not decoration. Filter state lives in the URL, so the sheet
 * reads `useSearchParams`, and the App Router refuses to prerender a tree that does so
 * without one. The fallback is the shape the panel is about to be, not a spinner.
 */
export default async function MassifPage({
  params,
}: {
  params: Promise<{ massifId: string }>;
}) {
  const { massifId } = await params;
  return (
    <Suspense fallback={<SheetSkeleton />}>
      <MassifSheet massifId={massifId} />
    </Suspense>
  );
}
