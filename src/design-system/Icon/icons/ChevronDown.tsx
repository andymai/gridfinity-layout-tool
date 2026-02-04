import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type ChevronDownIconProps = Omit<IconProps, 'children'>;

/**
 * Downward-pointing chevron icon.
 * Commonly used for dropdowns, collapsible sections, and expansion indicators.
 *
 * @example
 * <ChevronDownIcon size="sm" />
 *
 * @example
 * // Rotated for collapsed state
 * <ChevronDownIcon className="-rotate-90" />
 */
export const ChevronDownIcon = forwardRef<SVGSVGElement, ChevronDownIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <polyline points="6 9 12 15 18 9" />
  </Icon>
));

ChevronDownIcon.displayName = 'ChevronDownIcon';
