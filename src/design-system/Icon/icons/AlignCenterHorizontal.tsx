import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlignCenterHorizontalIconProps = Omit<IconProps, 'children'>;

/**
 * Align vertical centres (Lucide `align-center-horizontal`).
 * Cutout-editor selection alignment.
 *
 * @example
 * <AlignCenterHorizontalIcon size="sm" />
 */
export const AlignCenterHorizontalIcon = forwardRef<SVGSVGElement, AlignCenterHorizontalIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <path d="M2 12h20" />
      <path d="M10 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
      <path d="M10 8V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4" />
      <path d="M20 16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1" />
      <path d="M14 8V7c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v1" />
    </Icon>
  )
);

AlignCenterHorizontalIcon.displayName = 'AlignCenterHorizontalIcon';
