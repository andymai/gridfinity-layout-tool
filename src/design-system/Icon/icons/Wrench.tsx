import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type WrenchIconProps = Omit<IconProps, 'children'>;

export const WrenchIcon = forwardRef<SVGSVGElement, WrenchIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="M15.8 2.7a5.1 5.1 0 0 0-4.6 6.9l-8.1 8.1a2.2 2.2 0 0 0 3.2 3.2l8.1-8.1a5.1 5.1 0 0 0 6.9-4.6l-3.3 1.7-2.7-.7-.7-2.7z" />
  </Icon>
));

WrenchIcon.displayName = 'WrenchIcon';
