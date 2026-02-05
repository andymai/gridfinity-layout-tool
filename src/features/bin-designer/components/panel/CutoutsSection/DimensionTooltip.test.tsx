import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DimensionTooltip } from './DimensionTooltip';

describe('DimensionTooltip', () => {
  it('shows width×depth for resize type', () => {
    const { container } = render(
      <svg>
        <DimensionTooltip type="resize" width={15.6} depth={20.3} svgX={100} svgY={50} />
      </svg>
    );

    const text = container.querySelector('text');
    expect(text?.textContent).toBe('15.6×20.3');
  });

  it('shows X,Y for drag type', () => {
    const { container } = render(
      <svg>
        <DimensionTooltip type="drag" x={12.4} y={8.7} svgX={100} svgY={50} />
      </svg>
    );

    const text = container.querySelector('text');
    expect(text?.textContent).toBe('12.4, 8.7');
  });

  it('rounds values to 1 decimal place', () => {
    const { container } = render(
      <svg>
        <DimensionTooltip type="resize" width={15.678} depth={20.123} svgX={100} svgY={50} />
      </svg>
    );

    const text = container.querySelector('text');
    expect(text?.textContent).toBe('15.7×20.1');
  });

  it('renders at correct position', () => {
    const { container } = render(
      <svg>
        <DimensionTooltip type="drag" x={10} y={20} svgX={100} svgY={150} />
      </svg>
    );

    const rect = container.querySelector('rect');
    // tooltipX = svgX + 5 = 105
    expect(rect?.getAttribute('x')).toBe('105');
    // tooltipY = svgY - 10 - 18 = 122
    expect(rect?.getAttribute('y')).toBe('122');
  });

  it('renders background rect and text', () => {
    const { container } = render(
      <svg>
        <DimensionTooltip type="drag" x={10} y={20} svgX={100} svgY={50} />
      </svg>
    );

    const rect = container.querySelector('rect');
    const text = container.querySelector('text');

    expect(rect).not.toBeNull();
    expect(text).not.toBeNull();
    expect(rect?.getAttribute('fill')).toBe('var(--color-surface-elevated)');
    expect(rect?.getAttribute('rx')).toBe('3');
  });
});
