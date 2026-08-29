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
  hasAnyLidGripSide,
  resolveLidGripDepth,
  resolveLidGripHeightPlan,
  LID_GRIP_HEIGHT_MIN_MM,
  LID_GRIP_HEIGHT_MAX_MM,
  LID_GRIP_HEIGHT_STEP_MM,
  isMagnetStyle,
  type LidAttachment,
  type LidGripConfig,
  type LidGripMode,
  type LidRailSide,
  type TextMode,
} from '@/features/bin-designer/types';
import { planHingeLid, hingePinLengths } from '@/shared/utils/hingeLidPlan';
import { isPartialMask } from '@/shared/utils/cellMask';
import { railFoulingLabelFootprints } from '@/shared/utils/labelTabPlan';
import { dividerRailBlocks } from '@/shared/utils/dividerRailPlan';
import { lipGapRailBlocks, lipGaps, polygonLipGaps } from '@/shared/utils/lipGapPlan';
import { resolveOverhang, overhangExpansion, hasOverhang } from '@/shared/utils/overhang';
import { matchingTrayParams } from '@/features/bin-designer/utils/matchingTray';
import { lidWallBottomZ } from '@/features/bin-designer/components/preview/LidMesh/lidAnchorZ';
import { lidCutoutsAllowed } from '@/shared/utils/lidCutoutPlan';
import { MAX_LID_CUTOUTS } from '@/features/bin-designer/types';
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
import {
  isSlideLid,
  isHingeLid,
  resolveLidHinge,
  hingeOppositeSide,
  LID_HINGE_CATCHES,
  LID_HINGE_FIT_MIN_MM,
  LID_HINGE_FIT_MAX_MM,
  LID_HINGE_FIT_STEP_MM,
  LID_HINGE_PIN_MM,
  LID_SLIDE_CLEARANCE_MIN_MM,
  LID_SLIDE_CLEARANCE_MAX_MM,
  LID_SLIDE_CLEARANCE_STEP_MM,
  LID_SLIDE_PLACEMENTS,
  LID_SLIDE_PULLS,
  LID_RAIL_SIDES,
  LID_RAIL_SIDES as LID_SLIDE_ENTRY_SIDES,
  resolveLidSlide,
} from '@/features/bin-designer/types/lid';
import type {
  LidSlidePlacement,
  LidSlidePull,
  LidHingeCatch,
} from '@/features/bin-designer/types/lid';
import { slideLidPlanForParams } from '@/features/bin-designer/utils/slideLidPlanForParams';
import { slideSagSafeThicknessMm } from '@/shared/utils/slideLidPlan';

export { LID_TOP_SURFACES, lidValueSummary };
export type { LidTopSurface };

/**
 * Drop a stored `reveal` when the lid gains a stackable top. A shadow line
 * moves the face an upper bin registers against; left stored it would be a
 * mode the geometry silently drops and the SERVER rejects outright on
 * share/publish (`validateLidGrip`) — an invalid design the user never chose.
 * Every other mode leaves that face alone and is kept as-is.
 */
function clearRevealGrip(grip: LidGripConfig): LidGripConfig {
  return grip.mode === 'reveal' ? { ...grip, mode: 'none' } : grip;
}

/** Coverage stops that carry their own copy; the rest render bare. */
const DESCRIBED_RAIL_COVERAGES = new Set([50, 75, 100]);

export function useLidSection() {
  const t = useTranslation();
  const {
    lid,
    base,
    params,
    updateLid,
    updateBase,
    updateWalls,
    updateHandles,
    updateWallPattern,
    setParam,
    setLidText,
    setLidTextStyle,
    currentDesignId,
    designName,
    newDesign,
    setParams,
    setDesignName,
    setCutoutEditorOpen,
  } = useDesignerStore(
    useShallow((s) => ({
      lid: s.params.lid,
      base: s.params.base,
      params: s.params,
      updateLid: s.updateLid,
      updateBase: s.updateBase,
      updateWalls: s.updateWalls,
      updateHandles: s.updateHandles,
      updateWallPattern: s.updateWallPattern,
      setParam: s.setParam,
      setLidText: s.setLidText,
      setLidTextStyle: s.setLidTextStyle,
      currentDesignId: s.currentDesignId,
      designName: s.designName,
      newDesign: s.newDesign,
      setParams: s.setParams,
      setDesignName: s.setDesignName,
      setCutoutEditorOpen: s.setCutoutEditorOpen,
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
  // Label tabs no longer disable a whole side, so the rail summary has to read
  // the same footprints the worker segments against or it reports rails on a
  // wall the tabs have taken.
  const labelFootprints = useMemo(() => railFoulingLabelFootprints(params), [params]);
  // Same reason, for the dividers the rails now notch around and for
  // the cutouts and handle holes they stop short of.
  const wallBlocks = useMemo(
    () => [...dividerRailBlocks(params), ...lipGapRailBlocks(lipGaps(params))],
    [params]
  );
  // Custom shapes clip per EDGE rather than per side, so their gaps travel
  // separately — see `polygonLipGaps`.
  const polygonGaps = useMemo(() => polygonLipGaps(params), [params]);
  // The lid wraps the bin's overhang-expanded body, so the readout has to use
  // the same walls the worker places rails on.
  const outerExpansion = useMemo(() => {
    const resolved = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang);
    return hasOverhang(resolved) ? overhangExpansion(resolved) : { addW: 0, addD: 0 };
  }, [params.cellMask, params.overhang]);

  const blockerReason = useMemo(() => {
    const blockers = compatibilityIssues.filter((i) => i.severity === 'blocker');
    return buildBlockerReason(blockers, t);
  }, [compatibilityIssues, t]);

  // The toggle is disabled either because the bin has no stacking lip
  // (existing gate) or because a feature blocker prevents the lid from
  // working. Stacking-lip wins precedence — fix that first, then revisit.
  // A sliding lid is held by a channel of its own, and its `flush` placement
  // requires the lip to be ABSENT — so the precondition follows the attachment.
  // `shouldGenerateLid` makes the same distinction; a second, differently-gated
  // copy here is how a panel ends up refusing a lid the worker builds.
  const isSlide = isSlideLid(lid);
  const isHinge = isHingeLid(lid);
  const needsStackingLip = !isSlide;
  // Resolved unconditionally: the adapter answers `'not-slide'` for any other
  // attachment, so the panel can read it without guarding first.
  const slidePlan = slideLidPlanForParams(params);
  // The stored config, or the factory one when the design has never carried an
  // opinion — see `LidConfig.slide`, which stays ABSENT so the params
  // fingerprint of every already-published design is unchanged. Writing through
  // the resolved value is what turns the first edit into a complete object.
  const slide = resolveLidSlide(lid);
  const hinge = resolveLidHinge(lid);
  // The plan's own account of the joint, so the panel never restates geometry
  // the worker builds from: the pin lengths it quotes are the ones the barrel
  // is actually bored for, and they change as the bin is resized.
  const hingePlan = planHingeLid(params);
  const stackingLipMissing = needsStackingLip && !base.stackingLip;
  const disabledReason = stackingLipMissing
    ? t('binDesigner.lid.requiresStackingLip')
    : (blockerReason ?? undefined);

  // Effective enabled: the lid only renders/exports when the persisted
  // flag is set AND the bin has a stacking lip AND there are no blocker
  // conflicts. Persisted state is preserved across all gating so the
  // user's intent is retained when conflicts are resolved.
  const effectiveEnabled = lid.enabled && (base.stackingLip || !needsStackingLip) && !blocked;

  // Bin has magnets when its base style includes them. Used as the smart
  // default for lid magnetHoles each time the lid is enabled (and as a
  // hint when the user toggles magnets without a stack grid above).
  const binHasMagnets = isMagnetStyle(base.style);

  // Only the three original stops carry copy. The intermediate steps
  // are self-explanatory percentages between them, and inventing a caption for
  // each would put eight more strings into fourteen locales to say nothing.
  const railCoverageOptions: SnappingSliderOption[] = useMemo(
    () =>
      LID_CLICK_RAIL_COVERAGE_OPTIONS.map((value) => ({
        value,
        description: DESCRIBED_RAIL_COVERAGES.has(value)
          ? t(`binDesigner.lid.clickRailCoverage.${value}`)
          : '',
      })),
    [t]
  );

  // The span itself is clamped to a hand-sized range downstream, so these
  // stops are intent, not mm.
  const gripCoverageOptions: SnappingSliderOption[] = useMemo(() => {
    const stops: SnappingSliderOption[] = [];
    for (let v = LID_GRIP_COVERAGE_MIN; v <= LID_GRIP_COVERAGE_MAX; v += LID_GRIP_COVERAGE_STEP) {
      stops.push({ value: v, description: '' });
    }
    return stops;
  }, []);

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
      // Switching TO a hinge seeds a thumb lift, once.
      //
      // A hinged lid must have somewhere to get a finger under, opposite the
      // axis — and the default grip is `none`, so out of the box a hinged lid
      // would be a flush plate with nothing to lift. `lidGripRelief` already
      // builds exactly the right thing, so this points at it rather than
      // inventing a second affordance.
      //
      // Only when the grip is still UNTOUCHED. Overwriting a configured relief
      // would be silently rewriting a part the user did not ask about, which is
      // the line the sliding lid's flush placement also refuses to cross — it
      // reports a blocker instead of turning the stacking lip off for you.
      if (attachment === 'hinge' && lid.grip.mode === 'none') {
        const opposite = hingeOppositeSide(resolveLidHinge(lid).side);
        updateLid({
          attachment,
          grip: {
            ...lid.grip,
            mode: 'scallop',
            sides: { front: false, back: false, left: false, right: false, [opposite]: true },
            binDip: true,
          },
        });
        return;
      }
      updateLid({ attachment });
    },
    [lid, updateLid]
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
          grip: clearRevealGrip(lid.grip),
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
    [lid.stackableTop, lid.stackLipOnly, lid.tray, lid.grip, updateLid]
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
    const separateStackPlate = !lid.separateStackPlate;
    updateLid({
      separateStackPlate,
      grip: separateStackPlate ? clearRevealGrip(lid.grip) : lid.grip,
    });
  }, [lid.stackableTop, lid.separateStackPlate, lid.grip, updateLid]);

  // Opens the shared cutout editor pointed at the lid. Every cutout action reads
  // `ui.cutoutTarget` (see `cutoutOwner`), so this one call is what redirects the
  // whole editor rather than a lid-specific copy of it.
  const openLidCutoutEditor = useCallback(() => {
    setCutoutEditorOpen(true, 'lid');
  }, [setCutoutEditorOpen]);

  const toggleRelieveInterior = useCallback(() => {
    updateLid({ relieveInterior: !lid.relieveInterior });
  }, [lid.relieveInterior, updateLid]);

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

  /**
   * `null` returns the height to the mode's own request. Numbers are clamped
   * and rounded to one decimal here, for the same reason `setTopThickness`
   * does: a 0.2mm step accumulated in floating point otherwise writes
   * 1.7999999999999998 into the shared design JSON.
   */
  const setGripHeight = useCallback(
    (heightMm: number | null) => {
      const value =
        heightMm === null
          ? null
          : Math.round(
              Math.min(Math.max(heightMm, LID_GRIP_HEIGHT_MIN_MM), LID_GRIP_HEIGHT_MAX_MM) * 10
            ) / 10;
      updateLid({ grip: { ...lid.grip, heightMm: value } });
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

  // ── Stack top ─────────────────────────────────────────────────
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

  // ── Lid-top text ──────────────────────────────────────────────
  // Polygon lids are excluded (rectangular auto-fit), mirroring the worker.
  const lidText = params.surfaceText?.lidText ?? '';
  const textDisabledReason = stackGridOwnsTop
    ? t('binDesigner.lid.text.disabledStackable')
    : isPartialMask(params.cellMask)
      ? t('binDesigner.lid.text.disabledPolygon')
      : undefined;
  // Effective mode, resolved through the same three layers the worker uses: the
  // design defaults, the style shared by every surface, then the lid's own.
  const textMode =
    params.surfaceText?.lidStyle?.mode ??
    params.surfaceText?.style?.mode ??
    params.textDefaults.mode;

  // Adapter so the deferred-commit input (shared with compartment labels) can
  // take the store action by reference; the id slot is unused for the lid.
  const commitLidText = useCallback(
    (_id: number, value: string) => setLidText(value),
    [setLidText]
  );

  // Written as the LID's own override, not the shared style. This control sits
  // under the lid's caption and reads as being about the lid, but the shared
  // style also drives all four walls: pointing it there changed the walls to
  // emboss because someone embossed their lid.
  const setTextMode = useCallback(
    (mode: TextMode) => {
      setLidTextStyle({ ...params.surfaceText?.lidStyle, mode });
    },
    [params.surfaceText, setLidTextStyle]
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
    // 0.3mm when the user switches to magnetic retention; the
    // anchor math below stays on the base value, as in `resolveLidInputs`.
    const fitClearance = resolveLidFootprintClearance(params);
    // Y axis uses gridUnitMmY when set (non-square grid); equals X for square.
    const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
    const lidOuterW = params.width * params.gridUnitMm - 2 * fitClearance;
    const lidOuterD = params.depth * gridUnitMmY - 2 * fitClearance;
    // Lid Z extent = mating-shell depth (|wallBottomZ|) + floor plate. Both
    // grow with the cavity knobs, so the readout shows the user why the lid
    // gets taller when they add height, magnets, a tray, or plate thickness.
    const cavityExtra = resolveLidCavityExtraMm(params);
    const wallBottomZ = lidWallBottomZ(params.heightUnitMm, LID_FIT_CLEARANCE, cavityExtra);
    const topThickness = resolveLidPlateThickness(params);
    const lidH = Math.abs(wallBottomZ) + topThickness;
    // The seam plane, which is what bounds how tall a grip relief can be:
    // everything between it and Z=0 is the lid's visible skirt.
    const anchorZ = lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, cavityExtra);
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
            params.gridUnitMmY ?? params.gridUnitMm,
            labelFootprints,
            outerExpansion,
            wallBlocks,
            polygonGaps
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
      labelFootprints,
      outerExpansion,
      wallBlocks,
      polygonGaps,
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
    const distinct = Array.from(new Set(railSummary.lengths.map((n) => Math.round(n))));
    if (distinct.length === 1) {
      return t('binDesigner.lid.railsCount', {
        length: distinct[0].toString(),
        count: railSummary.count,
      });
    }
    // Segmenting around label tabs can leave more than the two lengths
    // a rectangle used to have (one per axis), and the two-axis form would drop
    // the third and mislabel its rails with the second's length.
    if (distinct.length > 2) {
      return t('binDesigner.lid.railsRange', {
        min: distinct[distinct.length - 1].toString(),
        max: distinct[0].toString(),
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
        case 'handles':
        case 'handlesAllSides':
          updateHandles({ enabled: false });
          return;
        case 'tallDividerPieces':
          setParam('dividerPieces', { ...params.dividerPieces, height: 'auto' });
          return;
        case 'slideFlushNeedsNoLip':
          updateBase({ stackingLip: false });
          return;
        // Non-fixable issues fall through; LidSection hides the button.
        case 'shortBin':
        case 'tallLidShortBin':
        case 'cellMaskHoles':
        case 'compartmentDividers':
        case 'topDownCutoutsAtLip':
        case 'slideUnbuildable':
        case 'slideInteriorBlocked':
        case 'slideLongSpan':
        case 'slideRimInterrupted':
        case 'slideChannelInterrupted':
        case 'slideWallPattern':
          return;
      }
    },
    [params.dividerPieces, setParam, updateBase, updateHandles, updateWalls, updateWallPattern]
  );

  const setHingeSide = useCallback(
    (side: LidRailSide) => {
      updateLid({ hinge: { ...hinge, side } });
    },
    [hinge, updateLid]
  );

  const setHingeCatch = useCallback(
    (catchMode: LidHingeCatch) => {
      updateLid({ hinge: { ...hinge, catchMode } });
    },
    [hinge, updateLid]
  );

  const setHingeFit = useCallback(
    (value: number) => {
      const clamped = Math.min(LID_HINGE_FIT_MAX_MM, Math.max(LID_HINGE_FIT_MIN_MM, value));
      // Rounded, not snapped to the step — same reasoning as
      // `setSlideClearance`: this is the one hinge number whose right answer
      // depends on the printer and the filament, so someone dialling a fit in
      // from a test print keeps 0.23 instead of being pushed back to 0.25.
      updateLid({ hinge: { ...hinge, fitClearanceMm: Math.round(clamped * 100) / 100 } });
    },
    [hinge, updateLid]
  );

  const setSlidePlacement = useCallback(
    (placement: LidSlidePlacement) => {
      updateLid({ slide: { ...slide, placement } });
    },
    [slide, updateLid]
  );

  const setSlideEntrySide = useCallback(
    (entrySide: LidRailSide) => {
      updateLid({ slide: { ...slide, entrySide } });
    },
    [slide, updateLid]
  );

  const setSlidePull = useCallback(
    (pull: LidSlidePull) => {
      updateLid({ slide: { ...slide, pull } });
    },
    [slide, updateLid]
  );

  const toggleSlideDetent = useCallback(() => {
    updateLid({ slide: { ...slide, detent: !slide.detent } });
  }, [slide, updateLid]);

  const setSlideClearance = useCallback(
    (value: number) => {
      const clamped = Math.min(
        LID_SLIDE_CLEARANCE_MAX_MM,
        Math.max(LID_SLIDE_CLEARANCE_MIN_MM, value)
      );
      // Rounded to a hundredth, NOT snapped to `LID_SLIDE_CLEARANCE_STEP_MM`.
      // The step is the stepper's increment, not a lattice the value has to lie
      // on: this is the one knob that exists because the right answer depends on
      // the printer, and someone dialling a fit in from a test print wants 0.23
      // rather than being pushed back to 0.25. The rounding is only there to
      // keep float noise out of a typed value. `setTopThickness` treats its own
      // step the same way.
      updateLid({ slide: { ...slide, clearanceMm: Math.round(clamped * 100) / 100 } });
    },
    [slide, updateLid]
  );

  const createMatchingTray = useCallback(() => {
    const tray = matchingTrayParams(params);
    const name = designName.trim();
    newDesign('bin');
    setParams(tray);
    setDesignName(name === '' ? t('binDesigner.lid.matchingTrayName') : `${name} tray`);
  }, [params, designName, newDesign, setParams, setDesignName, t]);

  // The relief's two clamps, resolved once: the height reads the depth, since
  // a chamfer's 45° section is sized by whichever of the two is scarcer.
  const gripDepth = resolveLidGripDepth(params);
  const gripHeight = resolveLidGripHeightPlan(lid.grip, lidDimensions.anchorZ, gripDepth.depthMm);

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
      // Edge magnets per long edge — anti-sag reinforcement for big lids.
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
      relieveInterior: lid.relieveInterior,
      // Sliding lid. `slidePlan` carries the resolver's own account of the
      // joint — the free span the sag warning is about and the thickness that
      // would carry it — so the panel never restates arithmetic the worker
      // builds from.
      // Hinged lid. `hingePlan` carries the resolver's own account of the
      // joint — the pins it needs and why it refused, if it did — so the panel
      // cannot quote a length the barrel is not bored for.
      isHinge,
      hinge,
      hingeCatches: LID_HINGE_CATCHES,
      hingeSides: LID_RAIL_SIDES,
      hingeFitMin: LID_HINGE_FIT_MIN_MM,
      hingeFitMax: LID_HINGE_FIT_MAX_MM,
      hingeFitStep: LID_HINGE_FIT_STEP_MM,
      hingePinMm: LID_HINGE_PIN_MM,
      hingePinLengths: hingePinLengths(params),
      hingeRejection: hingePlan.rejection,
      isSlide,
      slide,
      slidePlacements: LID_SLIDE_PLACEMENTS,
      slideEntrySides: LID_SLIDE_ENTRY_SIDES,
      slidePulls: LID_SLIDE_PULLS,
      slideClearanceMin: LID_SLIDE_CLEARANCE_MIN_MM,
      slideClearanceMax: LID_SLIDE_CLEARANCE_MAX_MM,
      slideClearanceStep: LID_SLIDE_CLEARANCE_STEP_MM,
      slideFreeSpanMm: slidePlan.geometry?.freeSpanMm ?? null,
      slideSagThicknessMm: slidePlan.geometry
        ? slideSagSafeThicknessMm(slidePlan.geometry.freeSpanMm)
        : null,
      // Lid cutouts: whether the host can take them at all, and how many it has.
      // `allowed` is the plan's own gate rather than a restatement of it, so the
      // button cannot offer an editor the worker would refuse to cut.
      cutouts: {
        allowed: lidCutoutsAllowed(params),
        count: lid.cutouts?.length ?? 0,
        // The store refuses past the cap and the server rejects an oversized
        // payload, so the limit has to be legible BEFORE a shape silently fails
        // to appear.
        atCapacity: (lid.cutouts?.length ?? 0) >= MAX_LID_CUTOUTS,
        max: MAX_LID_CUTOUTS,
      },
      // Grip relief. `gripDepth` carries the clamp's own account of
      // itself so the panel can say WHY a relief is shallower than its mode
      // asks for, rather than leaving the user to read it as a defect.
      grip: lid.grip,
      gripModes: LID_GRIP_MODES,
      gripModeAllowed: (mode: LidGripMode) => lidGripModeAllowed(params, mode),
      gripAnySide: hasAnyLidGripSide(lid.grip.sides),
      gripActive: hasLidGrip(params),
      gripDepth,
      // `gripHeight` reports the skirt budget and the skin left above the cut
      // as well as the height itself: the reason the knob exists is the
      // material above a pocket, and that number is invisible in the model.
      gripHeight,
      gripHeightMin: LID_GRIP_HEIGHT_MIN_MM,
      gripHeightMax: LID_GRIP_HEIGHT_MAX_MM,
      gripHeightStep: LID_GRIP_HEIGHT_STEP_MM,
      gripCoverageOptions,
      extraHeightMm: lid.extraHeightMm,
      extraHeightMin: LID_EXTRA_HEIGHT_MIN_MM,
      extraHeightMax: LID_EXTRA_HEIGHT_MAX_MM,
      extraHeightStep: LID_EXTRA_HEIGHT_STEP_MM,
      // Floor-plate thickness knob. `topThicknessEffective` reflects
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
      stackingLipMissing,
      disabledRails,
      railCoverageOptions,
      valueSummary,
      dimensionsReadout,
      railsReadout,
      compatibilityIssues,
      fixableIds: FIXABLE_IDS,
      // Lid-top text
      lidText,
      textMode,
      textDisabledReason,
      textDisabledByStackGrid: stackGridOwnsTop,
      textOnTrayFloor: topSurface === 'tray',
      textOnStackLipFloor: lipOnlyTop,
      // Warning, not a gate — same treatment as the through-cut stencil note.
      textEmbossBlocksStacking: lipOnlyTop && textMode === 'emboss',
      isLidTextOpen,
    },
    handlers: {
      enableStackingLip: () => updateBase({ stackingLip: true }),
      createMatchingTray,
      toggleEnabled,
      setAttachment,
      setTopSurface,
      toggleStackLipOnly,
      toggleMagnetHoles,
      toggleSeparateStackPlate,
      toggleClickRailSide,
      setClickRailCoverage,
      toggleRelieveInterior,
      setHingeSide,
      setHingeCatch,
      setHingeFit,
      setSlidePlacement,
      setSlideEntrySide,
      setSlidePull,
      toggleSlideDetent,
      setSlideClearance,
      openLidCutoutEditor,
      setGripMode,
      toggleGripSide,
      setGripCoverage,
      setGripHeight,
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
