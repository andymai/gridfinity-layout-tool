import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names using clsx and tailwind-merge.
 * Handles conditional classes and resolves Tailwind conflicts.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-accent', className)
 * // => 'px-4 py-2 bg-accent' (if isActive is true)
 *
 * @example
 * cn('px-4', 'px-8') // tailwind-merge resolves conflict
 * // => 'px-8'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
