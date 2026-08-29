import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type ChevronDoubleLeftIconProps = Omit<IconProps, 'children'>;

/**
 * Double chevron pointing left. Used for collapse/expand affordances on
 * side panels docked to the app's right edge.
 */
export const ChevronDoubleLeftIcon = forwardRef<SVGSVGElement, ChevronDoubleLeftIconProps>(
  (props, ref) => (
    <Icon ref={ref} {...props}>
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </Icon>
  )
);

ChevronDoubleLeftIcon.displayName = 'ChevronDoubleLeftIcon';
