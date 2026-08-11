import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { createElement, useRef } from 'react';
import { useBentoCanvasBox } from './useBentoCanvasBox';
import type { BentoCanvasBox } from './useBentoCanvasBox';

// Drive ResizeObserver by hand so the box can be observed at a known size.
type Entries = Array<{ contentRect: { width: number; height: number } }>;
let notify: ((entries: Entries) => void) | null = null;

beforeEach(() => {
  notify = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: (entries: Entries) => void) {
        notify = cb;
      }
      observe() {}
      disconnect() {}
    }
  );
});

/** Mounts the hook with its ref actually attached, so the observer runs. */
function mountBox(aspect: number, interiorW: number, interiorD: number) {
  let latest: BentoCanvasBox | null = null;

  function Harness() {
    const ref = useRef<HTMLDivElement>(null);
    latest = useBentoCanvasBox(ref, aspect, interiorW, interiorD);
    return createElement('div', { ref });
  }

  render(createElement(Harness));

  return {
    get box(): BentoCanvasBox {
      if (!latest) throw new Error('harness did not render');
      return latest;
    },
    resizeTo(width: number, height: number) {
      act(() => {
        notify?.([{ contentRect: { width, height } }]);
      });
    },
  };
}

describe('useBentoCanvasBox', () => {
  it('reports nothing drawable before the container is measured', () => {
    const h = mountBox(2, 100, 50);

    expect(h.box.width).toBe(0);
    expect(h.box.height).toBe(0);
  });

  it('fits by width when width is the binding axis', () => {
    const h = mountBox(2, 100, 50);
    // 200x400 pane, minus 24px padding each side → 152x352 available.
    // Aspect 2 wants 704px wide for that height, so width binds.
    h.resizeTo(200, 400);

    expect(h.box.width).toBe(152);
    expect(h.box.height).toBe(76);
  });

  it('fits by height when height is the binding axis', () => {
    const h = mountBox(2, 100, 50);
    // 800x200 → 752x152 available. Aspect 2 at height 152 is 304px wide,
    // which is narrower than 752, so height binds.
    h.resizeTo(800, 200);

    expect(h.box.width).toBe(304);
    expect(h.box.height).toBe(152);
  });

  it('derives per-axis mm scale from the drawn box', () => {
    const h = mountBox(2, 100, 50);
    h.resizeTo(800, 200);

    expect(h.box.scaleX).toBeCloseTo(304 / 100);
    expect(h.box.scaleY).toBeCloseTo(152 / 50);
  });

  it('survives a degenerate aspect ratio rather than dividing by zero', () => {
    const h = mountBox(0, 100, 50);
    h.resizeTo(400, 400);

    expect(Number.isFinite(h.box.width)).toBe(true);
    expect(Number.isFinite(h.box.height)).toBe(true);
  });

  it('reports zero scale for a zero-size interior instead of Infinity', () => {
    const h = mountBox(1, 0, 0);
    h.resizeTo(400, 400);

    expect(h.box.scaleX).toBe(0);
    expect(h.box.scaleY).toBe(0);
  });
});
