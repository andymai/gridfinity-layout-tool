import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { PenCanvas } from './PenCanvas';

const VERTS = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 },
];

function renderCanvas(overrides: Partial<Parameters<typeof PenCanvas>[0]> = {}) {
  const props = {
    svgRef: createRef<SVGSVGElement>(),
    verts: VERTS,
    radii: [0, 0, 0, 0],
    selected: new Set<number>(),
    pathD: 'M 0 0 L 100 0 L 100 80 L 0 80 Z',
    widthMm: 100,
    depthMm: 80,
    contentDepthMm: 80,
    viewBox: '0 0 128 108',
    padMm: 14,
    handleR: 2,
    valid: true,
    guides: { x: null, y: null },
    marquee: null,
    ariaLabel: 'perimeter',
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerEnd: vi.fn(),
    onDoubleClick: vi.fn(),
    onKeyDown: vi.fn(),
    onKeyUp: vi.fn(),
    onBlur: vi.fn(),
    onWheel: vi.fn(),
    ...overrides,
  };
  return { ...render(<PenCanvas {...props} />), props };
}

describe('PenCanvas', () => {
  // role="application" claims the keyboard, so the element must be reachable
  // by one — the pair is what makes the editor operable without a pointer.
  it('is a focusable application surface', () => {
    renderCanvas();
    const svg = screen.getByRole('application', { name: 'perimeter' });
    expect(svg).toHaveAttribute('tabindex', '0');
  });

  it('draws one handle per corner and one per edge', () => {
    const { container } = renderCanvas();
    expect(container.querySelectorAll('circle')).toHaveLength(VERTS.length * 2);
  });

  it('marks the selected corners', () => {
    const { container } = renderCanvas({ selected: new Set([1, 2]) });
    const filled = [...container.querySelectorAll('circle')].filter((c) =>
      (c.getAttribute('class') ?? '').includes('fill-accent')
    );
    expect(filled).toHaveLength(2);
  });

  // Which corners carry a radius has to be readable without clicking each one,
  // now that rounding is per corner rather than one value for the shape.
  it('draws a rounded corner differently from a sharp one', () => {
    const { container } = renderCanvas({ radii: [12, 0, 0, 0] });
    const rings = [...container.querySelectorAll('circle')].filter((c) =>
      (c.getAttribute('class') ?? '').includes('stroke-content-secondary')
    );
    expect(rings).toHaveLength(1);
  });

  it('colours the outline by validity', () => {
    const { container, rerender } = renderCanvas();
    expect(container.querySelector('path')?.getAttribute('class')).toContain('stroke-accent');

    rerender(
      <PenCanvas
        {...{
          svgRef: createRef<SVGSVGElement>(),
          verts: VERTS,
          radii: [0, 0, 0, 0],
          selected: new Set<number>(),
          pathD: 'M 0 0 Z',
          widthMm: 100,
          depthMm: 80,
          contentDepthMm: 80,
          viewBox: '0 0 128 108',
          padMm: 14,
          handleR: 2,
          valid: false,
          guides: { x: null, y: null },
          marquee: null,
          ariaLabel: 'perimeter',
          onPointerDown: vi.fn(),
          onPointerMove: vi.fn(),
          onPointerEnd: vi.fn(),
          onDoubleClick: vi.fn(),
          onKeyDown: vi.fn(),
          onKeyUp: vi.fn(),
          onBlur: vi.fn(),
          onWheel: vi.fn(),
        }}
      />
    );
    expect(container.querySelector('path')?.getAttribute('class')).toContain('stroke-error');
  });

  it('draws a guide only for the axis that aligned', () => {
    const { container } = renderCanvas({ guides: { x: 42, y: null } });
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute('x1')).toBe('42');
  });

  it('draws the marquee normalised, whichever way it was dragged', () => {
    const { container } = renderCanvas({ marquee: { x0: 80, y0: 60, x1: 20, y1: 10 } });
    // Two rects are the drawer and the marquee; the marquee is the last.
    const rects = container.querySelectorAll('rect');
    const m = rects[rects.length - 1];
    expect(m.getAttribute('x')).toBe('20');
    expect(m.getAttribute('y')).toBe('10');
    expect(m.getAttribute('width')).toBe('60');
    expect(m.getAttribute('height')).toBe('50');
  });

  it('omits the marquee when there is no sweep', () => {
    const { container } = renderCanvas();
    expect(container.querySelectorAll('rect')).toHaveLength(1);
  });
});
