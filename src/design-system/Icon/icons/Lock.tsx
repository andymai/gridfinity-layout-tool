import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type LockIconProps = Omit<IconProps, 'children'>;

/**
 * Closed padlock icon.
 * Used for the bin size lock.
 *
 * @example
 * <LockIcon size="sm" />
 */
export const LockIcon = forwardRef<SVGSVGElement, LockIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M7 10V7a5 5 0 0 1 10 0v3" />
  </Icon>
));

LockIcon.displayName = 'LockIcon';
