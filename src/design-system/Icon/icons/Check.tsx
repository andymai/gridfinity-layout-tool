import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type CheckIconProps = Omit<IconProps, 'children'>;

/**
 * Checkmark icon.
 * Used for success states, checkboxes, and confirmations.
 *
 * @example
 * <CheckIcon size="sm" className="text-success" />
 */
export const CheckIcon = forwardRef<SVGSVGElement, CheckIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <polyline points="20 6 9 17 4 12" />
  </Icon>
));

CheckIcon.displayName = 'CheckIcon';
