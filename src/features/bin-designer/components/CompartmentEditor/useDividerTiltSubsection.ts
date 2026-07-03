import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { getEligibleDividers } from '@/features/bin-designer/utils/compartments';
import type { EligibleDivider } from '@/features/bin-designer/utils/compartments';
import {
  applyAngleShift,
  getDividerGeometry,
  offsetsToAngleShift,
  type AngleShift,
  type BinInteriorParams,
  type DividerGeometry,
} from '@/features/bin-designer/utils/dividerAngle';

/** Canonical key for a divider between two compartments. Sorts inputs so
 *  callers can't desync the key by passing the pair in either order
 *  (`selectedDividerKey` / `hoveredDividerKey` lookups depend on this). */
export const rowKeyOf = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

export type DividerAxis = 'vertical' | 'horizontal';

export interface TiltRow extends EligibleDivider {
  readonly key: string;
  /** True when either endpoint offset is non-zero (i.e. the divider is tilted/shifted). */
  readonly hasTilt: boolean;
  /** Segment length + offset envelope; null when the bin is too small to tilt. */
  readonly geometry: DividerGeometry | null;
  /** Committed tilt as a centered angle (degrees) — derived from the offsets. */
  readonly angleDeg: number;
  /** Committed parallel shift (mm) — derived from the offsets. */
  readonly shiftMm: number;
}

export function useDividerTiltSubsection() {
  const {
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
    compartments,
    scoopEnabled,
    labelEnabled,
    hasInserts,
    setDividerOverride,
    removeDividerOverride,
    clearDividerOverrides,
    selectedDividerKey,
    hoveredDividerKey,
    dividerTiltPreview,
    setSelectedDividerKey,
    setHoveredDividerKey,
    setDividerTiltPreview,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      wallThickness: s.params.wallThickness,
      compartments: s.params.compartments,
      scoopEnabled: s.params.scoop.enabled,
      labelEnabled: s.params.label.enabled,
      hasInserts: s.params.inserts.length > 0,
      setDividerOverride: s.setDividerOverride,
      removeDividerOverride: s.removeDividerOverride,
      clearDividerOverrides: s.clearDividerOverrides,
      selectedDividerKey: s.ui.selectedDividerKey,
      hoveredDividerKey: s.ui.hoveredDividerKey,
      dividerTiltPreview: s.ui.dividerTiltPreview,
      setSelectedDividerKey: s.setSelectedDividerKey,
      setHoveredDividerKey: s.setHoveredDividerKey,
      setDividerTiltPreview: s.setDividerTiltPreview,
    }))
  );
  const t = useTranslation();

  const dims = useMemo<BinInteriorParams>(
    () => ({ width, depth, gridUnitMm, gridUnitMmY, wallThickness }),
    [width, depth, gridUnitMm, gridUnitMmY, wallThickness]
  );

  const rows: readonly TiltRow[] = useMemo(() => {
    return getEligibleDividers(compartments).map((d) => {
      const geometry = getDividerGeometry(dims, compartments, d);
      const { angleDeg, shiftMm } = geometry
        ? offsetsToAngleShift(
            { offsetStart: d.offsetStart, offsetEnd: d.offsetEnd },
            geometry.segmentLengthMm
          )
        : { angleDeg: 0, shiftMm: 0 };
      return {
        ...d,
        key: rowKeyOf(d.compartmentA, d.compartmentB),
        hasTilt: d.offsetStart !== 0 || d.offsetEnd !== 0,
        geometry,
        angleDeg,
        shiftMm,
      };
    });
  }, [compartments, dims]);

  const hasAnyOverride = useMemo(() => rows.some((r) => r.hasTilt), [rows]);

  // Features that get stripped from a wall once it's tilted (mirrors the
  // worker's auto-disable). Surfaced as an inline notice so the disappearing
  // feature isn't a silent surprise.
  const activeConflicts = useMemo<readonly ('scoop' | 'labelTab' | 'inserts')[]>(() => {
    const out: ('scoop' | 'labelTab' | 'inserts')[] = [];
    if (scoopEnabled) out.push('scoop');
    if (labelEnabled) out.push('labelTab');
    if (hasInserts) out.push('inserts');
    return out;
  }, [scoopEnabled, labelEnabled, hasInserts]);

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

  // Angle/shift shown in the inspector: the in-flight drag preview when it
  // targets the selected divider, otherwise the committed value.
  const selectedAngleShift = useMemo<AngleShift>(() => {
    if (!selectedRow) return { angleDeg: 0, shiftMm: 0 };
    if (selectedRow.geometry && dividerTiltPreview && dividerTiltPreview.key === selectedRow.key) {
      return offsetsToAngleShift(
        { offsetStart: dividerTiltPreview.offsetStart, offsetEnd: dividerTiltPreview.offsetEnd },
        selectedRow.geometry.segmentLengthMm
      );
    }
    return { angleDeg: selectedRow.angleDeg, shiftMm: selectedRow.shiftMm };
  }, [selectedRow, dividerTiltPreview]);

  const selectDivider = useCallback(
    (key: string | null) => {
      // Selecting a different divider (or returning to the list) drops any
      // in-flight preview so it can't bleed onto the next selection.
      setDividerTiltPreview(null);
      setSelectedDividerKey(key);
    },
    [setSelectedDividerKey, setDividerTiltPreview]
  );

  const hoverDivider = useCallback(
    (key: string | null) => {
      setHoveredDividerKey(key);
    },
    [setHoveredDividerKey]
  );

  // Live drag: write a transient preview only (no store mutation, no history).
  const previewTilt = useCallback(
    (row: TiltRow, next: AngleShift) => {
      if (!row.geometry) return;
      const result = applyAngleShift(next, row.geometry);
      setDividerTiltPreview({
        key: row.key,
        offsetStart: result.offsetStart,
        offsetEnd: result.offsetEnd,
      });
    },
    [setDividerTiltPreview]
  );

  // Commit: clamp, write the real override (one history entry), drop preview.
  const commitTilt = useCallback(
    (row: TiltRow, next: AngleShift) => {
      if (!row.geometry) return;
      const result = applyAngleShift(next, row.geometry);
      setDividerTiltPreview(null);
      setDividerOverride(row.compartmentA, row.compartmentB, result.offsetStart, result.offsetEnd);
      trackEvent('divider_offset_changed', {
        axis: row.axis,
        offset_start_mm: result.offsetStart,
        offset_end_mm: result.offsetEnd,
        source: 'panel_input',
      });
    },
    [setDividerOverride, setDividerTiltPreview]
  );

  const resetRow = useCallback(
    (row: TiltRow) => {
      setDividerTiltPreview(null);
      removeDividerOverride(row.compartmentA, row.compartmentB);
      // Clear hover if it pointed at the row we just reset — pointerLeave can't
      // fire on an unmounted wrapper, so without this the highlight sticks on.
      if (hoveredDividerKey === row.key) setHoveredDividerKey(null);
    },
    [removeDividerOverride, hoveredDividerKey, setHoveredDividerKey, setDividerTiltPreview]
  );

  const resetAll = useCallback(() => {
    clearDividerOverrides();
    setSelectedDividerKey(null);
    setHoveredDividerKey(null);
    setDividerTiltPreview(null);
  }, [clearDividerOverrides, setSelectedDividerKey, setHoveredDividerKey, setDividerTiltPreview]);

  return {
    compartments,
    rows,
    hasAnyOverride,
    activeConflicts,
    selectedRow,
    selectedAngleShift,
    hoveredKey: activeHoveredKey,
    handlers: {
      selectDivider,
      hoverDivider,
      previewTilt,
      commitTilt,
      resetRow,
      resetAll,
    },
    t,
  };
}
