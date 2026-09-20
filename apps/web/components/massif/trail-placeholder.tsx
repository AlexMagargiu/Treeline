'use client';

import { ChevronLeft, Hammer } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export function TrailPlaceholder({ massifId }: { massifId: string }): ReactNode {
  return (
    <div className="space-y-5">
      <h2 className="flex min-h-11 items-center truncate text-lg font-medium">Trail</h2>

      <div className="rounded-lg border border-dashed p-4">
        <Hammer aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
        <h3 className="mt-3 font-medium">Not built yet</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The trail page arrives with the next piece of work. Nothing is missing from the
          catalogue, and every figure for this route is already in the list behind this panel.
        </p>
        <Button asChild variant="outline" className="mt-4 w-auto px-6">
          <Link href={`/massif/${massifId}`}>
            <ChevronLeft aria-hidden strokeWidth={1.75} />
            Back to the trails
          </Link>
        </Button>
      </div>
    </div>
  );
}
