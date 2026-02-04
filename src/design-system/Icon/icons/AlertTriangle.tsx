import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlertTriangleIconProps = Omit<IconProps, 'children'>;

/**
 * Warning/Alert triangle icon.
 * Used for error states, warnings, and important notices.
 *
 * @example
 * <AlertTriangleIcon size="md" className="text-warning" />
 */
export const AlertTriangleIcon = forwardRef<SVGSVGElement, AlertTriangleIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Icon>
));

AlertTriangleIcon.displayName = 'AlertTriangleIcon';
