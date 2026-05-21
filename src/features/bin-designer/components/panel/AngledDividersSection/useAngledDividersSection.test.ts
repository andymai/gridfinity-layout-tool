import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAngledDividersSection } from './useAngledDividersSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLabsStore } from '@/core/store/labs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

describe('useAngledDividersSection', () => {
  beforeEach(() => {
    // Project convention: full inter-test isolation across history,
    // selection, ui stores etc. — not just designer params.
    resetAllStores();
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS });
    useLabsStore.getState().enableFeature('angled_dividers');
  });

  function setCompartments(cols: number, rows: number, cells: number[]) {
    useDesignerStore.setState((s) => ({
      params: {
        ...s.params,
        compartments: { ...s.params.compartments, cols, rows, cells },
      },
    }));
  }

  it('reports unavailable when there are no interior dividers', () => {
    setCompartments(1, 1, [0]);
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.isUnavailable).toBe(true);
    expect(result.current.state.rows).toEqual([]);
    expect(result.current.meta.disabledReason).toBeDefined();
  });

  it('lists one row per eligible divider in a 1×2 grid', () => {
    setCompartments(1, 2, [0, 1]);
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.rows).toHaveLength(1);
    expect(result.current.state.rows[0]).toMatchObject({
      compartmentA: 0,
      compartmentB: 1,
      axis: 'horizontal',
      offsetStart: 0,
      offsetEnd: 0,
      displayNumber: 1,
    });
  });

  it('setOffset writes a divider override and clamps to the UI cap', () => {
    setCompartments(1, 2, [0, 1]);
    const { result } = renderHook(() => useAngledDividersSection());
    act(() => {
      result.current.handlers.setOffset(result.current.state.rows[0], 'start', 999);
    });
    const overrides = useDesignerStore.getState().params.compartments.dividerOverrides;
    expect(overrides).toHaveLength(1);
    // UI cap is ±50; storage shouldn't receive 999.
    expect(overrides?.[0].offsetStart).toBe(50);
  });

  it('resetRow removes the override and shrinks the summary', () => {
    setCompartments(1, 2, [0, 1]);
    const { result, rerender } = renderHook(() => useAngledDividersSection());
    act(() => {
      result.current.handlers.setOffset(result.current.state.rows[0], 'start', 10);
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(true);
    act(() => {
      result.current.handlers.resetRow(result.current.state.rows[0]);
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(false);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  it('toggleEnabled clears all overrides when any exist', () => {
    setCompartments(2, 2, [0, 1, 2, 3]);
    const { result, rerender } = renderHook(() => useAngledDividersSection());
    act(() => {
      result.current.handlers.setOffset(result.current.state.rows[0], 'start', 10);
      result.current.handlers.setOffset(result.current.state.rows[1], 'end', -5);
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(true);
    act(() => {
      result.current.handlers.toggleEnabled();
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(false);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  // The "labs flag off" test was removed when `angled_dividers`
  // graduated to a stable feature. `flagEnabled` is always true for
  // graduated flags, so the section's visibility is now driven purely
  // by eligibility (rows.length > 0).

  it('opens on toggleEnabled even when no overrides exist (first-time UX)', () => {
    // Regression test for the catch-22 in PR #1832: FeatureToggle only
    // renders children when `checked` is true. If `checked` is tied to
    // `hasAnyOverride`, users with no overrides can't open the section
    // to create the first one. Toggle-on should open the section
    // regardless of override state.
    setCompartments(1, 2, [0, 1]);
    const { result, rerender } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.hasAnyOverride).toBe(false);
    act(() => result.current.handlers.toggleEnabled());
    rerender();
    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.hasAnyOverride).toBe(false);
  });

  it('toggleEnabled closes AND clears overrides when currently open', () => {
    setCompartments(1, 2, [0, 1]);
    const { result, rerender } = renderHook(() => useAngledDividersSection());
    act(() => result.current.handlers.setOffset(result.current.state.rows[0], 'start', 10));
    rerender();
    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.hasAnyOverride).toBe(true);
    act(() => result.current.handlers.toggleEnabled());
    rerender();
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.hasAnyOverride).toBe(false);
  });

  it('auto-opens on initial render when overrides already exist (reload UX)', () => {
    // #1834 follow-up: Greptile flagged that the reload-with-existing-
    // overrides path wasn't covered. The hook derives `isOpen` from
    // `isOpenLocal || hasAnyOverride` so a fresh mount with overrides in
    // storage must immediately report isOpen=true (so the section's
    // toggle reads as on AND its children render — without this, a user
    // who reloads with existing overrides sees the section collapsed
    // even though their data is intact).
    useDesignerStore.setState((s) => ({
      params: {
        ...s.params,
        compartments: {
          ...s.params.compartments,
          cols: 1,
          rows: 2,
          cells: [0, 1],
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 12, offsetEnd: -8 }],
        },
      },
    }));
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.hasAnyOverride).toBe(true);
  });

  it('forces isOpen=false when the grid becomes ineligible mid-session', () => {
    // #1834 follow-up: Greptile flagged an edge case where `isOpenLocal`
    // persists across grid mutations. If the user opens the section on a
    // 1×2 layout then shrinks to 1×1, the toggle shouldn't read as
    // "on" while being disabled — `isOpen` must derive from BOTH the
    // open state AND eligibility.
    setCompartments(1, 2, [0, 1]);
    const { result, rerender } = renderHook(() => useAngledDividersSection());
    act(() => result.current.handlers.toggleEnabled());
    rerender();
    expect(result.current.state.isOpen).toBe(true);
    // Shrink to 1×1 — no interior dividers.
    setCompartments(1, 1, [0]);
    rerender();
    expect(result.current.state.isUnavailable).toBe(true);
    expect(result.current.state.isOpen).toBe(false);
  });

  it('reports isUnavailable with the non-standard-mode reason for slotted bins', () => {
    // Greptile flagged on #1840 that the slotted-mode blind spot let
    // users tilt knobs that did nothing once already in slotted mode.
    // The fix gates `useAngledDividersSection` on style==='standard';
    // this test prevents regression.
    setCompartments(1, 2, [0, 1]);
    useDesignerStore.setState((s) => ({ params: { ...s.params, style: 'slotted' } }));
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.isUnavailable).toBe(true);
    // Translation renders to English here; assert against the actual
    // string so we're testing the right branch fired (the
    // `unavailableNoBoundary` branch would say "interior dividers"
    // instead).
    expect(result.current.meta.disabledReason).toContain('standard compartment grid');
  });

  it('reports isUnavailable for solid (cutout) bins too', () => {
    setCompartments(1, 2, [0, 1]);
    useDesignerStore.setState((s) => ({ params: { ...s.params, style: 'solid' } }));
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.isUnavailable).toBe(true);
  });

  it('reports isAvailable for standard-mode bins with eligible dividers', () => {
    // Sanity check that the new style gate doesn't accidentally
    // suppress the standard-mode path.
    setCompartments(1, 2, [0, 1]);
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.isUnavailable).toBe(false);
    expect(result.current.meta.disabledReason).toBeUndefined();
  });
});
