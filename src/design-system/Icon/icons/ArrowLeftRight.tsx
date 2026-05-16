import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type ArrowLeftRightIconProps = Omit<IconProps, 'children'>;

/**
 * Horizontal double-headed swap arrow (Lucide `arrow-left-right`).
 * Used for "swap A ↔ B" affordances.
 *
 * @example
 * <ArrowLeftRightIcon size="sm" />
 */
export const ArrowLeftRightIcon = forwardRef<SVGSVGElement, ArrowLeftRightIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </Icon>
  )
);

ArrowLeftRightIcon.displayName = 'ArrowLeftRightIcon';
