import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * shadcn's `skeleton`, retuned.
 *
 * Three changes from what the generator writes. The `animate-pulse` is gone, because
 * MOTION_INTENSITY is 2 and a perpetual loop is decoration rather than feedback: the
 * block being there at all is what says the screen is still filling. `bg-accent` becomes
 * `bg-muted`, because in our tokens `--accent` is shadcn's quiet hover surface and this is
 * ground, not a control. The radius comes from `--radius-md`, which is the one scale.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>): ReactNode {
  return <div data-slot="skeleton" className={cn('rounded-md bg-muted', className)} {...props} />;
}
