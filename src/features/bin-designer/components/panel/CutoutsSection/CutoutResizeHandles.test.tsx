import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutResizeHandles } from './CutoutResizeHandles';

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

const renderHandles = (props: Partial<React.ComponentProps<typeof CutoutResizeHandles>> = {}) => {
  const defaultProps = {
    cutout: createCutout(),
    scale: 2,
    binDepth: 50,
    onResizeStart: vi.fn(),
  };
  return render(
    <svg>
      <CutoutResizeHandles {...defaultProps} {...props} />
    </svg>
  );
};

describe('CutoutResizeHandles', () => {
  it('renders 8 handles for rectangle (4 corners + 4 edges)', () => {
    const { container } = renderHandles();
    const handles = container.querySelectorAll('[data-testid^="resize-handle-"]');
    expect(handles.length).toBe(8);
  });

  it('renders all 8 handle positions for rectangle', () => {
    const { getByTestId } = renderHandles();
    expect(getByTestId('resize-handle-nw')).toBeInTheDocument();
    expect(getByTestId('resize-handle-n')).toBeInTheDocument();
    expect(getByTestId('resize-handle-ne')).toBeInTheDocument();
    expect(getByTestId('resize-handle-e')).toBeInTheDocument();
    expect(getByTestId('resize-handle-se')).toBeInTheDocument();
    expect(getByTestId('resize-handle-s')).toBeInTheDocument();
    expect(getByTestId('resize-handle-sw')).toBeInTheDocument();
    expect(getByTestId('resize-handle-w')).toBeInTheDocument();
  });

  it('renders 8 handles for circle/ellipse', () => {
    const cutout = createCutout({ shape: 'circle', width: 20, depth: 20 });
    const { container } = renderHandles({ cutout });
    const handles = container.querySelectorAll('[data-testid^="resize-handle-"]');
    expect(handles.length).toBe(8);
  });

  it('positions rectangle corner handles correctly', () => {
    // cutout: x=10, y=10, width=20, depth=15, scale=2, binDepth=50
    // left = 10*2 = 20, right = 30*2 = 60
    // top = (50 - 10 - 15)*2 = 50, bottom = (50 - 10)*2 = 80
    const { getByTestId } = renderHandles();
    const nw = getByTestId('resize-handle-nw');
    // x = svgX - 3 = 20 - 3 = 17
    expect(nw.getAttribute('x')).toBe('17');
    // y = svgY - 3 = 50 - 3 = 47
    expect(nw.getAttribute('y')).toBe('47');

    const se = getByTestId('resize-handle-se');
    expect(se.getAttribute('x')).toBe('57'); // 60 - 3
    expect(se.getAttribute('y')).toBe('77'); // 80 - 3
  });

  it('positions edge midpoint handles correctly', () => {
    // midX = (20 + 60) / 2 = 40, midY = (50 + 80) / 2 = 65
    const { getByTestId } = renderHandles();
    const n = getByTestId('resize-handle-n');
    expect(n.getAttribute('x')).toBe('37'); // 40 - 3
    expect(n.getAttribute('y')).toBe('47'); // 50 - 3

    const e = getByTestId('resize-handle-e');
    expect(e.getAttribute('x')).toBe('57'); // 60 - 3
    expect(e.getAttribute('y')).toBe('62'); // 65 - 3
  });

  it('applies rotation transform when cutout is rotated', () => {
    const cutout = createCutout({ rotation: 45 });
    const { getByTestId } = renderHandles({ cutout });
    const group = getByTestId('resize-handles');
    const transform = group.getAttribute('transform');
    expect(transform).toContain('rotate(-45');
  });

  it('has no rotation transform when rotation is 0', () => {
    const { getByTestId } = renderHandles();
    const group = getByTestId('resize-handles');
    expect(group.getAttribute('transform')).toBeNull();
  });

  it('calls onResizeStart on handle pointer down', () => {
    const onResizeStart = vi.fn();
    const { getByTestId } = renderHandles({ onResizeStart });
    const handle = getByTestId('resize-handle-se');

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(onResizeStart).toHaveBeenCalledWith(
      'test-cutout',
      'se',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('has accent fill and white stroke', () => {
    const { getByTestId } = renderHandles();
    const handle = getByTestId('resize-handle-nw');
    expect(handle.getAttribute('fill')).toBe('var(--color-accent)');
    expect(handle.getAttribute('stroke')).toBe('white');
  });

  it('renders the handles group wrapper', () => {
    const { getByTestId } = renderHandles();
    expect(getByTestId('resize-handles')).toBeInTheDocument();
  });
});
