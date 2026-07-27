import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlignEndHorizontalIconProps = Omit<IconProps, 'children'>;

/**
 * Align bottom edges (Lucide `align-end-horizontal`).
 * Cutout-editor selection alignment.
 *
 * @example
 * <AlignEndHorizontalIcon size="sm" />
 */
export const AlignEndHorizontalIcon = forwardRef<SVGSVGElement, AlignEndHorizontalIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <rect width="6" height="16" x="4" y="2" rx="2" />
      <rect width="6" height="9" x="14" y="9" rx="2" />
      <path d="M22 22H2" />
    </Icon>
  )
);

AlignEndHorizontalIcon.displayName = 'AlignEndHorizontalIcon';
