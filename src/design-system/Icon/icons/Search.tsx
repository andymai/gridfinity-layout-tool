import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type SearchIconProps = Omit<IconProps, 'children'>;

/**
 * Magnifying glass/Search icon.
 * Used for search inputs and find functionality.
 *
 * @example
 * <Input leftIcon={<SearchIcon size="sm" />} placeholder="Search..." />
 */
export const SearchIcon = forwardRef<SVGSVGElement, SearchIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Icon>
));

SearchIcon.displayName = 'SearchIcon';
