import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type PlusIconProps = Omit<IconProps, 'children'>;

/**
 * Plus/Add icon.
 * Used for add actions, increment buttons, and creation.
 *
 * @example
 * <Button leftIcon={<PlusIcon size="sm" />}>Add Item</Button>
 */
export const PlusIcon = forwardRef<SVGSVGElement, PlusIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
));

PlusIcon.displayName = 'PlusIcon';
