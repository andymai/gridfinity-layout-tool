import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { intentText } from '../variants';

const kbdVariants = cva(
  ['inline-block', 'px-1.5 py-0.5', 'rounded border', 'text-[10px] leading-none', 'align-middle'],
  {
    variants: {
      tone: {
        neutral: ['bg-surface', 'border-stroke-subtle', 'text-content-secondary', 'font-mono'],
        info: ['bg-info/20', 'border-info/30', intentText.info],
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

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
  ({ tone = 'neutral', className, children, ...props }, ref) => {
    return (
      <kbd ref={ref} className={cn(kbdVariants({ tone }), className)} {...props}>
        {children}
      </kbd>
    );
  }
);

Kbd.displayName = 'Kbd';
