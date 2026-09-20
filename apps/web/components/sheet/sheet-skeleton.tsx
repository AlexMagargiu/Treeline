import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * The panel before the client tree it holds has resolved.
 *
 * Both sheet pages read the query string for their filter set, so both sit behind a
 * Suspense boundary, and both want the same fallback: a heading, a line under it and a
 * band of controls. Matching the shape of what arrives keeps the sheet from jumping the
 * moment it fills, which is the whole reason a skeleton is worth more than a spinner here.
 */
export function SheetSkeleton(): ReactNode {
  return (
    <div aria-hidden className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 flex-1" />
      </div>
      <div className="space-y-3 border-t pt-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}
