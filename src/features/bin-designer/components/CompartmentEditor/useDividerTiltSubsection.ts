import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import {
  getCompartmentReadingOrder,
  getEligibleDividers,
} from '@/features/bin-designer/utils/compartments';
import type { EligibleDivider } from '@/features/bin-designer/utils/compartments';
import {
  applyAngleShift,
  getDividerGeometry,
  getInteriorDims,
  getLeanLimits,
  leanToFootTravel,
  offsetsToAngleShift,
  type AngleShift,
  type DividerEnvelopeParams,
  type DividerGeometry,
} from '@/features/bin-designer/utils/dividerAngle';
import { labelTabInteriorDims } from '@/shared/utils/labelTabPlan';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';

/** Canonical key for a divider between two compartments. Sorts inputs so
 *  callers can't desync the key by passing the pair in either order
 *  (`selectedDividerKey` / `hoveredDividerKey` lookups depend on this). */
export const rowKeyOf = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

type TrackPayload = Record<string, string | number | boolean | null>;

/**
 * Trailing debounce for a billable track call: only the last payload queued
 * within `delayMs` is sent. `flush` sends a pending payload immediately, for
 * unmount, so the final burst of an editing session isn't lost.
 */
export function createTrailingTrack(
  send: (payload: TrackPayload) => void,
  delayMs: number
): { queue: (payload: TrackPayload) => void; flush: () => void } {
  let pending: { timer: ReturnType<typeof setTimeout>; payload: TrackPayload } | null = null;
  return {
    queue(payload) {
      if (pending) clearTimeout(pending.timer);
      pending = {
        payload,
        timer: setTimeout(() => {
          pending = null;
          send(payload);
        }, delayMs),
      };
    },
    flush() {
      if (!pending) return;
      clearTimeout(pending.timer);
      const { payload } = pending;
      pending = null;
      send(payload);
    },
  };
}

export interface TiltRow extends EligibleDivider {
  readonly key: string;
  /**
   * Display numbers for the two compartments, from the same reading order the
   * grid draws (`getCompartmentReadingOrder`). Raw IDs are renumbered in cell
   * scan order (bottom row first), so on merged grids ID+1 disagrees with the
   * "Comp. N" the user can see — labels must use these, never the IDs.
   */
  readonly numberA: number;
  readonly numberB: number;
  /** True when either endpoint offset is non-zero (i.e. the divider is tilted/shifted). */
  readonly hasTilt: boolean;
  /** Segment length + offset envelope; null when the bin is too small to tilt. */
  readonly geometry: DividerGeometry | null;
  /** Committed tilt as a centered angle (degrees) — derived from the offsets. */
  readonly angleDeg: number;
  /** Committed parallel shift (mm) — derived from the offsets. */
  readonly shiftMm: number;
  /** Committed lean off vertical (degrees). */
  readonly leanDeg: number;
}

export function useDividerTiltSubsection() {
  const {
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
    params,
    compartments,
    scoopEnabled,
    labelEnabled,
    hasInserts,
    setDividerOverride,
    removeDividerOverride,
    setDividerOverrides,
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
      params: s.params,
      compartments: s.params.compartments,
      scoopEnabled: s.params.scoop.enabled,
      labelEnabled: s.params.label.enabled,
      hasInserts: s.params.inserts.length > 0,
      setDividerOverride: s.setDividerOverride,
      removeDividerOverride: s.removeDividerOverride,
      setDividerOverrides: s.setDividerOverrides,
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

  // The lean pivots on the divider's top, so its envelope needs the wall's real
  // height. Resolved through the same pair the worker uses rather than restated.
  const dividerHeightMm = useMemo(() => {
    const interior = labelTabInteriorDims(params);
    if (!interior) return 0;
    return resolveCompartmentDividerHeight(compartments.dividerHeight, interior.interiorHeight);
  }, [params, compartments.dividerHeight]);

  const dims = useMemo<DividerEnvelopeParams>(
    () => ({ width, depth, gridUnitMm, gridUnitMmY, wallThickness, dividerHeightMm }),
    [width, depth, gridUnitMm, gridUnitMmY, wallThickness, dividerHeightMm]
  );

  // Interior footprint in mm, for projecting divider offsets into the panel's
  // plan diagram the same way the canvas overlay does.
  const interiorDims = useMemo(
    () => getInteriorDims({ width, depth, gridUnitMm, gridUnitMmY, wallThickness }),
    [width, depth, gridUnitMm, gridUnitMmY, wallThickness]
  );

  const displayNumbers = useMemo(() => {
    const map = new Map<number, number>();
    getCompartmentReadingOrder(compartments).forEach((id, idx) => map.set(id, idx + 1));
    return map;
  }, [compartments]);

  const rows: readonly TiltRow[] = useMemo(() => {
    return getEligibleDividers(compartments).map((d) => {
      const geometry = getDividerGeometry(dims, compartments, d);
      const { angleDeg, shiftMm, leanDeg } = geometry
        ? offsetsToAngleShift(
            { offsetStart: d.offsetStart, offsetEnd: d.offsetEnd, rakeDeg: d.rakeDeg },
            geometry.segmentLengthMm
          )
        : { angleDeg: 0, shiftMm: 0, leanDeg: 0 };
      return {
        ...d,
        key: rowKeyOf(d.compartmentA, d.compartmentB),
        numberA: displayNumbers.get(d.compartmentA) ?? d.compartmentA + 1,
        numberB: displayNumbers.get(d.compartmentB) ?? d.compartmentB + 1,
        hasTilt: d.offsetStart !== 0 || d.offsetEnd !== 0 || d.rakeDeg !== 0,
        geometry,
        angleDeg,
        shiftMm,
        leanDeg,
      };
    });
  }, [compartments, dims, displayNumbers]);

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
    if (!selectedRow) return { angleDeg: 0, shiftMm: 0, leanDeg: 0 };
    if (selectedRow.geometry && dividerTiltPreview && dividerTiltPreview.key === selectedRow.key) {
      return offsetsToAngleShift(
        {
          offsetStart: dividerTiltPreview.offsetStart,
          offsetEnd: dividerTiltPreview.offsetEnd,
          rakeDeg: dividerTiltPreview.rakeDeg,
        },
        selectedRow.geometry.segmentLengthMm
      );
    }
    return {
      angleDeg: selectedRow.angleDeg,
      shiftMm: selectedRow.shiftMm,
      leanDeg: selectedRow.leanDeg,
    };
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
        rakeDeg: result.rakeDeg,
      });
    },
    [setDividerTiltPreview]
  );

  // Abandon an in-flight drag: drop the preview without writing an override.
  // The preview lives in the store, so it outlives the canvas that painted it —
  // an interrupted drag would otherwise leave a wall drawn somewhere it isn't.
  const cancelTilt = useCallback(() => {
    setDividerTiltPreview(null);
  }, [setDividerTiltPreview]);

  // A tilt is adjusted through many commits (each panel keystroke and drag end
  // lands here), and every event is billable. Only the burst's final values
  // carry signal, so the track is trailing-debounced with an unmount flush.
  const dividerTrack = useMemo(
    () => createTrailingTrack((payload) => trackEvent('divider_offset_changed', payload), 2000),
    []
  );
  useEffect(() => () => dividerTrack.flush(), [dividerTrack]);

  // Commit: clamp, write the real override (one history entry), drop preview.
  const commitTilt = useCallback(
    (row: TiltRow, next: AngleShift, source: 'panel_input' | 'canvas_drag' = 'panel_input') => {
      if (!row.geometry) return;
      const result = applyAngleShift(next, row.geometry);
      setDividerTiltPreview(null);
      setDividerOverride(
        row.compartmentA,
        row.compartmentB,
        result.offsetStart,
        result.offsetEnd,
        result.rakeDeg
      );
      dividerTrack.queue({
        axis: row.axis,
        offset_start_mm: result.offsetStart,
        offset_end_mm: result.offsetEnd,
        lean_deg: result.rakeDeg,
        source,
      });
    },
    [setDividerOverride, setDividerTiltPreview, dividerTrack]
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

  // Copy this divider's lean onto every divider running the same way, each
  // clamped to its own envelope. Written as one array so it costs one history
  // entry: a rack is one decision, and undoing it a divider at a time is not
  // what anybody means by undo.
  const applyLeanToAxis = useCallback(
    (row: TiltRow) => {
      setDividerTiltPreview(null);
      const next = rows.map((other) => {
        const lean = other.axis === row.axis ? row.leanDeg : other.leanDeg;
        const result = other.geometry
          ? applyAngleShift(
              { angleDeg: other.angleDeg, shiftMm: other.shiftMm, leanDeg: lean },
              other.geometry
            )
          : { offsetStart: other.offsetStart, offsetEnd: other.offsetEnd, rakeDeg: other.rakeDeg };
        return {
          compartmentA: other.compartmentA,
          compartmentB: other.compartmentB,
          offsetStart: result.offsetStart,
          offsetEnd: result.offsetEnd,
          ...(result.rakeDeg !== 0 ? { rakeDeg: result.rakeDeg } : {}),
        };
      });
      setDividerOverrides(next);
      trackEvent('divider_lean_applied_to_axis', { axis: row.axis, lean_deg: row.leanDeg });
    },
    [rows, setDividerOverrides, setDividerTiltPreview]
  );

  // How far this divider can lean, whatever it is leaning right now. Kept apart
  // from the readout below: the limits bound the CONTROL, so deriving them from
  // a readout that hides itself at rest would leave a divider sitting at 0
  // offering the full 60-degree track and every preset, then clamping whatever
  // the user picked to an angle they did not ask for.
  const leanLimits = useMemo(
    () => (selectedRow?.geometry ? getLeanLimits(selectedRow.geometry, selectedRow) : null),
    [selectedRow]
  );

  // What the lean actually costs the user: how far the foot has travelled and
  // what perpendicular opening is left between this divider and its neighbour.
  // Neither is readable off a plan view, and the compartment-size readout beside
  // it measures the grid line, which a leaning divider has left. Absent at rest,
  // where there is nothing yet to describe.
  const leanReadout = useMemo(() => {
    const geom = selectedRow?.geometry;
    if (!geom || selectedAngleShift.leanDeg === 0) return null;
    const travelMm = leanToFootTravel(selectedAngleShift.leanDeg, geom.dividerHeightMm);
    const cos = Math.cos((selectedAngleShift.leanDeg * Math.PI) / 180);
    return {
      travelMm: Math.round(Math.abs(travelMm) * 10) / 10,
      openingMm: Math.round(Math.max(0, geom.pitchMm * cos - compartments.thickness) * 10) / 10,
    };
  }, [selectedRow, selectedAngleShift.leanDeg, compartments.thickness]);

  const resetAll = useCallback(() => {
    clearDividerOverrides();
    setSelectedDividerKey(null);
    setHoveredDividerKey(null);
    setDividerTiltPreview(null);
  }, [clearDividerOverrides, setSelectedDividerKey, setHoveredDividerKey, setDividerTiltPreview]);

  return {
    compartments,
    interiorDims,
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
      cancelTilt,
      resetRow,
      resetAll,
      applyLeanToAxis,
    },
    leanLimits,
    leanReadout,
    t,
  };
}
