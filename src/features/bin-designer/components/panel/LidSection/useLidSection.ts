import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import {
  LID_CLICK_RAIL_COVERAGE_OPTIONS,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_STEP_MM,
  LID_FIT_CLEARANCE,
  LID_TOP_THICKNESS_MIN_MM,
  LID_TRAY_FLOOR,
  LID_TOP_THICKNESS_MAX_MM,
  LID_TOP_THICKNESS_STEP_MM,
  LID_MAGNETIC_EXTRA_CLEARANCE,
  resolveLidFootprintClearance,
  resolveLidPlateThickness,
  resolveLidTrayBreakdown,
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
  LID_GRIP_MODES,
  LID_GRIP_COVERAGE_MIN,
  LID_GRIP_COVERAGE_MAX,
  LID_GRIP_COVERAGE_STEP,
  lidAnchorZ,
  lidGripModeAllowed,
  hasLidGrip,
  resolveLidGripDepth,
  resolveLidGripHeightMm,
  isMagnetStyle,
  type LidAttachment,
  type LidGripMode,
  type LidRailSide,
  type TextMode,
} from '@/features/bin-designer/types';
import { isPartialMask } from '@/shared/utils/cellMask';
import { matchingTrayParams } from '@/features/bin-designer/utils/matchingTray';
import { lidWallBottomZ } from '@/features/bin-designer/components/preview/LidMesh/lidAnchorZ';
import {
  checkLidCompatibility,
  computeDisabledRails,
  hasLidBlocker,
} from '@/features/bin-designer/utils/lidCompatibility';
import type { LidCompatibilityId } from '@/features/bin-designer/utils/lidCompatibility';
import type { SnappingSliderOption } from '../../controls/SnappingSlider';
import {
  buildBlockerReason,
  computeRailSummary,
  FIXABLE_IDS,
  LID_TOP_SURFACES,
  lidValueSummary,
  type LidTopSurface,
} from './useLidSection.helpers';

export { LID_TOP_SURFACES, lidValueSummary };
export type { LidTopSurface };

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
    designName,
    newDesign,
    setParams,
    setDesignName,
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
      designName: s.designName,
      newDesign: s.newDesign,
      setParams: s.setParams,
      setDesignName: s.setDesignName,
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
        // Normalise stackLipOnly on the way IN as well as out: an imported design
        // can carry it true with stackableTop false, which would otherwise make
        // picking "Stackable" land on lip-only unannounced.
        updateLid({
          stackableTop: true,
          stackLipOnly: lid.stackableTop && lid.stackLipOnly,
          tray: { ...lid.tray, enabled: false },
        });
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
    [lid.stackableTop, lid.stackLipOnly, lid.tray, updateLid]
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
    if (!lid.stackableTop) return; // Gated; UI also hides the switch.
    updateLid({ magnetHoles: !lid.magnetHoles });
  }, [lid.stackableTop, lid.magnetHoles, updateLid]);

  const toggleSeparateStackPlate = useCallback(() => {
    if (!lid.stackableTop) return; // Gated; UI also hides the switch.
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

  // With a tray the knob measures the floor under the recess, which the
  // geometry will not take below LID_TRAY_FLOOR. The input has to enforce the
  // same floor or the field would display a value the part never uses.
  const topThicknessMin = topSurface === 'tray' ? LID_TRAY_FLOOR : LID_TOP_THICKNESS_MIN_MM;

  const setTopThickness = useCallback(
    (topThicknessMm: number) => {
      // Clamp defensively; the stepper bounds input but keyboard entry can't be
      // trusted. Rounding to the step keeps the plate a whole number of layers.
      const clamped = Math.min(LID_TOP_THICKNESS_MAX_MM, Math.max(topThicknessMin, topThicknessMm));
      const stepped = Math.round(clamped / LID_TOP_THICKNESS_STEP_MM) * LID_TOP_THICKNESS_STEP_MM;
      // 0.2 isn't representable in binary, so the multiply lands on values like
      // 2.4000000000000004 — harmless for geometry, but it would persist into
      // shared design JSON and the mm readout. One decimal is exact for a
      // 0.2mm step. (It never exceeds the max: the top of the range rounds to
      // exactly 25 x 0.2 === 5, so the server bound stays strict.)
      updateLid({ topThicknessMm: Math.round(stepped * 10) / 10 });
    },
    [updateLid, topThicknessMin]
  );

  const setGripMode = useCallback(
    (mode: LidGripMode) => {
      updateLid({ grip: { ...lid.grip, mode } });
    },
    [lid.grip, updateLid]
  );

  const toggleGripSide = useCallback(
    (side: LidRailSide) => {
      updateLid({
        grip: { ...lid.grip, sides: { ...lid.grip.sides, [side]: !lid.grip.sides[side] } },
      });
    },
    [lid.grip, updateLid]
  );

  const setGripCoverage = useCallback(
    (coverage: number) => {
      updateLid({ grip: { ...lid.grip, coverage } });
    },
    [lid.grip, updateLid]
  );

  const toggleGripBinDip = useCallback(() => {
    updateLid({ grip: { ...lid.grip, binDip: !lid.grip.binDip } });
  }, [lid.grip, updateLid]);

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

  // ── Stack top (#2930) ─────────────────────────────────────────────────
  // Both gated on `stackableTop`, matching the worker's split in
  // `resolveLidInputs`: the persisted lip-only flag can outlive a stack top.
  const lipOnlyTop = lid.stackableTop && lid.stackLipOnly;
  const stackGridOwnsTop = lid.stackableTop && !lid.stackLipOnly;
  // A single-cell footprint's grid is already one pocket, so the toggle
  // emits identical geometry — say so rather than let it read as broken.
  const stackLipOnlyIsNoOp = lipOnlyTop && params.width <= 1 && params.depth <= 1;
  // Every stackable lid exports flipped (`keepsNaturalOrientation` only spares
  // trays), which lands a lip-only top pockets-down: the floor plate becomes one
  // unsupported span instead of the grid's per-cell bridges. The separate
  // baseplate is the existing way out.
  const stackLipOnlyNeedsPlateHint = lipOnlyTop && !stackLipOnlyIsNoOp && !lid.separateStackPlate;

  // ── Lid-top text (#2695) ──────────────────────────────────────────────
  // Polygon lids are excluded (rectangular auto-fit), mirroring the worker.
  const lidText = params.surfaceText?.lidText ?? '';
  const textDisabledReason = stackGridOwnsTop
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
  // Coverage stops, mirroring how the rail slider is fed. The span itself is
  // clamped to a hand-sized range downstream, so these are intent, not mm.
  const gripCoverageOptions: SnappingSliderOption[] = useMemo(() => {
    const stops: SnappingSliderOption[] = [];
    for (let v = LID_GRIP_COVERAGE_MIN; v <= LID_GRIP_COVERAGE_MAX; v += LID_GRIP_COVERAGE_STEP) {
      stops.push({ value: v, description: '' });
    }
    return stops;
  }, []);

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
    // The seam plane, which is what bounds how tall a grip relief can be:
    // everything between it and Z=0 is the lid's visible skirt.
    const anchorZ = lidAnchorZ(
      params.heightUnitMm,
      LID_FIT_CLEARANCE,
      resolveLidCavityExtraMm(params)
    );
    return { width: lidOuterW, depth: lidOuterD, height: lidH, topThickness, anchorZ };
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

  const createMatchingTray = useCallback(() => {
    const tray = matchingTrayParams(params);
    const name = designName.trim();
    newDesign('bin');
    setParams(tray);
    setDesignName(name === '' ? t('binDesigner.lid.matchingTrayName') : `${name} tray`);
  }, [params, designName, newDesign, setParams, setDesignName, t]);

  return {
    state: {
      enabled: effectiveEnabled,
      attachment: lid.attachment,
      topSurface,
      stackableTop: lid.stackableTop,
      stackLipOnly: lid.stackLipOnly,
      stackLipOnlyIsNoOp,
      stackLipOnlyNeedsPlateHint,
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
      // Grip relief (#3272). `gripDepth` carries the clamp's own account of
      // itself so the panel can say WHY a relief is shallower than its mode
      // asks for, rather than leaving the user to read it as a defect.
      grip: lid.grip,
      gripModes: LID_GRIP_MODES,
      gripModeAllowed: (mode: LidGripMode) => lidGripModeAllowed(params, mode),
      gripAnySide:
        lid.grip.sides.front || lid.grip.sides.back || lid.grip.sides.left || lid.grip.sides.right,
      gripActive: hasLidGrip(params),
      gripDepth: resolveLidGripDepth(params),
      gripHeightMm: resolveLidGripHeightMm(lid.grip.mode, lidDimensions.anchorZ),
      gripCoverageOptions: gripCoverageOptions,
      extraHeightMm: lid.extraHeightMm,
      extraHeightMin: LID_EXTRA_HEIGHT_MIN_MM,
      extraHeightMax: LID_EXTRA_HEIGHT_MAX_MM,
      extraHeightStep: LID_EXTRA_HEIGHT_STEP_MM,
      // Floor-plate thickness knob (#2761). `topThicknessEffective` reflects
      // what the worker will actually build: magnet pockets raise the plate
      // above the user's value, and on a tray lid the value IS the floor under
      // the recess, so the plate is deeper by the recess depth (`trayBreakdown`).
      topThicknessMm: lid.topThicknessMm,
      topThicknessEffective: lidDimensions.topThickness,
      topThicknessMin,
      topThicknessMax: LID_TOP_THICKNESS_MAX_MM,
      topThicknessStep: LID_TOP_THICKNESS_STEP_MM,
      // On a tray lid the knob measures the floor under the recess, so the
      // plate and the value differ by the recess depth. Null for every other
      // lid, where the two are the same number and a breakdown says nothing.
      trayBreakdown: resolveLidTrayBreakdown(params),
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
      textOnStackLipFloor: lipOnlyTop,
      // Warning, not a gate — same treatment as the through-cut stencil note.
      textEmbossBlocksStacking: lipOnlyTop && textMode === 'emboss',
      isLidTextOpen,
    },
    handlers: {
      createMatchingTray,
      toggleEnabled,
      setAttachment,
      setTopSurface,
      toggleStackLipOnly,
      toggleMagnetHoles,
      toggleSeparateStackPlate,
      toggleClickRailSide,
      setClickRailCoverage,
      setGripMode,
      toggleGripSide,
      setGripCoverage,
      toggleGripBinDip,
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
