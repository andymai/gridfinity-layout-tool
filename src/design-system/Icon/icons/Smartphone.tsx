import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type SmartphoneIconProps = Omit<IconProps, 'children'>;

/**
 * Phone glyph.
 *
 * @example
 * <SmartphoneIcon size="md" />
 */
export const SmartphoneIcon = forwardRef<SVGSVGElement, SmartphoneIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M11 18h2" />
  </Icon>
));

SmartphoneIcon.displayName = 'SmartphoneIcon';
