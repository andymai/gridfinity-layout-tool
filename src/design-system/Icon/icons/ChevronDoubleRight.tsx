import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type ChevronDoubleRightIconProps = Omit<IconProps, 'children'>;

/**
 * Double chevron pointing right. Used for collapse/expand affordances on
 * side panels docked to the app's left edge.
 */
export const ChevronDoubleRightIcon = forwardRef<SVGSVGElement, ChevronDoubleRightIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <polyline points="6 17 11 12 6 7" />
      <polyline points="13 17 18 12 13 7" />
    </Icon>
  )
);

ChevronDoubleRightIcon.displayName = 'ChevronDoubleRightIcon';
