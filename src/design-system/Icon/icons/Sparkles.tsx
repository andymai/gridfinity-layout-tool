import { forwardRef } from 'react';
import { Icon, type IconProps } from '../Icon';

export type SparklesIconProps = Omit<IconProps, 'children'>;

/**
 * Sparkles — marks generative / suggested actions.
 */
export const SparklesIcon = forwardRef<SVGSVGElement, SparklesIconProps>((props, ref) => (
  <Icon ref={ref} {...props}>
    <path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8L12 3z" />
    <path d="M19 14l.9 2.4L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.6L19 14z" />
    <path d="M5 14l.9 2.4L8 17l-2.1.6L5 20l-.9-2.4L2 17l2.1-.6L5 14z" />
  </Icon>
));

SparklesIcon.displayName = 'SparklesIcon';
