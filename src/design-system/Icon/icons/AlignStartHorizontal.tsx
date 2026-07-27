import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlignStartHorizontalIconProps = Omit<IconProps, 'children'>;

/**
 * Align top edges (Lucide `align-start-horizontal`).
 * Cutout-editor selection alignment.
 *
 * @example
 * <AlignStartHorizontalIcon size="sm" />
 */
export const AlignStartHorizontalIcon = forwardRef<SVGSVGElement, AlignStartHorizontalIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <rect width="6" height="16" x="4" y="6" rx="2" />
      <rect width="6" height="9" x="14" y="6" rx="2" />
      <path d="M22 2H2" />
    </Icon>
  )
);

AlignStartHorizontalIcon.displayName = 'AlignStartHorizontalIcon';
