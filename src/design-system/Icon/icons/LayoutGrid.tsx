import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type LayoutGridIconProps = Omit<IconProps, 'children'>;

/**
 * Layout grid icon with split divisions.
 * Used for split/tiling sections.
 *
 * @example
 * <LayoutGridIcon size="sm" />
 */
export const LayoutGridIcon = forwardRef<SVGSVGElement, LayoutGridIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </Icon>
));

LayoutGridIcon.displayName = 'LayoutGridIcon';
