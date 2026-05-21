import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { useDividerHandles } from './useDividerHandles';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLabsStore } from '@/core/store/labs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';
import type { CompartmentConfig } from '@/features/bin-designer/types';

const NOOP_RECT: DOMRect = {
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  top: 0,
  right: 200,
  bottom: 200,
  left: 0,
  toJSON: () => ({}),
};

function fakeCanvas(): React.RefObject<HTMLElement | null> {
  // Hook reads `canvasRef.current.getBoundingClientRect()` during pointer
  // events. A stub element with a fixed-rect getter is enough for the
  // arithmetic — no DOM mount needed.
  const ref = createRef<HTMLElement | null>();
  Object.defineProperty(ref, 'current', {
    value: { getBoundingClientRect: () => NOOP_RECT },
    writable: true,
  });
  return ref;
}

function setCompartments(config: Partial<CompartmentConfig>) {
  useDesignerStore.setState((s) => ({
    params: {
      ...s.params,
      compartments: { ...s.params.compartments, ...config },
    },
  }));
}

describe('useDividerHandles', () => {
  beforeEach(() => {
    resetAllStores();
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS });
    useLabsStore.getState().enableFeature('angled_dividers');
  });

  it('returns no handles when the labs flag is off', () => {
    useLabsStore.getState().disableFeature('angled_dividers');
    setCompartments({ cols: 1, rows: 2, cells: [0, 1] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    expect(result.current.handles).toEqual([]);
  });

  it('returns no handles for non-linear grids (panel-only in v1)', () => {
    setCompartments({ cols: 2, rows: 2, cells: [0, 1, 2, 3] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    expect(result.current.handles).toEqual([]);
  });

  it('returns 2 handles for a 1x2 linear grid (one divider, two endpoints)', () => {
    setCompartments({ cols: 1, rows: 2, cells: [0, 1] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    expect(result.current.handles).toHaveLength(2);
    const [start, end] = result.current.handles;
    expect(start.which).toBe('start');
    expect(end.which).toBe('end');
    // Horizontal divider at row boundary 1 of 2 rows → data Y = innerD/2.
    // Visual Y = 1 - (Y / innerD) = 0.5. Endpoints at visual X = 0 (left)
    // and visual X = 1 (right).
    expect(start.visualX).toBe(0);
    expect(start.visualY).toBeCloseTo(0.5);
    expect(end.visualX).toBe(1);
    expect(end.visualY).toBeCloseTo(0.5);
  });

  it('returns 2 handles for a 2x1 linear grid', () => {
    setCompartments({ cols: 2, rows: 1, cells: [0, 1] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    expect(result.current.handles).toHaveLength(2);
    // Vertical divider at col boundary 1 → data X = innerW/2 → visual X = 0.5.
    // Start = front (visual Y = 1), end = back (visual Y = 0).
    const [start, end] = result.current.handles;
    expect(start.visualX).toBeCloseTo(0.5);
    expect(start.visualY).toBe(1);
    expect(end.visualX).toBeCloseTo(0.5);
    expect(end.visualY).toBe(0);
  });

  it('positions handles offset by an existing override', () => {
    setCompartments({
      cols: 1,
      rows: 2,
      cells: [0, 1],
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 8, offsetEnd: -8 }],
    });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    const [start, end] = result.current.handles;
    // Horizontal divider at Y = 40 mm of 80 mm depth → visual Y 0.5.
    // +8 mm offsetStart → data Y = 48 → visual Y = 1 - 48/80 = 0.4.
    // -8 mm offsetEnd → data Y = 32 → visual Y = 1 - 32/80 = 0.6.
    expect(start.visualY).toBeCloseTo(0.4);
    expect(end.visualY).toBeCloseTo(0.6);
    expect(start.currentOffsetMm).toBe(8);
    expect(end.currentOffsetMm).toBe(-8);
  });

  it('starts idle (drag === null)', () => {
    setCompartments({ cols: 1, rows: 2, cells: [0, 1] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    expect(result.current.drag).toBeNull();
  });

  it('enters drag state on pointer-down with the initial offset', () => {
    setCompartments({ cols: 1, rows: 2, cells: [0, 1] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    const handle = result.current.handles[0];
    act(() => {
      result.current.onHandlePointerDown(handle)({
        stopPropagation: () => {},
        currentTarget: { setPointerCapture: () => {} },
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        altKey: false,
        shiftKey: false,
      } as unknown as React.PointerEvent);
    });
    expect(result.current.drag).not.toBeNull();
    expect(result.current.drag?.which).toBe('start');
    expect(result.current.drag?.previewOffsetMm).toBe(0);
    expect(result.current.drag?.snapMm).toBe(5);
  });
});
