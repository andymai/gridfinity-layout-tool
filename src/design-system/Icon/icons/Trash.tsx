import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type TrashIconProps = Omit<IconProps, 'children'>;

/**
 * Trash/Delete icon.
 * Used for destructive delete actions.
 *
 * @example
 * <Button variant="danger" leftIcon={<TrashIcon size="sm" />}>
 *   Delete
 * </Button>
 */
export const TrashIcon = forwardRef<SVGSVGElement, TrashIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </Icon>
));

TrashIcon.displayName = 'TrashIcon';
