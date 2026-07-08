import { useCallback, useMemo } from 'react';
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
  LID_MAGNET_CEILING,
  LID_MIN_RAIL_LENGTH,
  LID_TOP_THICKNESS_BASE,
  isMagnetStyle,
  type LidClickRails,
  type LidRailSide,
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

  // Magnet pockets only do something when a bin can stack on the lid above
  // (the upper bin's base magnets meet the pocketed magnets through the
  // floor). Without `stackableTop`, the toggle is gated and the worker
  // skips the cuts even if the persisted flag is `true`.
  const magnetsRequireStackable = lid.magnetHoles && !lid.stackableTop;
  const magnetsDisabledReason = !lid.stackableTop
    ? t('binDesigner.lid.magnetsRequireStackable')
    : undefined;

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

  const toggleStackableTop = useCallback(() => {
    const next = !lid.stackableTop;
    // Disabling the stack grid also clears magnets AND the separate-baseplate
    // option — both only mean something when there IS a grid. Leaving them on
    // would silently produce a lid whose floor pockets meet nothing / a
    // baseplate split of a grid that no longer exists.
    updateLid({
      stackableTop: next,
      magnetHoles: next ? lid.magnetHoles : false,
      separateStackPlate: next ? lid.separateStackPlate : false,
    });
  }, [lid.stackableTop, lid.magnetHoles, lid.separateStackPlate, updateLid]);

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

  // Lid outer footprint mirrors `lidBuilder.resolveLidInputs` so the panel
  // readout matches the generated geometry. Floor thickness is dynamic
  // (grows when magnets need a deeper pocket) so we mirror
  // `lidTopThickness` here without importing the worker-side helper.
  const lidDimensions = useMemo(() => {
    const fitClearance = LID_FIT_CLEARANCE;
    // Y axis uses gridUnitMmY when set (non-square grid); equals X for square.
    const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
    const lidOuterW = params.width * params.gridUnitMm - 2 * fitClearance;
    const lidOuterD = params.depth * gridUnitMmY - 2 * fitClearance;
    // Lid Z extent = mating-shell depth (|wallBottomZ|) + floor plate.
    // Floor plate auto-grows for magnets — keep the readout in sync so
    // users see why the lid is taller when they enable magnets.
    // extraHeightMm deepens the cavity (issue #2482), so the readout height
    // grows with it — mirrors `resolveLidInputs`/`lidWallBottomZ`.
    const wallBottomZ = lidWallBottomZ(params.heightUnitMm, fitClearance, lid.extraHeightMm);
    const effectiveMagnets = lid.magnetHoles && lid.stackableTop;
    const topThickness = effectiveMagnets
      ? Math.max(LID_TOP_THICKNESS_BASE, base.magnetDepth + LID_MAGNET_CEILING)
      : LID_TOP_THICKNESS_BASE;
    const lidH = Math.abs(wallBottomZ) + topThickness;
    return { width: lidOuterW, depth: lidOuterD, height: lidH };
  }, [
    lid.magnetHoles,
    lid.stackableTop,
    lid.extraHeightMm,
    base.magnetDepth,
    params.width,
    params.depth,
    params.gridUnitMm,
    params.gridUnitMmY,
    params.heightUnitMm,
  ]);

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

  // Number of rail-enabled sides (out of 4). Used by valueSummary to
  // distinguish the all-on, none-on, and partial cases without leaking
  // the per-side flags into the summary string.
  const railSideCount =
    (lid.clickRails.front ? 1 : 0) +
    (lid.clickRails.back ? 1 : 0) +
    (lid.clickRails.left ? 1 : 0) +
    (lid.clickRails.right ? 1 : 0);

  // Rich value summary for the collapsed FeatureToggle header — rail
  // status + a stack/magnet hint. Three rail branches: all sides on
  // ("{coverage}% rails"), partial ("{coverage}% rails on N sides"),
  // none ("no rails"). Wall thickness/fit no longer surface here since
  // they're locked-down constants.
  const valueSummary = useMemo(() => {
    if (railSideCount === 0) {
      return t('binDesigner.lid.summaryNoRails');
    }
    if (railSideCount < 4) {
      return t('binDesigner.lid.summaryPartialRails', {
        coverage: lid.clickRailCoverage,
        sides: railSideCount,
      });
    }
    return t('binDesigner.lid.summary', {
      coverage: lid.clickRailCoverage,
    });
  }, [t, railSideCount, lid.clickRailCoverage]);

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
      stackableTop: lid.stackableTop,
      magnetHoles: lid.magnetHoles,
      separateStackPlate: lid.separateStackPlate,
      magnetsRequireStackable,
      magnetsDisabledReason,
      magnetDiameter: base.magnetDiameter,
      magnetDepth: base.magnetDepth,
      clickRails: lid.clickRails,
      anyRail,
      clickRailCoverage: lid.clickRailCoverage,
      extraHeightMm: lid.extraHeightMm,
      extraHeightMin: LID_EXTRA_HEIGHT_MIN_MM,
      extraHeightMax: LID_EXTRA_HEIGHT_MAX_MM,
      extraHeightStep: LID_EXTRA_HEIGHT_STEP_MM,
      disabledReason,
      disabledRails,
      railCoverageOptions,
      valueSummary,
      dimensionsReadout,
      railsReadout,
      compatibilityIssues,
      fixableIds: FIXABLE_IDS,
    },
    handlers: {
      toggleEnabled,
      toggleStackableTop,
      toggleMagnetHoles,
      toggleSeparateStackPlate,
      toggleClickRailSide,
      setClickRailCoverage,
      setExtraHeight,
      fixIssue,
    },
    t,
  };
}
