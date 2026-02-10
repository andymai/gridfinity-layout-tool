import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

const iconVariants = cva(['inline-block', 'flex-shrink-0'], {
  variants: {
    size: {
      xs: 'w-3.5 h-3.5',
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
      xl: 'w-8 h-8',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface IconProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'children'>, VariantProps<typeof iconVariants> {
  /**
   * The icon content (typically a path or group of paths).
   * Pass the SVG children directly.
   */
  children: React.ReactNode;

  /**
   * Accessible label. If provided, the icon is treated as meaningful content.
   * If omitted, the icon is decorative and hidden from screen readers.
   */
  label?: string;
}

/**
 * Base wrapper for SVG icons with consistent sizing and accessibility.
 *
 * For decorative icons (next to text), omit the label prop.
 * For meaningful icons (icon-only buttons), provide a label.
 *
 * @example
 * // Decorative icon next to text
 * <Button leftIcon={<Icon size="sm"><CheckPath /></Icon>}>
 *   Save
 * </Button>
 *
 * @example
 * // Meaningful icon with label
 * <Icon label="Success" size="lg">
 *   <CheckPath />
 * </Icon>
 *
 * @example
 * // Custom color via className
 * <Icon className="text-success" size="md">
 *   <CheckPath />
 * </Icon>
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ size, label, className, children, ...props }, ref) => {
    const isDecorative = !label;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(iconVariants({ size }), className)}
        aria-hidden={isDecorative}
        aria-label={label}
        role={label ? 'img' : undefined}
        {...props}
      >
        {children}
      </svg>
    );
  }
);

Icon.displayName = 'Icon';
