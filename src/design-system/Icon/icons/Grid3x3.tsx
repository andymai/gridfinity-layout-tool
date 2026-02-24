import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type Grid3x3IconProps = Omit<IconProps, 'children'>;

/**
 * 3x3 grid icon.
 * Used for grid-related sections and dimension displays.
 *
 * @example
 * <Grid3x3Icon size="sm" />
 */
export const Grid3x3Icon = forwardRef<SVGSVGElement, Grid3x3IconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </Icon>
));

Grid3x3Icon.displayName = 'Grid3x3Icon';
