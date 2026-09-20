import { CloudOff, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

/**
 * What a read that did not answer looks like inside the sheet.
 *
 * Composed rather than a sentence in grey, and offline is its own case, because an empty
 * list and a list that never arrived are the same picture and opposite facts.
 */
export function SheetFailure({
  kind,
  message,
  onRetry,
}: {
  kind: 'offline' | 'server';
  message: string;
  onRetry: () => void;
}): ReactNode {
  const offline = kind === 'offline';
  const Icon = offline ? CloudOff : TriangleAlert;

  return (
    <div role="status" className="rounded-lg border border-dashed p-4">
      <Icon aria-hidden className="size-6 text-muted-foreground" />
      <h3 className="mt-3 font-medium">{offline ? 'No connection' : 'That did not load'}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {offline
          ? 'Nothing here is out of date. There is simply nothing yet, and it will fill in once the signal comes back.'
          : message}
      </p>
      <Button type="button" variant="outline" onClick={onRetry} className="mt-4 w-auto px-6">
        Try again
      </Button>
    </div>
  );
}
