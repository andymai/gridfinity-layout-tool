/**
 * Tests for RotationHandle component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RotationHandle } from './RotationHandle';
import type { Cutout } from '@/features/bin-designer/types';

describe('RotationHandle', () => {
  const mockCutout: Cutout = {
    id: 'test-cutout',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };

  const defaultProps = {
    cutout: mockCutout,
    scale: 2,
    binDepth: 80,
    onRotateStart: vi.fn(),
  };

  it('renders handle circle and connector line', () => {
    const { container } = render(
      <svg>
        <RotationHandle {...defaultProps} />
      </svg>
    );

    const circle = container.querySelector('circle');
    const line = container.querySelector('line');

    expect(circle).toBeInTheDocument();
    expect(line).toBeInTheDocument();
  });

  it('positions handle above cutout center', () => {
    const { container } = render(
      <svg>
        <RotationHandle {...defaultProps} />
      </svg>
    );

    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();

    // Center: (10 + 20/2, 10 + 15/2) = (20, 17.5) mm
    // SVG: (20 * 2, (80 - 17.5) * 2) = (40, 125) px
    // Handle Y: 125 - (15 * 2 / 2) - 15 = 125 - 15 - 15 = 95 px
    const cx = circle?.getAttribute('cx');
    const cy = circle?.getAttribute('cy');
    expect(cx).toBe('40');
    expect(cy).toBe('95');
  });

  it('fires onRotateStart on pointer down', () => {
    const onRotateStart = vi.fn();
    const { container } = render(
      <svg>
        <RotationHandle {...defaultProps} onRotateStart={onRotateStart} />
      </svg>
    );

    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();

    // Mock getBoundingClientRect for the SVG parent
    const mockGetBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 200,
      height: 160,
      right: 200,
      bottom: 160,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    const svg = circle?.closest('svg');
    if (svg) {
      svg.getBoundingClientRect = mockGetBoundingClientRect;
    }

    circle?.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 40,
        clientY: 95,
      })
    );

    expect(onRotateStart).toHaveBeenCalledWith('test-cutout', expect.any(Number));
  });
});
