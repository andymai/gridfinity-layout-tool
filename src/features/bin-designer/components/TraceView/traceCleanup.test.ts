import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NO_CLEANUP } from '@/shared/outlineCleanup';
import { rulerReference, type SceneShape, type SceneTrace } from '@/shared/scanTrace';
import { useTraceCleanup } from './traceCleanup';

// Two millimetres to the pixel: a ruler 100 px long reads 50 mm.
const RULER = rulerReference({ x: 0, y: 0 }, { x: 100, y: 0 }, 50);

/** A wobbly 30 mm circle, in pixels and millimetres. */
function disc(cx: number): SceneShape {
  const mm = Array.from({ length: 240 }, (_, i) => ({
    x: cx + 15 * Math.cos((2 * Math.PI * i) / 240) + 0.05 * Math.sin(i),
    y: 20 + 15 * Math.sin((2 * Math.PI * i) / 240),
  }));
  return { outputPoints: mm, imagePoints: mm.map((p) => ({ x: p.x * 2, y: p.y * 2 })) };
}

const scene = (shapes: SceneShape[], units: 'mm' | 'px' = 'mm'): SceneTrace => ({
  shapes,
  units,
  card: null,
  grid: null,
  reference: units === 'mm' ? RULER : null,
});

function hook(shapes: SceneShape[], units: 'mm' | 'px' = 'mm') {
  const s = scene(shapes, units);
  return renderHook(() => useTraceCleanup(s, shapes, false, {}));
}

describe('useTraceCleanup', () => {
  it('leaves the tools as traced until something is set', () => {
    const tools = [disc(20)];
    const { result } = hook(tools);
    expect(result.current.shapes).toBe(tools);
    expect(result.current.tools).toBeNull();
  });

  it('fits curves and draws them back over the photo', () => {
    const { result } = hook([disc(20)]);
    act(() => result.current.set({ ...NO_CLEANUP, curves: true }, true));

    const [tool] = result.current.tools ?? [];
    expect(tool.path.some((p) => p.handleOut !== null)).toBe(true);
    const [shown] = result.current.shapes;
    shown.outputPoints.forEach((p, i) => {
      expect(shown.imagePoints[i].x).toBeCloseTo(p.x * 2, 6);
    });
  });

  it('holds a rounding drag until it is let go', () => {
    const { result } = hook([disc(20)]);
    act(() => result.current.set({ ...NO_CLEANUP, roundInside: 2 }, false));
    expect(result.current.settings.roundInside).toBe(2);
    expect(result.current.tools).toBeNull();

    act(() => result.current.set({ ...NO_CLEANUP, roundInside: 2 }, true));
    expect(result.current.tools).not.toBeNull();
  });

  it('mirrors only a tool traced alone', () => {
    const { result } = hook([disc(20), disc(60)]);
    expect(result.current.canMirror).toBe(false);
    act(() =>
      result.current.set({ ...NO_CLEANUP, mirror: { axis: 'vertical', keep: 'low' } }, true)
    );
    // The mirror is set aside, which leaves nothing else to do.
    expect(result.current.tools).toBeNull();
  });

  it('waits for a scale', () => {
    const { result } = hook([disc(20)], 'px');
    expect(result.current.available).toBe(false);
    act(() => result.current.set({ ...NO_CLEANUP, curves: true }, true));
    expect(result.current.tools).toBeNull();
  });
});
