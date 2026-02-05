import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarqueeBox } from './MarqueeBox';

const renderMarquee = (props: React.ComponentProps<typeof MarqueeBox>) =>
  render(
    <svg>
      <MarqueeBox {...props} />
    </svg>
  );

describe('MarqueeBox', () => {
  it('renders a rect element', () => {
    const { container } = renderMarquee({ x: 10, y: 20, width: 50, height: 30 });
    const rect = container.querySelector('rect');
    expect(rect).not.toBeNull();
  });

  it('positions correctly with positive dimensions', () => {
    const { container } = renderMarquee({ x: 10, y: 20, width: 50, height: 30 });
    const rect = container.querySelector('rect');

    expect(rect?.getAttribute('x')).toBe('10');
    expect(rect?.getAttribute('y')).toBe('20');
    expect(rect?.getAttribute('width')).toBe('50');
    expect(rect?.getAttribute('height')).toBe('30');
  });

  it('normalizes negative width and height', () => {
    const { container } = renderMarquee({ x: 60, y: 50, width: -50, height: -30 });
    const rect = container.querySelector('rect');

    // Math.min(60, 60 + (-50)) = Math.min(60, 10) = 10
    expect(rect?.getAttribute('x')).toBe('10');
    // Math.min(50, 50 + (-30)) = Math.min(50, 20) = 20
    expect(rect?.getAttribute('y')).toBe('20');
    expect(rect?.getAttribute('width')).toBe('50');
    expect(rect?.getAttribute('height')).toBe('30');
  });

  it('has dashed stroke and semi-transparent fill', () => {
    const { container } = renderMarquee({ x: 0, y: 0, width: 10, height: 10 });
    const rect = container.querySelector('rect');

    expect(rect?.getAttribute('stroke-dasharray')).toBe('4 2');
    expect(rect?.getAttribute('fill-opacity')).toBe('0.1');
  });

  it('does not capture pointer events', () => {
    const { container } = renderMarquee({ x: 0, y: 0, width: 10, height: 10 });
    const rect = container.querySelector('rect');

    expect(rect?.getAttribute('pointer-events')).toBe('none');
  });
});
