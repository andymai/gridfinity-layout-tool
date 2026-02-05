import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutShape } from './CutoutShape';

const createCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
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
  ...overrides,
});

const renderShape = (props: Partial<React.ComponentProps<typeof CutoutShape>> = {}) => {
  const defaultProps = {
    cutout: createCutout(),
    scale: 2,
    binDepth: 50,
    isSelected: false,
    isGrouped: false,
    onSelect: vi.fn(),
  };
  return render(
    <svg>
      <CutoutShape {...defaultProps} {...props} />
    </svg>
  );
};

describe('CutoutShape', () => {
  it('renders a rect element for rectangle cutout', () => {
    const { container } = renderShape();
    const rect = container.querySelector('rect');
    expect(rect).not.toBeNull();
  });

  it('positions rectangle correctly with scale and inverted Y', () => {
    const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 15 });
    const { container } = renderShape({ cutout, scale: 2, binDepth: 50 });
    const rect = container.querySelector('rect');

    // px = cutout.x * scale = 10 * 2 = 20
    expect(rect?.getAttribute('x')).toBe('20');
    // py = (binDepth - cutout.y - cutout.depth) * scale = (50 - 10 - 15) * 2 = 50
    expect(rect?.getAttribute('y')).toBe('50');
    // pw = cutout.width * scale = 20 * 2 = 40
    expect(rect?.getAttribute('width')).toBe('40');
    // ph = cutout.depth * scale = 15 * 2 = 30
    expect(rect?.getAttribute('height')).toBe('30');
  });

  it('applies corner radius to rectangle', () => {
    const cutout = createCutout({ cornerRadius: 3 });
    const { container } = renderShape({ cutout, scale: 2 });
    const rect = container.querySelector('rect');

    // cr = cornerRadius * scale = 3 * 2 = 6
    expect(rect?.getAttribute('rx')).toBe('6');
    expect(rect?.getAttribute('ry')).toBe('6');
  });

  it('renders a circle element for circle cutout', () => {
    const cutout = createCutout({ shape: 'circle', width: 20 });
    const { container } = renderShape({ cutout, scale: 2, binDepth: 50 });
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect(container.querySelector('rect')).toBeNull();
  });

  it('positions circle correctly', () => {
    const cutout = createCutout({ shape: 'circle', x: 10, y: 10, width: 20 });
    const { container } = renderShape({ cutout, scale: 2, binDepth: 50 });
    const circle = container.querySelector('circle');

    // cx = (cutout.x + cutout.width / 2) * scale = (10 + 10) * 2 = 40
    expect(circle?.getAttribute('cx')).toBe('40');
    // cy = (binDepth - cutout.y - cutout.width / 2) * scale = (50 - 10 - 10) * 2 = 60
    expect(circle?.getAttribute('cy')).toBe('60');
    // r = (cutout.width * scale) / 2 = (20 * 2) / 2 = 20
    expect(circle?.getAttribute('r')).toBe('20');
  });

  it('uses accent stroke when selected', () => {
    const { container } = renderShape({ isSelected: true });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke')).toBe('var(--color-accent)');
    expect(rect?.getAttribute('stroke-width')).toBe('2');
  });

  it('uses subtle stroke when not selected', () => {
    const { container } = renderShape({ isSelected: false });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke')).toBe('var(--color-stroke-subtle)');
    expect(rect?.getAttribute('stroke-width')).toBe('1');
  });

  it('uses dashed stroke when grouped', () => {
    const { container } = renderShape({ isGrouped: true });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke-dasharray')).toBe('4 2');
  });

  it('has no dashed stroke when not grouped', () => {
    const { container } = renderShape({ isGrouped: false });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('calls onSelect with id on pointer down', () => {
    const onSelect = vi.fn();
    const cutout = createCutout({ id: 'my-cutout' });
    const { container } = renderShape({ cutout, onSelect });
    const rect = container.querySelector('rect');

    rect?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('my-cutout', false);
  });
});
