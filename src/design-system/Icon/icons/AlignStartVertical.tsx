import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlignStartVerticalIconProps = Omit<IconProps, 'children'>;

/**
 * Align left edges (Lucide `align-start-vertical`).
 * Cutout-editor selection alignment.
 *
 * @example
 * <AlignStartVerticalIcon size="sm" />
 */
export const AlignStartVerticalIcon = forwardRef<SVGSVGElement, AlignStartVerticalIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <rect width="9" height="6" x="6" y="14" rx="2" />
      <rect width="16" height="6" x="6" y="4" rx="2" />
      <path d="M2 2v20" />
    </Icon>
  )
);

AlignStartVerticalIcon.displayName = 'AlignStartVerticalIcon';
