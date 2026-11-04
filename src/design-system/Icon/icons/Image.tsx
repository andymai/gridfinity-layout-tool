import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type ImageIconProps = Omit<IconProps, 'children'>;

export const ImageIcon = forwardRef<SVGSVGElement, ImageIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </Icon>
));

ImageIcon.displayName = 'ImageIcon';
