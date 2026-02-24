import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type RotateCcwIconProps = Omit<IconProps, 'children'>;

/**
 * Counter-clockwise rotation arrow icon.
 * Used for reset/undo actions.
 *
 * @example
 * <RotateCcwIcon size="sm" />
 */
export const RotateCcwIcon = forwardRef<SVGSVGElement, RotateCcwIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </Icon>
));

RotateCcwIcon.displayName = 'RotateCcwIcon';
