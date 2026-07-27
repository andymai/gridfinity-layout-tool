import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlignHorizontalDistributeCenterIconProps = Omit<IconProps, 'children'>;

/**
 * Distribute horizontally by centre (Lucide `align-horizontal-distribute-center`).
 * Cutout-editor selection distribution.
 *
 * @example
 * <AlignHorizontalDistributeCenterIcon size="sm" />
 */
export const AlignHorizontalDistributeCenterIcon = forwardRef<
  SVGSVGElement,
  AlignHorizontalDistributeCenterIconProps
>((props, ref) => (
  <Icon ref={ref} {...props}>
    <rect width="6" height="14" x="4" y="5" rx="2" />
    <rect width="6" height="10" x="14" y="7" rx="2" />
    <path d="M17 22v-5" />
    <path d="M17 7V2" />
    <path d="M7 22v-3" />
    <path d="M7 5V2" />
  </Icon>
));

AlignHorizontalDistributeCenterIcon.displayName = 'AlignHorizontalDistributeCenterIcon';
