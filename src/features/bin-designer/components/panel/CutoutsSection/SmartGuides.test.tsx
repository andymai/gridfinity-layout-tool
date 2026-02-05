import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SmartGuides } from './SmartGuides';
import type { AlignmentGuide } from './geometry';

describe('SmartGuides', () => {
  const defaultProps = {
    scale: 2,
    canvasWidth: 200,
    canvasHeight: 150,
    binDepth: 75,
  };

  it('renders nothing when no guides', () => {
    const { container } = render(
      <svg>
        <SmartGuides guides={[]} {...defaultProps} />
      </svg>
    );
    expect(container.querySelector('g')).toBeNull();
  });

  it('renders vertical line for x-axis guide', () => {
    const guides: AlignmentGuide[] = [{ axis: 'x', position: 10 }];
    const { container } = render(
      <svg>
        <SmartGuides guides={guides} {...defaultProps} />
      </svg>
    );

    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    expect(line?.getAttribute('x1')).toBe('20'); // 10 * 2 (scale)
    expect(line?.getAttribute('x2')).toBe('20');
    expect(line?.getAttribute('y1')).toBe('0');
    expect(line?.getAttribute('y2')).toBe('150'); // canvasHeight
  });

  it('renders horizontal line for y-axis guide', () => {
    const guides: AlignmentGuide[] = [{ axis: 'y', position: 25 }];
    const { container } = render(
      <svg>
        <SmartGuides guides={guides} {...defaultProps} />
      </svg>
    );

    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    // Y inverted: (75 - 25) * 2 = 100
    expect(line?.getAttribute('y1')).toBe('100');
    expect(line?.getAttribute('y2')).toBe('100');
    expect(line?.getAttribute('x1')).toBe('0');
    expect(line?.getAttribute('x2')).toBe('200'); // canvasWidth
  });

  it('renders multiple guides', () => {
    const guides: AlignmentGuide[] = [
      { axis: 'x', position: 10 },
      { axis: 'y', position: 20 },
      { axis: 'x', position: 30 },
    ];
    const { container } = render(
      <svg>
        <SmartGuides guides={guides} {...defaultProps} />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(3);
  });

  it('correct positioning with scale factor', () => {
    const guides: AlignmentGuide[] = [{ axis: 'x', position: 15 }];
    const { container } = render(
      <svg>
        <SmartGuides guides={guides} {...defaultProps} scale={3} />
      </svg>
    );

    const line = container.querySelector('line');
    expect(line?.getAttribute('x1')).toBe('45'); // 15 * 3
  });
});
