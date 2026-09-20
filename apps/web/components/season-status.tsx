import { OctagonX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * What a season row's status looks like, on a trail row and on a trail page.
 *
 * Status is state, not identity, so it never travels on colour alone: an icon and the word
 * carry it, and the colour only reinforces them. All 740 seeded season rows say `normal`
 * today, so nothing on either screen renders this yet; it is here because the row that
 * will need it first is the one nobody should have to notice.
 */
export function SeasonStatus({
  status,
  season,
  className,
}: {
  status: string;
  season: string;
  className?: string;
}): ReactNode {
  const severe = status === 'dangerous' || status === 'closed';
  const Icon = status === 'closed' ? OctagonX : TriangleAlert;
  const wording: Record<string, string> = {
    harder: `Harder in ${season}`,
    dangerous: `Dangerous in ${season}`,
    closed: `Closed in ${season}`,
  };

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs',
        severe ? 'border-destructive text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-3.5" />
      {wording[status] ?? `Not normal in ${season}`}
    </span>
  );
}
