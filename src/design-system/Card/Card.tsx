import { createElement, forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { activePress, focusRing, interactiveTransition } from '../variants';

const cardVariants = cva('text-left', {
  variants: {
    surface: {
      surface: 'bg-surface',
      elevated: 'bg-surface-elevated',
      secondary: 'bg-surface-secondary',
    },
    border: {
      subtle: 'border border-stroke-subtle',
      default: 'border border-stroke',
      dashed: 'border-2 border-dashed border-stroke',
      none: 'border-none',
    },
    padding: {
      none: 'p-0',
      sm: 'p-2',
      md: 'p-3',
      lg: 'p-4',
    },
    radius: {
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
    },
  },
  defaultVariants: {
    surface: 'elevated',
    border: 'subtle',
    padding: 'md',
    radius: 'lg',
  },
});

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Element to render. Pass 'button' for fully-clickable cards or 'li' for list items.
   * @default 'div'
   */
  as?: 'div' | 'button' | 'li' | 'section';

  /**
   * Background surface token.
   * @default 'elevated'
   */
  surface?: 'surface' | 'elevated' | 'secondary';

  /**
   * Border treatment. 'dashed' renders a 2px dashed border for CTA cards.
   * @default 'subtle'
   */
  border?: 'subtle' | 'default' | 'dashed' | 'none';

  /**
   * Inner padding scale.
   * @default 'md'
   */
  padding?: 'none' | 'sm' | 'md' | 'lg';

  /**
   * Corner radius scale.
   * @default 'lg'
   */
  radius?: 'md' | 'lg' | 'xl';

  /**
   * Adds hover, focus ring, and press affordances for clickable cards.
   */
  interactive?: boolean;

  /**
   * Applies the selected accent treatment.
   */
  selected?: boolean;

  /**
   * Selected accent style: 'border' tints the full border, 'rail' draws a left accent rail.
   * @default 'border'
   */
  selectedStyle?: 'border' | 'rail';

  /**
   * Card content.
   */
  children: ReactNode;
}

/**
 * Surface container for list items, info boxes, and status cards.
 *
 * @example
 * <Card>Layout details</Card>
 *
 * @example
 * // Fully-clickable card
 * <Card as="button" interactive onClick={handleOpen}>
 *   Open layout
 * </Card>
 *
 * @example
 * // Dashed CTA card
 * <Card as="button" border="dashed" interactive>
 *   New layout
 * </Card>
 *
 * @example
 * // Selected list item with accent rail
 * <Card as="li" selected selectedStyle="rail">
 *   Layer 2
 * </Card>
 */
export const Card = forwardRef<HTMLElement, CardProps>(
  (
    {
      as = 'div',
      surface = 'elevated',
      border = 'subtle',
      padding = 'md',
      radius = 'lg',
      interactive,
      selected,
      selectedStyle = 'border',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return createElement(
      as,
      {
        ...props,
        ref,
        type: as === 'button' ? 'button' : undefined,
        className: cn(
          cardVariants({ surface, border, padding, radius }),
          interactive && [
            interactiveTransition,
            activePress,
            ...focusRing,
            'hover:bg-surface-hover hover:border-stroke',
          ],
          selected &&
            (selectedStyle === 'rail'
              ? 'border-l-2 border-l-accent'
              : 'border-accent bg-surface-hover'),
          className
        ),
      },
      children
    );
  }
);

Card.displayName = 'Card';
