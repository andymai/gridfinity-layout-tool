import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The role ramp classes (src/index.css @theme) are font sizes; without this
// registration tailwind-merge classifies unknown text-* classes as text
// colors, so merging `text-micro` with a real color strips one of them.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'label', 'value', 'body', 'section', 'title', 'page'] }],
    },
  },
});

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
