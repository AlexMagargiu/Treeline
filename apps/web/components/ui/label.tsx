'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/lib/utils';

/*
 * shadcn's label, retuned before it reached a screen.
 *
 * What changed from the generated file: text-base rather than text-sm, because a label
 * read in gloves at first light is not a caption; leading that lets a wrapped label sit
 * on two lines at 320 px rather than clipping; and the peer-disabled and group-disabled
 * rules are gone, since no field in this product is disabled while its label is shown.
 */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('block text-base leading-6 font-medium text-foreground', className)}
      {...props}
    />
  );
}

export { Label };
