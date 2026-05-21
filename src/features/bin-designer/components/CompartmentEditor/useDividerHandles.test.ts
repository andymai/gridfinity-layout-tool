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

  // Note: prior to graduation the feature was experimental and could be
  // disabled; that test was removed when `angled_dividers` graduated. The
  // hook now always honors eligibility (linear grid + interior dividers)
  // since graduated flags are always enabled.

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
        preventDefault: () => {},
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

  it('enters free-snap (0.5 mm) when Alt is held on pointer-down', () => {
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
        preventDefault: () => {},
        stopPropagation: () => {},
        currentTarget: { setPointerCapture: () => {} },
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        altKey: true,
        shiftKey: false,
      } as unknown as React.PointerEvent);
    });
    // Free-snap matches the panel's ANGLED_DIVIDER_UI_STEP so both paths
    // produce values from the same granularity grid.
    expect(result.current.drag?.snapMm).toBe(0.5);
  });

  // === Regression tests for #1837 critical fixes ===
  // These cover the end-of-drag behavior (commit on pointerup, abort on
  // pointercancel, cleanup on unmount). The fixes themselves shipped in
  // #1837 but were never exercised by tests — Greptile flagged the gap
  // on PR #1837. Including here so a future refactor can't silently
  // reintroduce the bugs.

  function pointerDown(
    result: { current: ReturnType<typeof useDividerHandles> },
    opts: {
      clientX: number;
      clientY: number;
      altKey?: boolean;
      shiftKey?: boolean;
    } = { clientX: 100, clientY: 100 }
  ) {
    const handle = result.current.handles[0];
    act(() => {
      result.current.onHandlePointerDown(handle)({
        preventDefault: () => {},
        stopPropagation: () => {},
        currentTarget: { setPointerCapture: () => {} },
        pointerId: 1,
        clientX: opts.clientX,
        clientY: opts.clientY,
        altKey: opts.altKey ?? false,
        shiftKey: opts.shiftKey ?? false,
      } as unknown as React.PointerEvent);
    });
  }

  it('commits the override on pointerup', () => {
    // Regression for the finishDrag bug Copilot caught on #1837:
    // `dragOriginRef.current` was being cleared BEFORE the final offset
    // was computed, so `setDividerOverride` was never called.
    setCompartments({ cols: 1, rows: 2, cells: [0, 1] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    pointerDown(result, { clientX: 100, clientY: 100 });
    // Release 50 px below the start — for the horizontal divider,
    // that's a 20 mm shift (50 px / 200 px-rect-height * 80 mm-innerD,
    // negated because flex-col-reverse flips Y → -20 mm). Snaps to
    // -20 (already a 5 mm multiple).
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, clientY: 150 }));
    });
    const overrides = useDesignerStore.getState().params.compartments.dividerOverrides;
    expect(overrides).toHaveLength(1);
    expect(overrides?.[0].offsetStart).toBe(-20);
    expect(result.current.drag).toBeNull();
  });

  it('aborts WITHOUT committing on pointercancel', () => {
    // Regression for the #1835 → #1837 critical fix: pointercancel
    // shared handleUp and could write a wrong override using
    // clientX:0,clientY:0 from cancel events.
    setCompartments({ cols: 1, rows: 2, cells: [0, 1] });
    const { result } = renderHook(() =>
      useDividerHandles({
        compartments: useDesignerStore.getState().params.compartments,
        innerW: 80,
        innerD: 80,
        canvasRef: fakeCanvas(),
      })
    );
    pointerDown(result);
    act(() => {
      // Cancel events on some platforms carry clientX:0,clientY:0 —
      // committing using THAT delta would write a wrong override.
      window.dispatchEvent(new PointerEvent('pointercancel', { clientX: 0, clientY: 0 }));
    });
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
    expect(result.current.drag).toBeNull();
  });

  it('removes window listeners on unmount mid-drag (no leak)', () => {
    // Regression for the listener-leak fix on #1837 — strengthened in
    // PR 4 by spying on add/removeEventListener so a reintroduced leak
    // fails the test directly, not via the indirect "no store
    // mutation" signal alone (React 18 silently suppresses setState
    // on unmounted components, so that proxy can miss real leaks).
    setCompartments({ cols: 1, rows: 2, cells: [0, 1] });
    const adds: string[] = [];
    const removes: string[] = [];
    const origAdd = window.addEventListener.bind(window);
    const origRemove = window.removeEventListener.bind(window);
    window.addEventListener = ((type: string, ...args: unknown[]) => {
      if (type === 'pointermove' || type === 'pointerup' || type === 'pointercancel') {
        adds.push(type);
      }

      return origAdd(type as never, ...(args as any));
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, ...args: unknown[]) => {
      if (type === 'pointermove' || type === 'pointerup' || type === 'pointercancel') {
        removes.push(type);
      }

      return origRemove(type as never, ...(args as any));
    }) as typeof window.removeEventListener;
    try {
      const { result, unmount } = renderHook(() =>
        useDividerHandles({
          compartments: useDesignerStore.getState().params.compartments,
          innerW: 80,
          innerD: 80,
          canvasRef: fakeCanvas(),
        })
      );
      pointerDown(result);
      expect(result.current.drag).not.toBeNull();
      // 3 listeners registered on pointer-down (move, up, cancel).
      const addsBeforeUnmount = adds.length;
      expect(addsBeforeUnmount).toBeGreaterThanOrEqual(3);
      unmount();
      // The useEffect cleanup must invoke `dragCleanupRef`, which
      // removes the same 3 listeners. Removes count >= adds count
      // proves no leak.
      expect(removes.length).toBeGreaterThanOrEqual(addsBeforeUnmount);
      // Defense-in-depth: post-unmount events still must not commit.
      expect(() => {
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, clientY: 150 }));
      }).not.toThrow();
      expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
    } finally {
      window.addEventListener = origAdd;
      window.removeEventListener = origRemove;
    }
  });
});
