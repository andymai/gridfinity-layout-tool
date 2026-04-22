import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type RulerIconProps = Omit<IconProps, 'children'>;

/**
 * Ruler glyph.
 * Used to annotate real-world mm dimension readouts.
 *
 * Uses a thinner 1.5 stroke (vs. the Icon default of 2) to match the small
 * sizes this icon is rendered at and keep the tick-mark detail legible.
 *
 * @example
 * <RulerIcon size="xs" className="text-content-tertiary" />
 */
export const RulerIcon = forwardRef<SVGSVGElement, RulerIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path strokeWidth={1.5} d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2" />
  </Icon>
));

RulerIcon.displayName = 'RulerIcon';
