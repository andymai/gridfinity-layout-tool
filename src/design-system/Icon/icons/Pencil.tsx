import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type PencilIconProps = Omit<IconProps, 'children'>;

/**
 * Pencil icon.
 * Used to signal inline editability (click-to-edit affordance).
 *
 * @example
 * <PencilIcon size="xs" className="text-content-tertiary" />
 */
export const PencilIcon = forwardRef<SVGSVGElement, PencilIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </Icon>
));

PencilIcon.displayName = 'PencilIcon';
