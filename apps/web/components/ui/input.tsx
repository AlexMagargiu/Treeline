import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * shadcn's input, retuned before it reached a screen.
 *
 * What changed from the generated file: 48 px tall rather than 36; text-base at every
 * width, where the generated file dropped to text-sm above md, because 16 px is what
 * stops a phone browser zooming the page when the field takes focus and this field is
 * used on a phone; the shadow is gone; the file input styling is gone, since nothing here
 * uploads through a bare input; and the focus treatment is the one outline from
 * globals.css rather than a second ring.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'min-h-12 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-colors',
        'selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
