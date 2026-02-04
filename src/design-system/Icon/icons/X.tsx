import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type XIconProps = Omit<IconProps, 'children'>;

/**
 * X/Close icon.
 * Used for close buttons, dismiss actions, and cancellation.
 *
 * @example
 * <Button iconOnly aria-label="Close">
 *   <XIcon size="sm" />
 * </Button>
 */
export const XIcon = forwardRef<SVGSVGElement, XIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
));

XIcon.displayName = 'XIcon';
