import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import {
  LID_CLICK_RAIL_COVERAGE_OPTIONS,
  LID_CORNER_RADIUS,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_STEP_MM,
  LID_FIT_CLEARANCE,
  LID_MIN_RAIL_LENGTH,
  LID_TOP_THICKNESS_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
  LID_TOP_THICKNESS_STEP_MM,
  LID_MAGNETIC_EXTRA_CLEARANCE,
  resolveLidFootprintClearance,
  resolveLidPlateThickness,
  resolveLidCavityExtraMm,
  LID_MAGNET_DIAMETER_MIN_MM,
  LID_MAGNET_DIAMETER_MAX_MM,
  LID_MAGNET_DEPTH_MIN_MM,
  LID_MAGNET_DEPTH_MAX_MM,
  LID_MAGNET_DIMENSION_STEP_MM,
  LID_MAGNET_EDGE_COUNT_MIN,
  LID_MAGNET_EDGE_COUNT_MAX,
  LID_MAGNET_EDGE_COUNT_STEP,
  LID_TRAY_DEPTH_MIN_MM,
  LID_TRAY_DEPTH_MAX_MM,
  LID_TRAY_WALL_MIN_MM,
  LID_TRAY_WALL_MAX_MM,
  LID_TRAY_DIMENSION_STEP_MM,
  isMagnetStyle,
  type LidAttachment,
  type LidClickRails,
  type LidConfig,
  type LidRailSide,
  type TextMode,
} from '@/features/bin-designer/types';
import { isPartialMask, maskToPolygon, MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import type { CellMask } from '@/shared/utils/cellMask';
import { lidWallBottomZ } from '@/features/bin-designer/components/preview/LidMesh/lidAnchorZ';
import {
  checkLidCompatibility,
  computeDisabledRails,
  hasLidBlocker,
} from '@/features/bin-designer/utils/lidCompatibility';
import type {
  LidCompatibilityId,
  LidCompatibilityIssue,
  LidCompatibilitySide,
} from '@/features/bin-designer/utils/lidCompatibility';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';

/**
 * View-layer projection of the lid's top-face treatment. The persisted model
 * keeps `stackableTop` and `tray.enabled` as independent booleans (whose mutual
 * exclusion the store enforces); the panel presents them as one three-way
 * choice. No change to `LidConfig` — this is purely how the UI groups them.
 */
export type LidTopSurface = 'flat' | 'stackable' | 'tray';
export const LID_TOP_SURFACES: readonly LidTopSurface[] = ['flat', 'stackable', 'tray'] as const;

/**
 * Pure value-summary string for a lid (attachment mode + rail status). Shared
 * by the section body and the collapsed group header so the header can
 * subscribe to just `lid` rather than re-running the whole section hook (with
 * its broad params subscription and compatibility scan).
 */
export function lidValueSummary(lid: LidConfig, t: ReturnType<typeof useTranslation>): string {
  if (lid.attachment === 'friction') return t('binDesigner.lid.summaryFriction');
  if (lid.attachment === 'magnetic') {
    return t('binDesigner.lid.summaryMagnetic', {
      diameter: lid.retentionMagnet.diameter.toFixed(1),
      depth: lid.retentionMagnet.depth.toFixed(1),
    });
  }
  const railSideCount =
    (lid.clickRails.front ? 1 : 0) +
    (lid.clickRails.back ? 1 : 0) +
    (lid.clickRails.left ? 1 : 0) +
    (lid.clickRails.right ? 1 : 0);
  if (railSideCount === 0) return t('binDesigner.lid.summaryNoRails');
  if (railSideCount < 4) {
    return t('binDesigner.lid.summaryPartialRails', {
      coverage: lid.clickRailCoverage,
      sides: railSideCount,
    });
  }
  return t('binDesigner.lid.summary', { coverage: lid.clickRailCoverage });
}

/**
 * Build the `disabledReason` text shown on the lid toggle when blockers
 * are present. Single blocker → specific fix instruction; multiple →
 * generic "{count} conflicts" message so the tooltip stays compact.
 * Returns null when there are no blockers.
 */
function buildBlockerReason(
  blockers: readonly LidCompatibilityIssue[],
  t: ReturnType<typeof useTranslation>
): string | null {
  if (blockers.length === 0) return null;
  if (blockers.length === 1) {
    const fixKey = `binDesigner.lid.compat.fix.${blockers[0].id}`;
    return t('binDesigner.lid.compat.disabledOne', { detail: t(fixKey) });
  }
  return t('binDesigner.lid.compat.disabledMany', { count: blockers.length });
}

/** Rail summary for display: count of walls per length tier. */
interface RailSummary {
  /** Total walls that will receive a rail (after coverage + min-length + label-omit filters). */
  readonly count: number;
  /** Lengths that appear, sorted descending. Empty when count === 0. */
  readonly lengths: readonly number[];
  /** When polygon: the min and max rail length across walls (mm). Undefined for rectangles. */
  readonly polygonRange?: { min: number; max: number };
}

/**
 * Compute the rails-per-wall summary the LidSection panel displays. Mirrors
 * the geometry math in `lidBuilder.railPlacementsForRectangle/Polygon` but
 * yields display-only data — does not touch brepjs.
 */
function computeRailSummary(
  width: number,
  depth: number,
  gridUnitMm: number,
  coveragePercent: number,
  disabledRails: ReadonlySet<LidCompatibilitySide>,
  cellMask: CellMask | undefined,
  clickRails: LidClickRails,
  // Y-axis pitch for non-square grids; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm
): RailSummary {
  const fitClearance = LID_FIT_CLEARANCE;
  const lidCornerR = LID_CORNER_RADIUS - fitClearance;
  const coverage = coveragePercent / 100;

  // Polygon path: per-edge length analysis from the mask outline.
  if (isPartialMask(cellMask)) {
    const outer = maskToPolygon(cellMask)[0] ?? [];
    const halfW = (cellMask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
    const halfD = (cellMask.rows * MASK_CELL_SIZE * gridUnitMmY) / 2;
    const lengths: number[] = [];
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % outer.length];
      const ax = a.x * gridUnitMm - halfW;
      const ay = a.y * gridUnitMmY - halfD;
      const bx = b.x * gridUnitMm - halfW;
      const by = b.y * gridUnitMmY - halfD;
      const dx = bx - ax;
      const dy = by - ay;
      // Classify by outward direction to apply the per-side toggle and
      // the feature-conflict skip — mirrors the worker's railPlacementsForPolygon.
      const edgeDirX = Math.sign(dx);
      const edgeDirY = Math.sign(dy);
      const outX = edgeDirY;
      const outY = -edgeDirX;
      let side: LidRailSide;
      if (outX === 0 && outY === 1) side = 'back';
      else if (outX === 0 && outY === -1) side = 'front';
      else if (outX === 1 && outY === 0) side = 'right';
      else if (outX === -1 && outY === 0) side = 'left';
      else continue;
      if (!clickRails[side]) continue;
      if (disabledRails.has(side)) continue;
      const railLen = (Math.abs(dx) + Math.abs(dy) - 2 * lidCornerR) * coverage;
      if (railLen >= LID_MIN_RAIL_LENGTH) lengths.push(railLen);
    }
    if (lengths.length === 0) return { count: 0, lengths: [] };
    const sorted = [...lengths].sort((a, b) => b - a);
    return {
      count: lengths.length,
      lengths: sorted,
      polygonRange: { min: sorted[sorted.length - 1], max: sorted[0] },
    };
  }

  // Rectangular path: at most two distinct lengths (X-axis walls vs Y-axis walls).
  const lidOuterW = width * gridUnitMm - 2 * fitClearance;
  const lidOuterD = depth * gridUnitMmY - 2 * fitClearance;
  const railLenX = (lidOuterW - 2 * lidCornerR) * coverage;
  const railLenY = (lidOuterD - 2 * lidCornerR) * coverage;
  // Per-side count: 1 if that wall has a rail enabled AND its side isn't
  // disabled by a feature conflict. Front+back run along X axis.
  const railOn = (side: LidRailSide) => clickRails[side] && !disabledRails.has(side);
  const countX = (railOn('back') ? 1 : 0) + (railOn('front') ? 1 : 0);
  const countY = (railOn('right') ? 1 : 0) + (railOn('left') ? 1 : 0);
  const xValid = railLenX >= LID_MIN_RAIL_LENGTH ? countX : 0;
  const yValid = railLenY >= LID_MIN_RAIL_LENGTH ? countY : 0;
  const lengths: number[] = [];
  for (let i = 0; i < xValid; i++) lengths.push(railLenX);
  for (let i = 0; i < yValid; i++) lengths.push(railLenY);
  return { count: lengths.length, lengths: lengths.sort((a, b) => b - a) };
}

/**
 * Compat IDs that have a clean, single-action fix. Issues NOT in this
 * set (`shortBin`, `tallLidShortBin`, `cellMaskHoles`, `compartmentDividers`,
 * `topDownCutoutsAtLip`) require user judgment to resolve — bumping bin
 * height, lowering the extra lid height, redrawing a shape, removing
 * compartments, or editing a specific cutout — so we don't surface a
 * "Fix" button for them.
 */
const FIXABLE_IDS: ReadonlySet<LidCompatibilityId> = new Set<LidCompatibilityId>([
  'wallCutouts',
  'wallCutoutsAllSides',
  'wallPattern',
  'labelTabs',
  'handles',
  'handlesAllSides',
  'tallDividerPieces',
]);

export function useLidSection() {
  const t = useTranslation();
  const {
    lid,
    base,
    params,
    updateLid,
    updateWalls,
    updateLabel,
    updateHandles,
    updateWallPattern,
    setParam,
    setLidText,
    setSurfaceTextStyle,
    currentDesignId,
  } = useDesignerStore(
    useShallow((s) => ({
      lid: s.params.lid,
      base: s.params.base,
      params: s.params,
      updateLid: s.updateLid,
      updateWalls: s.updateWalls,
      updateLabel: s.updateLabel,
      updateHandles: s.updateHandles,
      updateWallPattern: s.updateWallPattern,
      setParam: s.setParam,
      setLidText: s.setLidText,
      setSurfaceTextStyle: s.setSurfaceTextStyle,
      currentDesignId: s.currentDesignId,
    }))
  );

  // Compatibility issues (computed early so disabledReason and effective
  // enabled gate can both reference them).
  const compatibilityIssues = useMemo(() => checkLidCompatibility(params), [params]);
  const blocked = hasLidBlocker(compatibilityIssues);
  // Per-side rail conflicts (label tabs, wall cutouts, intruding handles).
  // Derived from the already-memoized issue list — avoids running the
  // compatibility scan a second time per params change. The worker side
  // (`resolveLidInputs`) calls `computeDisabledRails(checkLidCompatibility(p))`
  // for the same source-of-truth contract.
  const disabledRails = useMemo(
    () => computeDisabledRails(compatibilityIssues),
    [compatibilityIssues]
  );

  const blockerReason = useMemo(() => {
    const blockers = compatibilityIssues.filter((i) => i.severity === 'blocker');
    return buildBlockerReason(blockers, t);
  }, [compatibilityIssues, t]);

  // The toggle is disabled either because the bin has no stacking lip
  // (existing gate) or because a feature blocker prevents the lid from
  // working. Stacking-lip wins precedence — fix that first, then revisit.
  const disabledReason = !base.stackingLip
    ? t('binDesigner.lid.requiresStackingLip')
    : (blockerReason ?? undefined);

  // Effective enabled: the lid only renders/exports when the persisted
  // flag is set AND the bin has a stacking lip AND there are no blocker
  // conflicts. Persisted state is preserved across all gating so the
  // user's intent is retained when conflicts are resolved.
  const effectiveEnabled = lid.enabled && base.stackingLip && !blocked;

  // Bin has magnets when its base style includes them. Used as the smart
  // default for lid magnetHoles each time the lid is enabled (and as a
  // hint when the user toggles magnets without a stack grid above).
  const binHasMagnets = isMagnetStyle(base.style);

  const railCoverageOptions: SnappingSliderOption[] = useMemo(
    () =>
      LID_CLICK_RAIL_COVERAGE_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.lid.clickRailCoverage.${value}`),
      })),
    [t]
  );

  const toggleEnabled = useCallback(() => {
    if (lid.enabled) {
      updateLid({ enabled: false });
    } else {
      // First enable (or re-enable): turn on the stack grid + magnets when
      // the bin already uses magnets, so the assembly's natural use case
      // (stackable lid that grips magnets) lights up without extra clicks.
      const wantMagnets = binHasMagnets;
      updateLid({
        enabled: true,
        stackableTop: wantMagnets || lid.stackableTop,
        magnetHoles: wantMagnets,
      });
    }
  }, [lid.enabled, lid.stackableTop, binHasMagnets, updateLid]);

  const setAttachment = useCallback(
    (attachment: LidAttachment) => {
      updateLid({ attachment });
    },
    [updateLid]
  );

  // Three-way top-surface picker projected onto the two persisted booleans.
  // Leaving stackable drops magnets + separate baseplate (they only mean
  // something atop a grid), and the two treatments never coexist — the
  // `setTopSurface` writes below enforce both.
  const topSurface: LidTopSurface = lid.stackableTop
    ? 'stackable'
    : lid.tray.enabled
      ? 'tray'
      : 'flat';

  const setTopSurface = useCallback(
    (mode: LidTopSurface) => {
      if (mode === 'stackable') {
        updateLid({ stackableTop: true, tray: { ...lid.tray, enabled: false } });
      } else {
        // Flat or tray: no stack grid, so magnet pockets, the lip-only variant,
        // and the separate baseplate (all grid-only) are force-cleared. Tray
        // owns the surface.
        updateLid({
          stackableTop: false,
          stackLipOnly: false,
          magnetHoles: false,
          separateStackPlate: false,
          tray: { ...lid.tray, enabled: mode === 'tray' },
        });
      }
    },
    [lid.tray, updateLid]
  );

  const setRetentionMagnetDiameter = useCallback(
    (diameter: number) => {
      const clamped = Math.min(
        LID_MAGNET_DIAMETER_MAX_MM,
        Math.max(LID_MAGNET_DIAMETER_MIN_MM, diameter)
      );
      updateLid({ retentionMagnet: { ...lid.retentionMagnet, diameter: clamped } });
    },
    [lid.retentionMagnet, updateLid]
  );

  const setRetentionMagnetDepth = useCallback(
    (depth: number) => {
      const clamped = Math.min(LID_MAGNET_DEPTH_MAX_MM, Math.max(LID_MAGNET_DEPTH_MIN_MM, depth));
      updateLid({ retentionMagnet: { ...lid.retentionMagnet, depth: clamped } });
    },
    [lid.retentionMagnet, updateLid]
  );

  const setRetentionMagnetEdgeMagnets = useCallback(
    (edgeMagnets: number) => {
      // Whole number in range; the stepper bounds input but keyboard entry can't
      // be trusted. Placement still drops any that don't fit a given edge.
      const clamped = Math.min(
        LID_MAGNET_EDGE_COUNT_MAX,
        Math.max(LID_MAGNET_EDGE_COUNT_MIN, Math.round(edgeMagnets))
      );
      updateLid({ retentionMagnet: { ...lid.retentionMagnet, edgeMagnets: clamped } });
    },
    [lid.retentionMagnet, updateLid]
  );

  const setTrayDepth = useCallback(
    (depthMm: number) => {
      const clamped = Math.min(LID_TRAY_DEPTH_MAX_MM, Math.max(LID_TRAY_DEPTH_MIN_MM, depthMm));
      updateLid({ tray: { ...lid.tray, depthMm: clamped } });
    },
    [lid.tray, updateLid]
  );

  const setTrayWall = useCallback(
    (wallMm: number) => {
      const clamped = Math.min(LID_TRAY_WALL_MAX_MM, Math.max(LID_TRAY_WALL_MIN_MM, wallMm));
      updateLid({ tray: { ...lid.tray, wallMm: clamped } });
    },
    [lid.tray, updateLid]
  );

  const toggleStackLipOnly = useCallback(() => {
    if (!lid.stackableTop) return; // Gated; UI also hides the switch.
    updateLid({ stackLipOnly: !lid.stackLipOnly });
  }, [lid.stackableTop, lid.stackLipOnly, updateLid]);

  const toggleMagnetHoles = useCallback(() => {
    if (!lid.stackableTop) return; // Gated; UI also disables the switch.
    updateLid({ magnetHoles: !lid.magnetHoles });
  }, [lid.stackableTop, lid.magnetHoles, updateLid]);

  const toggleSeparateStackPlate = useCallback(() => {
    if (!lid.stackableTop) return; // Gated; UI also disables the switch.
    updateLid({ separateStackPlate: !lid.separateStackPlate });
  }, [lid.stackableTop, lid.separateStackPlate, updateLid]);

  const setClickRailCoverage = useCallback(
    (clickRailCoverage: number) => {
      updateLid({ clickRailCoverage });
    },
    [updateLid]
  );

  const setExtraHeight = useCallback(
    (extraHeightMm: number) => {
      // Clamp defensively; the stepper already bounds input but a keyboard
      // entry could exceed the range.
      const clamped = Math.min(
        LID_EXTRA_HEIGHT_MAX_MM,
        Math.max(LID_EXTRA_HEIGHT_MIN_MM, extraHeightMm)
      );
      updateLid({ extraHeightMm: clamped });
    },
    [updateLid]
  );

  const setTopThickness = useCallback(
    (topThicknessMm: number) => {
      // Clamp defensively; the stepper bounds input but keyboard entry can't be
      // trusted. Rounding to the step keeps the plate a whole number of layers.
      const clamped = Math.min(
        LID_TOP_THICKNESS_MAX_MM,
        Math.max(LID_TOP_THICKNESS_MIN_MM, topThicknessMm)
      );
      const stepped = Math.round(clamped / LID_TOP_THICKNESS_STEP_MM) * LID_TOP_THICKNESS_STEP_MM;
      // 0.2 isn't representable in binary, so the multiply lands on values like
      // 2.4000000000000004 — harmless for geometry, but it would persist into
      // shared design JSON and the mm readout. One decimal is exact for a
      // 0.2mm step. (It never exceeds the max: the top of the range rounds to
      // exactly 25 x 0.2 === 5, so the server bound stays strict.)
      updateLid({ topThicknessMm: Math.round(stepped * 10) / 10 });
    },
    [updateLid]
  );

  const toggleClickRailSide = useCallback(
    (side: LidRailSide) => {
      updateLid({
        clickRails: { ...lid.clickRails, [side]: !lid.clickRails[side] },
      });
    },
    [lid.clickRails, updateLid]
  );

  // Convenience flag: true when at least one side has a rail. Drives the
  // rail-coverage slider visibility (no rails → nothing to dial) and the
  // valueSummary's "no rails" branch.
  const anyRail =
    lid.clickRails.front || lid.clickRails.back || lid.clickRails.left || lid.clickRails.right;

  // ── Lid-top text (#2695) ──────────────────────────────────────────────
  // Mirrors the worker gates in `resolveLidInputs`: a stackable top owns the
  // surface, and polygon lids are excluded (rectangular auto-fit).
  const lidText = params.surfaceText?.lidText ?? '';
  const textDisabledReason = lid.stackableTop
    ? t('binDesigner.lid.text.disabledStackable')
    : isPartialMask(params.cellMask)
      ? t('binDesigner.lid.text.disabledPolygon')
      : undefined;
  // Effective mode: the shared surface-text override wins over textDefaults.
  const textMode = params.surfaceText?.style?.mode ?? params.textDefaults.mode;

  // Adapter so the deferred-commit input (shared with compartment labels) can
  // take the store action by reference; the id slot is unused for the lid.
  const commitLidText = useCallback(
    (_id: number, value: string) => setLidText(value),
    [setLidText]
  );

  const setTextMode = useCallback(
    (mode: TextMode) => {
      setSurfaceTextStyle({ ...params.surfaceText?.style, mode });
    },
    [params.surfaceText, setSurfaceTextStyle]
  );

  // Lid text is gated behind a toggle like wall text and the sibling feature
  // sections. Open state is UI-only, derived as `local || hasText` so a loaded
  // design with saved lid text opens expanded and survives design switches.
  const hasLidText = lidText.trim() !== '';
  const [lidTextOpen, setLidTextOpen] = useState(false);
  // Reset the local open flag on design switch so an opened-but-empty toggle
  // doesn't carry to the next design (the hook isn't remounted). React's
  // "adjust state during render" pattern — no effect. `local || hasText` still
  // auto-opens a design that ships with saved lid text.
  const [lidTextDesignId, setLidTextDesignId] = useState(currentDesignId);
  if (lidTextDesignId !== currentDesignId) {
    setLidTextDesignId(currentDesignId);
    setLidTextOpen(false);
  }
  const isLidTextOpen = lidTextOpen || hasLidText;
  const toggleLidText = useCallback(() => {
    if (isLidTextOpen) {
      setLidText('');
      setLidTextOpen(false);
    } else {
      setLidTextOpen(true);
    }
  }, [isLidTextOpen, setLidText]);

  // Readout mirrors `lidBuilder.resolveLidInputs` so the panel matches the
  // generated geometry. Plate thickness and cavity depth come from the shared
  // resolvers rather than a local copy of the same arithmetic.
  const lidDimensions = useMemo(() => {
    // Footprint uses the mode-aware clearance so the readout shrinks by
    // 0.3mm when the user switches to magnetic retention (#2761); the
    // anchor math below stays on the base value, as in `resolveLidInputs`.
    const fitClearance = resolveLidFootprintClearance(params);
    // Y axis uses gridUnitMmY when set (non-square grid); equals X for square.
    const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
    const lidOuterW = params.width * params.gridUnitMm - 2 * fitClearance;
    const lidOuterD = params.depth * gridUnitMmY - 2 * fitClearance;
    // Lid Z extent = mating-shell depth (|wallBottomZ|) + floor plate. Both
    // grow with the cavity knobs, so the readout shows the user why the lid
    // gets taller when they add height, magnets, a tray, or plate thickness.
    const wallBottomZ = lidWallBottomZ(
      params.heightUnitMm,
      LID_FIT_CLEARANCE,
      resolveLidCavityExtraMm(params)
    );
    const topThickness = resolveLidPlateThickness(params);
    const lidH = Math.abs(wallBottomZ) + topThickness;
    return { width: lidOuterW, depth: lidOuterD, height: lidH, topThickness };
  }, [params]);

  // Lid height shifts in sub-mm steps when magnets toggle on; 1-decimal
  // precision keeps that feedback visible (matches w/d).
  const dimensionsReadout = useMemo(
    () =>
      t('binDesigner.lid.outerDimensions', {
        width: lidDimensions.width.toFixed(1),
        depth: lidDimensions.depth.toFixed(1),
        height: lidDimensions.height.toFixed(1),
      }),
    [t, lidDimensions]
  );

  const railSummary = useMemo(
    () =>
      anyRail
        ? computeRailSummary(
            params.width,
            params.depth,
            params.gridUnitMm,
            lid.clickRailCoverage,
            disabledRails,
            params.cellMask,
            lid.clickRails,
            params.gridUnitMmY ?? params.gridUnitMm
          )
        : { count: 0, lengths: [] as readonly number[] },
    [
      anyRail,
      params.width,
      params.depth,
      params.gridUnitMm,
      params.gridUnitMmY,
      params.cellMask,
      disabledRails,
      lid.clickRails,
      lid.clickRailCoverage,
    ]
  );

  const railsReadout = useMemo(() => {
    if (railSummary.count === 0) return t('binDesigner.lid.railsNone');
    if (railSummary.polygonRange) {
      const { min, max } = railSummary.polygonRange;
      // Tight range (within 1mm) collapses to a single value for clarity.
      if (max - min < 1) {
        return t('binDesigner.lid.railsCount', {
          length: max.toFixed(0),
          count: railSummary.count,
        });
      }
      return t('binDesigner.lid.railsRange', {
        min: min.toFixed(0),
        max: max.toFixed(0),
        count: railSummary.count,
      });
    }
    // Rectangular: 1 or 2 distinct lengths.
    const distinct = Array.from(new Set(railSummary.lengths.map((n) => Math.round(n))));
    if (distinct.length === 1) {
      return t('binDesigner.lid.railsCount', {
        length: distinct[0].toString(),
        count: railSummary.count,
      });
    }
    const longCount = railSummary.lengths.filter((n) => Math.round(n) === distinct[0]).length;
    const shortCount = railSummary.count - longCount;
    return t('binDesigner.lid.railsTwoAxis', {
      longLength: distinct[0].toString(),
      longCount,
      shortLength: distinct[1].toString(),
      shortCount,
    });
  }, [t, railSummary]);

  // Rich value summary for the collapsed group header. Shared with
  // `useLidGroupSummary` via the pure `lidValueSummary` helper so the header
  // can subscribe to just `lid` instead of re-running this whole hook.
  const valueSummary = useMemo(() => lidValueSummary(lid, t), [lid, t]);

  // One-click resolution for issues that have a clean automatic fix.
  // Disables the conflicting feature at the section level (e.g. walls,
  // handles, label tabs) rather than per-side, matching how each feature
  // is toggled in its own panel. Issues without a clean fix (shortBin,
  // cellMaskHoles, compartmentDividers, topDownCutoutsAtLip) don't get
  // a button surfaced in the UI — see `FIXABLE_IDS`.
  const fixIssue = useCallback(
    (id: LidCompatibilityId) => {
      switch (id) {
        case 'wallCutouts':
        case 'wallCutoutsAllSides':
          updateWalls({ enabled: false });
          return;
        case 'wallPattern':
          updateWallPattern({ enabled: false });
          return;
        case 'labelTabs':
          updateLabel({ enabled: false });
          return;
        case 'handles':
        case 'handlesAllSides':
          updateHandles({ enabled: false });
          return;
        case 'tallDividerPieces':
          setParam('dividerPieces', { ...params.dividerPieces, height: 'auto' });
          return;
        // Non-fixable issues fall through; LidSection hides the button.
        case 'shortBin':
        case 'tallLidShortBin':
        case 'cellMaskHoles':
        case 'compartmentDividers':
        case 'topDownCutoutsAtLip':
          return;
      }
    },
    [params.dividerPieces, setParam, updateHandles, updateLabel, updateWalls, updateWallPattern]
  );

  return {
    state: {
      enabled: effectiveEnabled,
      attachment: lid.attachment,
      topSurface,
      stackableTop: lid.stackableTop,
      stackLipOnly: lid.stackLipOnly,
      magnetHoles: lid.magnetHoles,
      separateStackPlate: lid.separateStackPlate,
      magnetDiameter: base.magnetDiameter,
      magnetDepth: base.magnetDepth,
      // Dedicated retention-magnet dims + bounds (magnetic mode).
      retentionMagnetDiameter: lid.retentionMagnet.diameter,
      retentionMagnetDepth: lid.retentionMagnet.depth,
      retentionMagnetDiameterMin: LID_MAGNET_DIAMETER_MIN_MM,
      retentionMagnetDiameterMax: LID_MAGNET_DIAMETER_MAX_MM,
      retentionMagnetDepthMin: LID_MAGNET_DEPTH_MIN_MM,
      retentionMagnetDepthMax: LID_MAGNET_DEPTH_MAX_MM,
      retentionMagnetStep: LID_MAGNET_DIMENSION_STEP_MM,
      // Edge magnets per long edge (#2844) — anti-sag reinforcement for big lids.
      retentionMagnetEdgeMagnets: lid.retentionMagnet.edgeMagnets,
      retentionMagnetEdgeMin: LID_MAGNET_EDGE_COUNT_MIN,
      retentionMagnetEdgeMax: LID_MAGNET_EDGE_COUNT_MAX,
      retentionMagnetEdgeStep: LID_MAGNET_EDGE_COUNT_STEP,
      // Tray recess state + bounds. Mutual exclusion with the stack grid is
      // handled by `setTopSurface`, so no disabled-reason string is needed.
      tray: lid.tray,
      trayDepthMin: LID_TRAY_DEPTH_MIN_MM,
      trayDepthMax: LID_TRAY_DEPTH_MAX_MM,
      trayWallMin: LID_TRAY_WALL_MIN_MM,
      trayWallMax: LID_TRAY_WALL_MAX_MM,
      trayStep: LID_TRAY_DIMENSION_STEP_MM,
      clickRails: lid.clickRails,
      anyRail,
      clickRailCoverage: lid.clickRailCoverage,
      extraHeightMm: lid.extraHeightMm,
      extraHeightMin: LID_EXTRA_HEIGHT_MIN_MM,
      extraHeightMax: LID_EXTRA_HEIGHT_MAX_MM,
      extraHeightStep: LID_EXTRA_HEIGHT_STEP_MM,
      // Floor-plate thickness knob (#2761). `topThicknessEffective` reflects
      // what the worker will actually build — magnet pockets and a tray recess
      // can raise the plate above the user's value.
      topThicknessMm: lid.topThicknessMm,
      topThicknessEffective: lidDimensions.topThickness,
      topThicknessMin: LID_TOP_THICKNESS_MIN_MM,
      topThicknessMax: LID_TOP_THICKNESS_MAX_MM,
      topThicknessStep: LID_TOP_THICKNESS_STEP_MM,
      // Magnetic lids get extra footprint clearance so the magnets aren't
      // fighting a friction fit; surfaced as a hint next to the mode. Derived
      // from the resolver rather than re-testing the predicate, so the hint
      // can't claim a relief the geometry didn't actually apply.
      magneticClearanceMm: LID_MAGNETIC_EXTRA_CLEARANCE,
      hasMagneticRelief: resolveLidFootprintClearance(params) > LID_FIT_CLEARANCE,
      disabledReason,
      disabledRails,
      railCoverageOptions,
      valueSummary,
      dimensionsReadout,
      railsReadout,
      compatibilityIssues,
      fixableIds: FIXABLE_IDS,
      // Lid-top text (#2695)
      lidText,
      textMode,
      textDisabledReason,
      textOnTrayFloor: topSurface === 'tray',
      isLidTextOpen,
    },
    handlers: {
      toggleEnabled,
      setAttachment,
      setTopSurface,
      toggleStackLipOnly,
      toggleMagnetHoles,
      toggleSeparateStackPlate,
      toggleClickRailSide,
      setClickRailCoverage,
      setExtraHeight,
      setTopThickness,
      setRetentionMagnetDiameter,
      setRetentionMagnetDepth,
      setRetentionMagnetEdgeMagnets,
      setTrayDepth,
      setTrayWall,
      fixIssue,
      commitLidText,
      setTextMode,
      toggleLidText,
    },
    t,
  };
}
