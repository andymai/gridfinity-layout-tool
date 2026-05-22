import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { getEligibleDividers } from '@/features/bin-designer/utils/compartments';
import type { EligibleDivider } from '@/features/bin-designer/utils/compartments';

/** ±50 mm UI cap (validator allows ±200 mm; this matches typical bin dimensions). */
export const TILT_UI_MAX = 50;
export const TILT_UI_STEP = 0.5;

export interface TiltRow extends EligibleDivider {
  readonly key: string;
  /** True when either endpoint offset is non-zero (i.e. this row is in the modified list). */
  readonly hasTilt: boolean;
}

/** Canonical key for a divider between two compartments. Sorts inputs so
 *  callers can't desync the key by passing the pair in either order
 *  (`selectedDividerKey` / `hoveredDividerKey` lookups depend on this). */
export const rowKeyOf = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);
const clamp = (n: number): number => Math.max(-TILT_UI_MAX, Math.min(TILT_UI_MAX, n));

export type DividerAxis = 'vertical' | 'horizontal';

/**
 * Orientation-aware labels for the two endpoint controls.
 *
 * `offsetStart` is the lower-coordinate endpoint of the segment:
 *  - vertical segment: lower Y = visual BOTTOM
 *  - horizontal segment: lower X = visual LEFT
 *
 * `offsetEnd` is the higher-coordinate endpoint (top / right).
 */
export function getEndpointLabelKeys(axis: DividerAxis): {
  readonly start: 'endpointBottom' | 'endpointLeft';
  readonly end: 'endpointTop' | 'endpointRight';
} {
  return axis === 'vertical'
    ? { start: 'endpointBottom', end: 'endpointTop' }
    : { start: 'endpointLeft', end: 'endpointRight' };
}

export function useDividerTiltSubsection() {
  const {
    compartments,
    setDividerOverride,
    removeDividerOverride,
    clearDividerOverrides,
    selectedDividerKey,
    hoveredDividerKey,
    setSelectedDividerKey,
    setHoveredDividerKey,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      setDividerOverride: s.setDividerOverride,
      removeDividerOverride: s.removeDividerOverride,
      clearDividerOverrides: s.clearDividerOverrides,
      selectedDividerKey: s.ui.selectedDividerKey,
      hoveredDividerKey: s.ui.hoveredDividerKey,
      setSelectedDividerKey: s.setSelectedDividerKey,
      setHoveredDividerKey: s.setHoveredDividerKey,
    }))
  );
  const t = useTranslation();

  const rows: readonly TiltRow[] = useMemo(() => {
    return getEligibleDividers(compartments).map((d) => ({
      ...d,
      key: rowKeyOf(d.compartmentA, d.compartmentB),
      hasTilt: d.offsetStart !== 0 || d.offsetEnd !== 0,
    }));
  }, [compartments]);

  const modifiedRows = useMemo(() => rows.filter((r) => r.hasTilt), [rows]);
  const hasAnyOverride = modifiedRows.length > 0;

  // Stale-key guards: a grid mutation can remove a previously-selected/hovered
  // divider, but the store key persists. Derive null for unknown keys so the
  // panel falls back to list mode and the canvas drops the highlight cleanly.
  const selectedRow = useMemo(
    () => (selectedDividerKey ? (rows.find((r) => r.key === selectedDividerKey) ?? null) : null),
    [rows, selectedDividerKey]
  );
  const activeHoveredKey = useMemo(
    () =>
      hoveredDividerKey && rows.some((r) => r.key === hoveredDividerKey) ? hoveredDividerKey : null,
    [rows, hoveredDividerKey]
  );

  const selectDivider = useCallback(
    (key: string | null) => {
      setSelectedDividerKey(key);
    },
    [setSelectedDividerKey]
  );

  const hoverDivider = useCallback(
    (key: string | null) => {
      setHoveredDividerKey(key);
    },
    [setHoveredDividerKey]
  );

  const setOffset = useCallback(
    (row: TiltRow, which: 'start' | 'end', value: number) => {
      const clamped = clamp(value);
      const nextStart = which === 'start' ? clamped : row.offsetStart;
      const nextEnd = which === 'end' ? clamped : row.offsetEnd;
      if (nextStart === row.offsetStart && nextEnd === row.offsetEnd) return;
      setDividerOverride(row.compartmentA, row.compartmentB, nextStart, nextEnd);
      trackEvent('divider_offset_changed', {
        axis: row.axis,
        offset_start_mm: nextStart,
        offset_end_mm: nextEnd,
        source: 'panel_input',
      });
    },
    [setDividerOverride]
  );

  const resetRow = useCallback(
    (row: TiltRow) => {
      removeDividerOverride(row.compartmentA, row.compartmentB);
      // Clear hover if it pointed at the row we just removed from the modified
      // list — pointerLeave can't fire on an unmounted wrapper, so without
      // this the canvas + compartment highlight stays stuck on.
      // selection is intentionally preserved: when reset is triggered from
      // the inspector, the user stays in that inspector for the now-straight
      // divider so they can immediately re-tilt or back out.
      if (hoveredDividerKey === row.key) setHoveredDividerKey(null);
    },
    [removeDividerOverride, hoveredDividerKey, setHoveredDividerKey]
  );

  const resetAll = useCallback(() => {
    clearDividerOverrides();
    setSelectedDividerKey(null);
    setHoveredDividerKey(null);
  }, [clearDividerOverrides, setSelectedDividerKey, setHoveredDividerKey]);

  return {
    compartments,
    rows,
    modifiedRows,
    hasAnyOverride,
    selectedRow,
    hoveredKey: activeHoveredKey,
    handlers: {
      selectDivider,
      hoverDivider,
      setOffset,
      resetRow,
      resetAll,
    },
    t,
  };
}
