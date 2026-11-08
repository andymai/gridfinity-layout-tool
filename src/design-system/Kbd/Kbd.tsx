import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { intentText } from '../variants';

const kbdVariants = cva(['rounded border', 'align-middle'], {
  variants: {
    variant: {
      chip: ['inline-block', 'px-1.5 py-0.5', 'text-micro leading-none'],
      keycap: [
        'inline-flex items-center justify-center',
        'h-[22px] min-w-[22px] px-1.5',
        'text-label font-medium',
      ],
    },
    tone: {
      neutral: ['font-mono', 'text-content-secondary'],
      info: ['bg-info/20', 'border-info/30', intentText.info],
    },
  },
  compoundVariants: [
    { variant: 'chip', tone: 'neutral', class: ['bg-surface', 'border-stroke-subtle'] },
    {
      variant: 'keycap',
      tone: 'neutral',
      class: [
        'border-stroke',
        'bg-gradient-to-b from-surface-elevated to-surface',
        'shadow-[0_1px_0_1px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]',
      ],
    },
  ],
  defaultVariants: {
    variant: 'chip',
    tone: 'neutral',
  },
});

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Key text: 'Enter', 'Esc', '⌘Z', 'Shift'.
   */
  children: ReactNode;
  /**
   * Visual tone. `neutral` is a mono chip on surface background;
   * `info` tints the chip for info-colored banners.
   *
   * @default 'neutral'
   */
  tone?: 'neutral' | 'info';
  /**
   * `chip` sits inline in a sentence or hint. `keycap` is the raised key used
   * in shortcut lists, such as the help dialog and the command palette.
   *
   * @default 'chip'
   */
  variant?: 'chip' | 'keycap';
}

/**
 * Keyboard-key chip rendered as a semantic `<kbd>` element.
 *
 * Key sequences are caller compositions of multiple chips plus separators.
 *
 * @example
 * <Kbd>Enter</Kbd>
 *
 * @example
 * // Inside an info banner
 * <Kbd tone="info">Esc</Kbd>
 *
 * @example
 * // Sequence
 * <span>
 *   <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
 * </span>
 */
export const Kbd = forwardRef<HTMLElement, KbdProps>(
  ({ tone = 'neutral', variant = 'chip', className, children, ...props }, ref) => {
    return (
      <kbd ref={ref} className={cn(kbdVariants({ variant, tone }), className)} {...props}>
        {children}
      </kbd>
    );
  }
);

Kbd.displayName = 'Kbd';
