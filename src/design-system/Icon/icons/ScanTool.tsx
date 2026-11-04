import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type ScanToolIconProps = Omit<IconProps, 'children'>;

/**
 * Viewfinder glyph: four corner brackets around a scan line.
 * Marks every "Scan a tool" entry, whichever device the photo comes from.
 *
 * @example
 * <ScanToolIcon size="sm" />
 */
export const ScanToolIcon = forwardRef<SVGSVGElement, ScanToolIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M7 12h10" />
  </Icon>
));

ScanToolIcon.displayName = 'ScanToolIcon';
