import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type MinusIconProps = Omit<IconProps, 'children'>;

/**
 * Minus/Remove icon.
 * Used for decrement buttons and removal actions.
 *
 * @example
 * <Button iconOnly aria-label="Decrease">
 *   <MinusIcon size="sm" />
 * </Button>
 */
export const MinusIcon = forwardRef<SVGSVGElement, MinusIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
));

MinusIcon.displayName = 'MinusIcon';
