import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type AlignVerticalDistributeCenterIconProps = Omit<IconProps, 'children'>;

/**
 * Distribute vertically by centre (Lucide `align-vertical-distribute-center`).
 * Cutout-editor selection distribution.
 *
 * @example
 * <AlignVerticalDistributeCenterIcon size="sm" />
 */
export const AlignVerticalDistributeCenterIcon = forwardRef<
  SVGSVGElement,
  AlignVerticalDistributeCenterIconProps
>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="M22 17h-3" />
    <path d="M22 7h-5" />
    <path d="M5 17H2" />
    <path d="M7 7H2" />
    <rect width="14" height="6" x="5" y="14" rx="2" />
    <rect width="10" height="6" x="7" y="4" rx="2" />
  </Icon>
));

AlignVerticalDistributeCenterIcon.displayName = 'AlignVerticalDistributeCenterIcon';
