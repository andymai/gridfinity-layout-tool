import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

const colorSwatchVariants = cva(['inline-block', 'shrink-0', 'border', 'border-stroke-subtle'], {
  variants: {
    shape: {
      dot: 'rounded-full',
      square: 'rounded-sm',
      tile: 'rounded-lg',
    },
    size: {
      sm: 'w-2.5 h-2.5',
      md: 'w-3.5 h-3.5',
      lg: 'w-4 h-4',
      xl: 'w-10 h-10',
    },
  },
  defaultVariants: {
    shape: 'dot',
    size: 'sm',
  },
});

type ColorSwatchVariantProps = VariantProps<typeof colorSwatchVariants>;

export interface ColorSwatchProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>, ColorSwatchVariantProps {
  /**
   * CSS color. Falls back to `fallbackColor` when undefined/null.
   */
  color: string | null | undefined;
  /**
   * Fallback color applied when `color` is absent. Callers pass their
   * domain default (e.g. DEFAULT_CATEGORY_COLOR).
   *
   * @default undefined — when both color and fallback are absent, renders a neutral placeholder
   */
  fallbackColor?: string;
  /**
   * Swatch shape.
   *
   * @default 'dot'
   */
  shape?: 'dot' | 'square' | 'tile';
  /**
   * Swatch size.
   *
   * @default 'sm'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Accessible name when the swatch carries standalone meaning
   * (exposed as role="img"). Omit when decorative next to visible
   * text — the swatch is then aria-hidden.
   */
  'aria-label'?: string;
}

/**
 * Color indicator for categories and other color-coded entities.
 *
 * @example
 * // Decorative dot next to a category name
 * <ColorSwatch color={category.color} fallbackColor={DEFAULT_CATEGORY_COLOR} />
 *
 * @example
 * // Standalone meaning (accessible name)
 * <ColorSwatch color={category.color} aria-label={category.name} size="md" />
 *
 * @example
 * // Large tile indicator
 * <ColorSwatch color={activeColor} shape="tile" size="xl" />
 */
export const ColorSwatch = forwardRef<HTMLSpanElement, ColorSwatchProps>(
  (
    { color, fallbackColor, shape, size, className, style, 'aria-label': ariaLabel, ...props },
    ref
  ) => {
    const resolvedColor = color ?? fallbackColor;
    return (
      <span
        ref={ref}
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : 'true'}
        className={cn(
          colorSwatchVariants({ shape, size }),
          resolvedColor === undefined && 'bg-surface-hover',
          className
        )}
        style={resolvedColor === undefined ? style : { backgroundColor: resolvedColor, ...style }}
        {...props}
      />
    );
  }
);

ColorSwatch.displayName = 'ColorSwatch';
