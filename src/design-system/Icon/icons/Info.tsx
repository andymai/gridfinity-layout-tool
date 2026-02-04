import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type InfoIconProps = Omit<IconProps, 'children'>;

/**
 * Information circle icon.
 * Used for informational messages and help text.
 *
 * @example
 * <InfoIcon size="sm" className="text-info" />
 */
export const InfoIcon = forwardRef<SVGSVGElement, InfoIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </Icon>
));

InfoIcon.displayName = 'InfoIcon';
