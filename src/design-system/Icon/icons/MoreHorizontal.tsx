import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type MoreHorizontalIconProps = Omit<IconProps, 'children'>;

/**
 * Horizontal ellipsis — marks an overflow menu of secondary actions.
 */
export const MoreHorizontalIcon = forwardRef<SVGSVGElement, MoreHorizontalIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </Icon>
  )
);

MoreHorizontalIcon.displayName = 'MoreHorizontalIcon';
