import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A filter chip, and the one control the catalogue is driven by.
 *
 * Not shadcn's `toggle`, which would need @radix-ui/react-toggle for a button with
 * `aria-pressed` on it. It is sized like our `button`: 48 px floor, our radius, our
 * tokens, the single focus outline from globals.css. The pressed state is the accent
 * filling the chip, so it is carried by fill and by `aria-pressed` and never by a hover,
 * which is the rule for a screen read with a thumb in gloves.
 */
export function Chip({
  pressed,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { pressed: boolean }): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-base transition-colors active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-60',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        pressed
          ? 'border-primary bg-primary font-medium text-primary-foreground'
          : 'border-input bg-card text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
