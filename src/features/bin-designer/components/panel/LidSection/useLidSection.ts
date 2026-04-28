import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useTranslation } from '@/i18n';
import {
  LID_CLICK_RAIL_COVERAGE_OPTIONS,
  LID_FIT_CLEARANCE,
  type LidFit,
} from '@/features/bin-designer/types';
import { isPartialMask, maskToPolygon, MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';

export const FIT_OPTIONS: readonly LidFit[] = ['loose', 'standard', 'tight'] as const;

/**
 * Minimum rail length (mm) below which the worker skips rendering — must
 * match `MIN_RAIL_LENGTH` in `lidBuilder.ts` so the UI rail readout
 * matches what actually gets generated.
 */
const MIN_RAIL_LENGTH_MM = 4;

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
  fit: LidFit,
  coveragePercent: number,
  labelEnabled: boolean,
  cellMask: ReturnType<typeof isPartialMask> extends true ? never : unknown
): RailSummary {
  const fitClearance = LID_FIT_CLEARANCE[fit];
  const lidCornerR = GRIDFINITY.BOX_CORNER_RADIUS - fitClearance;
  const coverage = coveragePercent / 100;

  // Polygon path: per-edge length analysis from the mask outline.
  if (isPartialMask(cellMask as Parameters<typeof isPartialMask>[0])) {
    const mask = cellMask as Parameters<typeof maskToPolygon>[0];
    const outer = maskToPolygon(mask)[0] ?? [];
    const halfW = (mask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
    const halfD = (mask.rows * MASK_CELL_SIZE * gridUnitMm) / 2;
    const lengths: number[] = [];
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % outer.length];
      const ax = a.x * gridUnitMm - halfW;
      const ay = a.y * gridUnitMm - halfD;
      const bx = b.x * gridUnitMm - halfW;
      const by = b.y * gridUnitMm - halfD;
      const dx = bx - ax;
      const dy = by - ay;
      const isXAxisEdge = dy === 0;
      // Match railPlacementsForPolygon's omitFrontBackRails skip (X-aligned edges).
      if (labelEnabled && isXAxisEdge) continue;
      const railLen = (Math.abs(dx) + Math.abs(dy) - 2 * lidCornerR) * coverage;
      if (railLen >= MIN_RAIL_LENGTH_MM) lengths.push(railLen);
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
  const lidOuterD = depth * gridUnitMm - 2 * fitClearance;
  const railLenX = (lidOuterW - 2 * lidCornerR) * coverage;
  const railLenY = (lidOuterD - 2 * lidCornerR) * coverage;
  // Front + back walls run along X-axis, omitted when label tabs are enabled.
  const countX = labelEnabled ? 0 : 2;
  const countY = 2;
  const xValid = railLenX >= MIN_RAIL_LENGTH_MM ? countX : 0;
  const yValid = railLenY >= MIN_RAIL_LENGTH_MM ? countY : 0;
  const lengths: number[] = [];
  for (let i = 0; i < xValid; i++) lengths.push(railLenX);
  for (let i = 0; i < yValid; i++) lengths.push(railLenY);
  return { count: lengths.length, lengths: lengths.sort((a, b) => b - a) };
}

export function useLidSection() {
  const t = useTranslation();
  const { lid, base, params, updateLid } = useDesignerStore(
    useShallow((s) => ({
      lid: s.params.lid,
      base: s.params.base,
      params: s.params,
      updateLid: s.updateLid,
    }))
  );

  const requiresStackingLipReason = !base.stackingLip
    ? t('binDesigner.lid.requiresStackingLip')
    : undefined;

  // Effective enabled: the lid only renders/exports when both `lid.enabled`
  // is set AND the bin has a stacking lip to mate with. The persisted flag
  // is preserved so flipping the lip back on restores the user's choice;
  // the UI just reflects the gated state until then.
  const effectiveEnabled = lid.enabled && base.stackingLip;

  // Bin has magnets when its base style includes them. Used as the smart
  // default for lid magnetHoles each time the lid is enabled.
  const binHasMagnets = base.style === 'magnet' || base.style === 'magnet_and_screw';

  const thicknessOptions: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}`),
      })),
    [t]
  );

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
      // First enable (or re-enable) auto-syncs magnetHoles to bin's magnet
      // state so the lid matches by default. User can override afterwards.
      updateLid({ enabled: true, magnetHoles: binHasMagnets });
    }
  }, [lid.enabled, binHasMagnets, updateLid]);

  const setFit = useCallback(
    (fit: LidFit) => {
      updateLid({ fit });
    },
    [updateLid]
  );

  const toggleStackableTop = useCallback(() => {
    updateLid({ stackableTop: !lid.stackableTop });
  }, [lid.stackableTop, updateLid]);

  const toggleMagnetHoles = useCallback(() => {
    updateLid({ magnetHoles: !lid.magnetHoles });
  }, [lid.magnetHoles, updateLid]);

  const setWallThickness = useCallback(
    (wallThickness: number) => {
      updateLid({ wallThickness });
    },
    [updateLid]
  );

  const setTopThickness = useCallback(
    (topThickness: number) => {
      updateLid({ topThickness });
    },
    [updateLid]
  );

  const setClickRailCoverage = useCallback(
    (clickRailCoverage: number) => {
      updateLid({ clickRailCoverage });
    },
    [updateLid]
  );

  // Lid outer footprint mirrors `lidBuilder.resolveLidInputs` so the panel
  // readout matches the generated geometry.
  const lidDimensions = useMemo(() => {
    const fitClearance = LID_FIT_CLEARANCE[lid.fit];
    const lidOuterW = params.width * params.gridUnitMm - 2 * fitClearance;
    const lidOuterD = params.depth * params.gridUnitMm - 2 * fitClearance;
    // Lid Z extent is roughly one height-unit (mating shell + floor + small extras);
    // matches the bin's height-unit so users can reason about stack heights.
    const lidH = params.heightUnitMm;
    return { width: lidOuterW, depth: lidOuterD, height: lidH };
  }, [lid.fit, params.width, params.depth, params.gridUnitMm, params.heightUnitMm]);

  const dimensionsReadout = useMemo(
    () =>
      t('binDesigner.lid.outerDimensions', {
        width: lidDimensions.width.toFixed(1),
        depth: lidDimensions.depth.toFixed(1),
        height: lidDimensions.height.toFixed(0),
      }),
    [t, lidDimensions]
  );

  const railSummary = useMemo(
    () =>
      computeRailSummary(
        params.width,
        params.depth,
        params.gridUnitMm,
        lid.fit,
        lid.clickRailCoverage,
        params.label.enabled,
        params.cellMask as never
      ),
    [
      params.width,
      params.depth,
      params.gridUnitMm,
      params.cellMask,
      params.label.enabled,
      lid.fit,
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

  // Rich value summary for the collapsed FeatureToggle header — fit +
  // rail coverage + wall thickness, separated by middle dots. Matches
  // BaseSection's information density.
  const valueSummary = useMemo(
    () =>
      t('binDesigner.lid.summary', {
        fit: t(`binDesigner.lid.fit.${lid.fit}`),
        coverage: lid.clickRailCoverage,
        wall: lid.wallThickness,
      }),
    [t, lid.fit, lid.clickRailCoverage, lid.wallThickness]
  );

  return {
    state: {
      enabled: effectiveEnabled,
      fit: lid.fit,
      stackableTop: lid.stackableTop,
      magnetHoles: lid.magnetHoles,
      wallThickness: lid.wallThickness,
      topThickness: lid.topThickness,
      clickRailCoverage: lid.clickRailCoverage,
      requiresStackingLipReason,
      thicknessOptions,
      railCoverageOptions,
      valueSummary,
      dimensionsReadout,
      railsReadout,
    },
    handlers: {
      toggleEnabled,
      setFit,
      toggleStackableTop,
      toggleMagnetHoles,
      setWallThickness,
      setTopThickness,
      setClickRailCoverage,
    },
    t,
  };
}
