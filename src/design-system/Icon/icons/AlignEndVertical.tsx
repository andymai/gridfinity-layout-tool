import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlignEndVerticalIconProps = Omit<IconProps, 'children'>;

/**
 * Align right edges (Lucide `align-end-vertical`).
 * Cutout-editor selection alignment.
 *
 * @example
 * <AlignEndVerticalIcon size="sm" />
 */
export const AlignEndVerticalIcon = forwardRef<SVGSVGElement, AlignEndVerticalIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <rect width="16" height="6" x="2" y="4" rx="2" />
      <rect width="9" height="6" x="9" y="14" rx="2" />
      <path d="M22 22V2" />
    </Icon>
  )
);

AlignEndVerticalIcon.displayName = 'AlignEndVerticalIcon';
