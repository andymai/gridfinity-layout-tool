import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type ArrowLeftIconProps = Omit<IconProps, 'children'>;

/**
 * Left-pointing arrow icon.
 * Commonly used for back navigation.
 *
 * @example
 * <ArrowLeftIcon size="sm" />
 */
export const ArrowLeftIcon = forwardRef<SVGSVGElement, ArrowLeftIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </Icon>
));

ArrowLeftIcon.displayName = 'ArrowLeftIcon';
