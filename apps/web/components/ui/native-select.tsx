import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * A native select, wearing our tokens. Deliberately not shadcn's `select`.
 *
 * shadcn's select is a Radix listbox and needs @radix-ui/react-select, which this app does
 * not have: package.json carries @radix-ui/react-label and @radix-ui/react-slot and
 * nothing else from Radix. Adding it would buy a listbox that is worse here than the one
 * the phone already has. Android opens a native <select> as a full height list with rows
 * the size of a thumb, it scrolls with momentum, it is reachable by keyboard and by screen
 * reader without a line of our code, and it costs nothing in a bundle that has to arrive
 * over 3G. docs/design.md locks shadcn/ui as the component system; it does not ask us to
 * re-implement an element the platform draws better.
 *
 * Retuned the same way the other four are: 48 px floor, text-base at every width so a
 * phone does not zoom the page on focus, our radius and colours, no shadow, and the single
 * focus outline from globals.css. `appearance-none` drops the platform arrow so the
 * control matches the inputs beside it, and a Lucide chevron replaces it, which keeps the
 * one icon family.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'min-h-12 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-2 pr-11 pl-3 text-base text-foreground transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
