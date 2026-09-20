import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * shadcn's textarea, retuned before it reached a screen.
 *
 * What changed from the generated file: text-base at every width, where the generated file
 * drops to text-sm above md, because 16 px is what stops a phone browser zooming the page
 * when the field takes focus and this field is used on a phone; a three line floor rather
 * than shadcn's min-h-16, since the one field that uses it is a route note; the shadow is
 * gone, because a field on a flat ground is not elevated above anything; the focus
 * treatment is the single outline defined in globals.css rather than a second ring of
 * shadcn's own; and the radius and the colours come from our tokens.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'field-sizing-content min-h-20 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base leading-6 text-foreground transition-colors',
        'selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
