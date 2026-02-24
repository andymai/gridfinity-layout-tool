import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type MagnetIconProps = Omit<IconProps, 'children'>;

/**
 * Magnet (horseshoe) icon.
 * Used for magnet hole feature sections.
 *
 * @example
 * <MagnetIcon size="sm" />
 */
export const MagnetIcon = forwardRef<SVGSVGElement, MagnetIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="M6 15V9a6 6 0 0 1 12 0v6" />
    <line x1="6" y1="15" x2="6" y2="19" />
    <line x1="18" y1="15" x2="18" y2="19" />
    <line x1="2" y1="15" x2="10" y2="15" />
    <line x1="14" y1="15" x2="22" y2="15" />
  </Icon>
));

MagnetIcon.displayName = 'MagnetIcon';
