// `cn` merges class names for the shadcn/Radix components in src/components/ui (1.11.0). tailwind-merge resolves
// conflicts (the last padding wins), so a screen can adjust a component without forking it.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
