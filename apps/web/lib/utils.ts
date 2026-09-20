import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn's class merger. Later classes win over earlier ones of the same Tailwind group. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
