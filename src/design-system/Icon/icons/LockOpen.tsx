import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type LockOpenIconProps = Omit<IconProps, 'children'>;

/**
 * Open padlock icon — the released counterpart of {@link LockIcon}.
 *
 * @example
 * <LockOpenIcon size="sm" />
 */
export const LockOpenIcon = forwardRef<SVGSVGElement, LockOpenIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M7 10V7a5 5 0 0 1 9.9-1" />
  </Icon>
));

LockOpenIcon.displayName = 'LockOpenIcon';
