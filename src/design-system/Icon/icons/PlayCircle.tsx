import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type PlayCircleIconProps = Omit<IconProps, 'children'>;

/**
 * Play triangle in a circle.
 * Marks a control that opens a short clip.
 *
 * @example
 * <PlayCircleIcon size="xs" />
 */
export const PlayCircleIcon = forwardRef<SVGSVGElement, PlayCircleIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" />
  </Icon>
));

PlayCircleIcon.displayName = 'PlayCircleIcon';
