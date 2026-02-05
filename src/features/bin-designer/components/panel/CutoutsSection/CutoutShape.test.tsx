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
    isDragging: false,
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

  it('renders an ellipse element for circle cutout', () => {
    const cutout = createCutout({ shape: 'circle', width: 20, depth: 15 });
    const { container } = renderShape({ cutout, scale: 2, binDepth: 50 });
    const ellipse = container.querySelector('ellipse');
    expect(ellipse).not.toBeNull();
    expect(container.querySelector('rect')).toBeNull();
  });

  it('positions ellipse correctly', () => {
    const cutout = createCutout({ shape: 'circle', x: 10, y: 10, width: 20, depth: 16 });
    const { container } = renderShape({ cutout, scale: 2, binDepth: 50 });
    const ellipse = container.querySelector('ellipse');

    // cx = (cutout.x + cutout.width / 2) * scale = (10 + 10) * 2 = 40
    expect(ellipse?.getAttribute('cx')).toBe('40');
    // cy = (binDepth - cutout.y - cutout.depth / 2) * scale = (50 - 10 - 8) * 2 = 64
    expect(ellipse?.getAttribute('cy')).toBe('64');
    // rx = (cutout.width / 2) * scale = 10 * 2 = 20
    expect(ellipse?.getAttribute('rx')).toBe('20');
    // ry = (cutout.depth / 2) * scale = 8 * 2 = 16
    expect(ellipse?.getAttribute('ry')).toBe('16');
  });

  it('uses accent stroke when selected', () => {
    const { container } = renderShape({ isSelected: true });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke')).toBe('var(--color-accent)');
    expect(rect?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('uses subtle stroke when not selected', () => {
    const { container } = renderShape({ isSelected: false });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke')).toBe('var(--color-stroke-subtle)');
    expect(rect?.getAttribute('stroke-width')).toBe('1.5');
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

  it('reduces opacity when isDragging is true', () => {
    const { container } = renderShape({ isDragging: true });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('fill-opacity')).toBe('0.5');
  });

  it('uses selected opacity when selected but not dragging', () => {
    const { container } = renderShape({ isSelected: true, isDragging: false });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('fill-opacity')).toBe('0.3');
  });

  it('uses unselected opacity when not selected and not dragging', () => {
    const { container } = renderShape({ isSelected: false, isDragging: false });
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('fill-opacity')).toBe('0.15');
  });

  it('applies previewOverrides to rendered position', () => {
    const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 15 });
    const { container } = renderShape({
      cutout,
      previewOverrides: { x: 30, y: 20 },
      scale: 2,
      binDepth: 50,
    });
    const rect = container.querySelector('rect');

    // With preview: px = 30 * 2 = 60
    expect(rect?.getAttribute('x')).toBe('60');
    // py = (50 - 20 - 15) * 2 = 30
    expect(rect?.getAttribute('y')).toBe('30');
  });

  it('uses grab cursor when selected', () => {
    const { container } = renderShape({ isSelected: true });
    const rect = container.querySelector('rect');
    expect(rect?.style.cursor).toBe('grab');
  });

  it('uses pointer cursor when not selected', () => {
    const { container } = renderShape({ isSelected: false });
    const rect = container.querySelector('rect');
    expect(rect?.style.cursor).toBe('pointer');
  });
});
