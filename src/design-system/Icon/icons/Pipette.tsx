import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type PipetteIconProps = Omit<IconProps, 'children'>;

/**
 * Eyedropper / color picker. Marks the affordance for opening the
 * platform-native color wheel.
 */
export const PipetteIcon = forwardRef<SVGSVGElement, PipetteIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="m2 22 1-1h3l9-9" />
    <path d="M3 21v-3l9-9" />
    <path d="m15 6 3.4-3.4a2.121 2.121 0 1 1 3 3L18 9l.4.4a2.121 2.121 0 1 1-3 3l-3.8-3.8a2.121 2.121 0 1 1 3-3Z" />
  </Icon>
));

PipetteIcon.displayName = 'PipetteIcon';
