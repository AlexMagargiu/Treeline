import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * shadcn's button, retuned before it reached a screen.
 *
 * What changed from the generated file: the height floor is 48 px rather than 36, because
 * every target in this product is thumb sized; the radius comes from --radius through
 * rounded-md and the component carries none of its own; the focus treatment is the single
 * outline defined in globals.css rather than a second ring of shadcn's own, so there is
 * one focus style in the app; the shadow is gone, because a button on a flat ground is
 * not elevated above anything; the type is text-base rather than text-sm, since this is
 * read in gloves; and the six variants and eight sizes are cut to the two variants and
 * one size this product actually uses. A variant is added back when a screen needs it.
 */
const buttonVariants = cva(
  'inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-md px-4 text-base font-medium whitespace-nowrap transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-5',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background text-foreground hover:bg-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Button({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp className={cn(buttonVariants({ variant, className }))} {...props} />;
}

export { Button, buttonVariants };
