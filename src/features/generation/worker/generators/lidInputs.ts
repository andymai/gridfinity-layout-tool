/**
 * Resolved lid-geometry inputs derived from BinParams.
 *
 * The lid builder pipeline takes a `LidInputs` value rather than raw
 * `BinParams` so each builder phase only needs the fields it cares about
 * and the conversions (clearance, corner radius, anchor Z) happen once.
 */

import type {
  BinParams,
  Cutout,
  LidAttachment,
  LidCompatibilitySide,
  LidGripMode,
  LidGripSides,
  TextStyleDefaults,
} from '@/shared/types/bin';
import type { MagnetAnchor } from '@/core/types';
import type { LidRailSide } from '@/shared/types/bin';
import {
  checkLidCompatibility,
  computeDisabledRails,
  resolveLidFootprintClearance,
  resolveLidPlateThickness,
  resolveLidCavityExtraMm,
  resolveLidGripDepth,
  resolveLidGripHeightPlan,
  hasLidGrip,
  hasBinLipDip,
  resolveTextStyle,
} from '@/shared/types/bin';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { railFoulingLabelFootprints } from '@/shared/utils/labelTabPlan';
import type { LabelTabFootprint } from '@/shared/utils/labelTabPlan';
import { dividerRailBlocks } from '@/shared/utils/dividerRailPlan';
import { lipGapRailBlocks, lipGaps, polygonLipGaps } from '@/shared/utils/lipGapPlan';
import type { PolygonLipGap } from '@/shared/utils/lipGapPlan';
import type { WallSpanBlock } from '@/shared/utils/labelTabPlan';
import { LID_FIT_CLEARANCE, LID_CORNER_RADIUS, lidAnchorZ, lidWallBottomZ } from './lidConstants';
import { resolveOverhang, overhangExpansion, hasOverhang } from './overhang';
import { lidCutoutHostFace, lidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import type { LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import { isSlideLid, slideLidPlanForParams } from '@/shared/types/bin';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { LID_HINGE_DETENT_COVERAGE } from '@/shared/types/bin';
import type { SlideLidGeometry } from '@/shared/utils/slideLidPlan';

/**
 * Resolved lid-top text: the trimmed string plus the effective
 * style — the design's `textDefaults` merged with the shared surface-text
 * override. Null when there's no text or a gate rejects it (full stack
 * grid, polygon footprint).
 */
export interface LidTextInputs {
  readonly value: string;
  /**
   * The whole resolved style, not a copy of the fields the builder happens to
   * read today. Anchoring, tracking, case and cut profile all reach the lid
   * through it, and a field added later needs no change here.
   */
  readonly style: TextStyleDefaults & { readonly fontSizeOverride?: number };
}

/**
 * Resolved lid cutouts: the shapes, the window they are positioned in, and the
 * plate they cut through.
 *
 * The window and the host face come from `lidCutoutPlan` rather than being
 * re-derived here, because the editor draws its shapes against the same numbers
 * and a second derivation is how a placement and its geometry drift apart.
 */
export interface LidCutoutInputs {
  readonly shapes: readonly Cutout[];
  readonly window: LidCutoutWindow;
  /** Lid-local Z of the surface the cuts start from. */
  readonly topZ: number;
  /** Plate depth (mm) below {@link topZ} — every cut spans all of it. */
  readonly thickness: number;
  /** Design-wide type style — a text element's caption resolves through it. */
  readonly textDefaults: BinParams['textDefaults'];
}

/** Geometric inputs derived from BinParams. */
export interface LidInputs {
  readonly lidOuterW: number;
  readonly lidOuterD: number;
  readonly lidCornerR: number;
  /**
   * Per-side FOOTPRINT clearance. `LID_FIT_CLEARANCE`, plus
   * `LID_MAGNETIC_EXTRA_CLEARANCE` on a lid that actually gets retention
   * magnets, so they aren't fighting a friction fit. NOT every
   * `attachment: 'magnetic'` config: a lip-less or polygon bin generates no
   * corner bosses and keeps the base value — see
   * `resolveLidFootprintClearance`. Not the anchor clearance either;
   * `anchorZ`/`wallBottomZ` are deliberately computed from the base value.
   */
  readonly fitClearance: number;
  readonly topThickness: number;
  /**
   * Total cavity depth added below the standard one-grid-unit lid — the
   * `extraHeightMm` knob plus floor-plate growth. Retention bosses hang from
   * the cavity BOTTOM, so they lengthen by this to stay at the lip.
   */
  readonly cavityExtraMm: number;
  /**
   * Cavity inner-face inset from the lid's outer perimeter. The wall in
   * the lip-mating zone is `cavityInset - LIP_BIG_TAPER = LID_WALL_THICKNESS`
   * (= 1.85mm); above the lip the chamfer hasn't kicked in yet so the
   * wall reads as the full `cavityInset` (= 3.75mm).
   */
  readonly cavityInset: number;
  readonly stackableTop: boolean;
  /**
   * Already gated on `stackableTop` here, so `buildStackGrid` can branch on the
   * flag directly. See {@link LidConfig.stackLipOnly}.
   */
  readonly stackLipOnly: boolean;
  /**
   * When true, the stack grid is NOT fused into the lid — it's emitted as a
   * standalone companion slab (glued on by the user). Already gated on
   * `stackableTop` here, so consumers can check it directly. See
   * {@link LidConfig.separateStackPlate}.
   */
  readonly separateStackPlate: boolean;
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  /** Retention mode. Drives which retention geometry the builder emits. */
  readonly attachment: LidAttachment;
  /**
   * Whether to emit lid-to-bin retention magnets. True only when
   * `attachment === 'magnetic'` and the footprint is rectangular (polygon bins
   * are excluded). Dedicated dims — independent of the stack `magnet*` fields.
   */
  readonly retentionMagnets: boolean;
  /**
   * The wall a hinged lid's magnet catch pins, or `null` for the four-corner
   * placement a magnetic attachment asks for. Resolved here so the boss builder
   * and the bin's pad stage filter through one call with the same answer.
   */
  readonly retentionMagnetSide: LidRailSide | null;
  readonly retentionMagnetDiameter: number;
  readonly retentionMagnetDepth: number;
  /** Extra magnets per long edge; 0 = the classic four-corner lid. */
  readonly retentionMagnetEdgeMagnets: number;
  /**
   * Resolved tray recess. `enabled` is already gated on `!stackableTop` here,
   * so the builder can trust it directly. Dimensions are pre-clamped upstream.
   */
  readonly tray: { readonly enabled: boolean; readonly depthMm: number; readonly wallMm: number };
  /** Magnet anchor (default 'edge'), injected from the layout so lid holes mate
   * with the bin base. See `MagnetAnchor` in `@/core/types`. */
  readonly magnetAnchor?: MagnetAnchor;
  readonly cellsX: number;
  readonly cellsY: number;
  /**
   * Which side the half-unit cell sits on for fractional bins. Mirrors the
   * bin's base-socket placement so the lid's magnet holes line up with the
   * feet of the bin stacked on top. See {@link BinParams.fractionalEdgeX}.
   */
  readonly fractionalEdgeX: 'start' | 'end';
  readonly fractionalEdgeY: 'start' | 'end';
  readonly gridUnitMm: number;
  /** Y-axis grid pitch (mm). Equals gridUnitMm for a square grid. */
  readonly gridUnitMmY: number;
  readonly heightUnitMm: number;
  /**
   * Per-side rail engagement overrides driven by feature conflicts.
   * Aggregated from `computeDisabledRails(params)` so the lid builder
   * shares one source of truth with the LidSection panel. Any side in
   * this set is skipped during click-rail placement regardless of the
   * user's persisted `clickRails[side]` flag.
   *
   * Replaces the older `omitFrontBackRails` boolean — the granular
   * `Set<side>` lets label tabs disable only the BACK rail (instead of
   * symmetrically skipping front+back), and lets wall cutouts/handles
   * skip only the affected sides.
   */
  readonly disabledRails: ReadonlySet<LidCompatibilitySide>;
  /**
   * Per-side click-rail engagement. When all four are `false` the lid
   * is friction-fit (no positive snap). Combined with `disabledRails`
   * to produce the effective per-side rail set during placement — a
   * side gets a rail only when its `clickRails[side]` flag is true AND
   * it's not in `disabledRails`.
   */
  readonly clickRails: {
    readonly front: boolean;
    readonly back: boolean;
    readonly left: boolean;
    readonly right: boolean;
  };
  /**
   * Click-rail coverage as a fraction (0..1) of each wall's edge length.
   * Rails are always centered; a value of 1 keeps the historical
   * edge-to-edge behavior, lower values shrink the rail toward the
   * midpoint to save filament. Ignored when `clickRails === false`.
   */
  readonly clickRailCoverage: number;
  /**
   * Label tabs on the bin's outer walls that reach into the click rails' Z
   * band, in the bin-interior frame. Rails clip their usable span against
   * these so a shelf and a rail can't occupy the same millimetre —
   * they are separate solids, so nothing about either mesh reveals the clash.
   *
   * Empty when the bin has no tabs, when they sit clear of the rail band (a
   * shelf tucked under the rim), or on a polygon bin, whose tabs the builder
   * gates off anyway.
   */
  readonly labelFootprints: readonly LabelTabFootprint[];
  /**
   * Stretches of wall a rail cannot occupy, from every cause but label tabs
   * (which arrive as footprints above, because their cross-axis span decides
   * which walls they take).
   *
   * Two unrelated reasons, applied identically. A compartment divider
   * is built to the interior ceiling and a seated rail hangs 3.05mm below the
   * wall top, so a run straight through one is 3.1mm of solid-on-solid overlap
   * and the lid cannot close. A wall cutout or a high handle hole is
   * the opposite — it has taken the lip away, so a rail there grips nothing.
   *
   * Empty on a plain bin: no compartment grid, no cutouts, no handles reaching
   * the lip, or a polygon mask, which none of the three plans describe.
   */
  readonly wallBlocks: readonly WallSpanBlock[];
  /**
   * Lip gaps on a CUSTOM-SHAPE footprint, carried separately from
   * `wallBlocks` because a polygon block is matched to one EDGE, not to a side:
   * a U faces front with two walls, and a cutout sits on exactly one of them.
   * Empty for a rectangular bin, which has one edge per side and uses
   * `wallBlocks` instead.
   */
  readonly polygonGaps: readonly PolygonLipGap[];
  /**
   * Grip relief, already gated: `mode` is forced to `'none'` when the
   * feature is off or its depth clamp left nothing useful, so builders can
   * test `mode` alone. `coverage` stays a 0-100 percentage here (unlike
   * `clickRailCoverage`) because `resolveLidGripSpanMm` owns the conversion
   * and the clamp together.
   */
  readonly grip: {
    readonly mode: LidGripMode;
    readonly sides: LidGripSides;
    readonly coverage: number;
  };
  /** Resolved inward cut depth (mm) for the relief; 0 when there is none. */
  readonly gripDepthMm: number;
  /**
   * Resolved height (mm) the relief reaches above the seam; 0 when there is
   * none. Carries the user's `heightMm` request, the skirt clamp, and (for a
   * chamfer) the tie to `gripDepthMm`, so the cutter reads one number.
   */
  readonly gripHeightMm: number;
  /**
   * Whether the click rails give way behind the relief.
   *
   * Tracks `binDip`: relief and rail occupy disjoint Z bands, so interrupting
   * the rail buys an easier opening at the cost of snap strength, and only a
   * user who also dipped the bin's lip has asked for that trade.
   */
  readonly gripSoftensSnap: boolean;
  /** Z of the bin's lip top in lid-local coords when snapped (the "anchor" line). */
  readonly anchorZ: number;
  /** Z of the bottom of the mating wall (where the wall ends and rails begin). */
  readonly wallBottomZ: number;
  /** Custom-shape mask if the bin has one. Undefined = rectangular. */
  readonly cellMask: CellMask | undefined;
  /**
   * Lid-top text, or null when absent/gated off. Rendered on the plain top
   * face, the tray floor when the tray recess is active, or the recessed floor
   * inside the lip on a lip-only stack top. Gates mirror the LidSection UI: a
   * FULL stack grid owns the surface, and polygon lids are excluded (auto-fit
   * assumes a rectangular face — same rectangularity restriction as
   * `retentionMagnets`).
   */
  readonly text: LidTextInputs | null;
  /**
   * Through-cuts in the lid's plate, or null when there are none or a gate
   * refuses them. Carries the shapes together with the window they are measured
   * in, so the builder never re-derives either.
   */
  readonly cutouts: LidCutoutInputs | null;
  /**
   * Resolved sliding-lid geometry, or null for every other attachment.
   *
   * Present means the lid IS a plate: `buildLid` takes the slide branch, and
   * every field above that describes a cap — `stackableTop`, `magnetHoles`,
   * `retentionMagnets`, `tray.enabled`, `grip.mode`, `cavityExtraMm` — has
   * already been forced to its inert value here. The stored config survives
   * untouched, exactly as `clickRails` survives a magnetic lid, so switching
   * attachment back restores what the user had.
   *
   * Null with `attachment === 'slide'` means the plan refused the design; the
   * panel reports the rejection and no lid is built.
   */
  readonly slide: SlideLidGeometry | null;
  /**
   * Outer-perimeter shift (mm) caused by asymmetric overhang. The lid's
   * perimeter, mating shell, floor, click rails, and retention magnets
   * translate by this amount so they wrap the bin's overhang-shifted outer
   * body, while the stack grid and its magnet holes stay on the nominal socket
   * grid (origin) to keep mating with the bin's base sockets. Zero for
   * symmetric/absent overhang and for polygon bins (which suppress overhang,
   * mirroring the box builder).
   *
   * The split is about what each feature mates with: retention magnets hug this
   * lid's own lip, so they follow it; stack sockets mate with a
   * different bin's base, so they must not.
   */
  readonly outerOffsetX: number;
  readonly outerOffsetY: number;
  /**
   * Overhang footprint growth (mm), already folded into `lidOuterW`/`lidOuterD`.
   * Exposed separately because the retention magnets inset from the EXPANDED
   * footprint corner rather than the nominal one — they hug the
   * stacking lip, and overhang moves it.
   */
  readonly overhangAddW: number;
  readonly overhangAddD: number;
}

/**
 * Through-cuts in the plate, or null when the design has none or a gate refuses
 * them.
 *
 * `lidCutoutWindow` applies the same TOP-FACE gates that null out
 * {@link LidInputs.text}, so the two cannot disagree about whether the lid has a
 * usable face; it adds a stacking-lip requirement of its own. Mesh-shaped entries
 * are refused here as well as dropped in migration: an imprint is subtracted
 * after tessellation, in the BIN's mesh frame, so no lid solid can describe one.
 */
function resolveLidCutoutInputs(params: BinParams): LidCutoutInputs | null {
  const shapes = (params.lid.cutouts ?? []).filter((c) => c.shape !== 'mesh');
  if (shapes.length === 0) return null;

  const window = lidCutoutWindow(params);
  if (!window) return null;

  // `resolveLidPlateThickness` floors a plain plate at LID_TOP_THICKNESS_BASE and
  // leaves a tray at least LID_TRAY_FLOOR under its recess, so this cannot trip
  // today. Kept because it guards a subtraction, and a future resolver change
  // that inverted it would otherwise build an inside-out cutter.

  const host = lidCutoutHostFace(params);
  if (host.thickness <= 0) return null;

  return {
    shapes,
    window,
    topZ: host.topZ,
    thickness: host.thickness,
    textDefaults: params.textDefaults,
  };
}

export function resolveLidInputs(params: BinParams): LidInputs {
  const { gridUnitMm, heightUnitMm } = params;
  // Y axis uses gridUnitMmY when set (non-square grid); equals X for square.
  const gridUnitMmY = params.gridUnitMmY ?? gridUnitMm;
  // Footprint clearance: the locked-down base, plus the magnetic relief when
  // the design gets retention magnets. XY only — `anchorZ`/
  // `wallBottomZ` below stay on the base value so the magnet seat gap holds.
  const fitClearance = resolveLidFootprintClearance(params);

  // Polygon path activates when the mask is partially filled. A fully-filled
  // mask is treated as rectangular (matches the bin generator's convention).
  const cellMask = isPartialMask(params.cellMask) ? params.cellMask : undefined;

  // Retention mode. Magnetic retention needs the rectangular corner
  // geometry, so polygon bins fall back to friction (the mating shell still
  // wraps the lip). Click rails are only engaged in clickRails mode — other
  // modes force the persisted per-side flags off so switching modes keeps the
  // user's rail selection without generating it.
  const attachment = params.lid.attachment;
  // Resolved once, and it is what every gate below branches on. A sliding lid
  // is the one attachment that replaces the lid rather than its retention, so
  // the fields describing a cap are forced inert here — the same treatment
  // `clickRails` gets outside click mode, and for the same reason: the stored
  // config survives so switching back restores it.
  const slide = isSlideLid(params.lid) ? slideLidPlanForParams(params).geometry : null;
  const isSlide = isSlideLid(params.lid);
  // Mirror the bin-side `usesMagneticLid` predicate exactly (magnetic + lip +
  // rectangular). Without the `stackingLip` guard the lid would grow bosses in
  // a state where the bin skips its matching posts, so the pair couldn't mate.
  const hingePlan = planHingeLid(params).geometry;
  const hingeDetentSide =
    hingePlan !== null && hingePlan.catchMode === 'detent' ? hingePlan.catchSide : null;
  const hingeMagnetCatch = hingePlan !== null && hingePlan.catchMode === 'magnets';
  const retentionMagnetSide = hingeMagnetCatch && hingePlan ? hingePlan.catchSide : null;
  // Magnetic attachment OR a hinged lid's magnet catch. Both put the same
  // bosses on the lid; only how many and on which wall differs, and
  // `retentionMagnetPlacementsFor` owns that.
  const retentionMagnets =
    (attachment === 'magnetic' || hingeMagnetCatch) && params.base.stackingLip && !cellMask;
  // The wall a hinged lid's detent catches on, or null when this lid has no
  // detent. Resolved from the PLAN so the catch lands opposite whichever wall
  // the hinge actually resolved to, rather than opposite the wall the config
  // asked for — a hinge the plan refused has no opposite.

  // Tray recess only exists when the lid isn't stackable (a stack grid owns
  // the top surface otherwise).
  const trayEnabled = params.lid.tray.enabled && !params.lid.stackableTop && !isSlide;

  // Lid-top text. Shared surface style = design textDefaults
  // merged with the surface-text override; polygon lids are excluded
  // (rectangular auto-fit), mirroring the UI.
  //
  // A full stack grid leaves no flat surface to write on; the lip-only variant
  // does — its recessed floor is one clear face.
  const stackGridOwnsTop = params.lid.stackableTop && !params.lid.stackLipOnly && !isSlide;
  const lidTextValue = params.surfaceText?.lidText?.trim() ?? '';
  let text: LidTextInputs | null = null;
  if (lidTextValue !== '' && !stackGridOwnsTop && !cellMask) {
    // Three layers: the design defaults, the style shared by every surface,
    // then the lid's own refinement.
    text = {
      value: lidTextValue,
      style: resolveTextStyle(
        params.textDefaults,
        params.surfaceText?.style,
        params.surfaceText?.lidStyle
      ),
    };
  }

  const cutouts = resolveLidCutoutInputs(params);

  // Floor plate takes the largest of: the user's knob, a stack-magnet pocket's
  // depth+ceiling, and a tray recess's depth+floor.
  const topThickness = resolveLidPlateThickness(params);
  // Every millimetre of plate past the 0.8mm baseline is a millimetre stolen
  // from the cavity the lip enters, so it deepens the anchor in lockstep.
  const cavityExtra = resolveLidCavityExtraMm(params);
  const gripActive = hasLidGrip(params);

  // Overhang grows the bin's outer body + stacking lip outward (and shifts it
  // when the two opposite sides differ). The lid wraps that expanded body, so
  // its outer footprint must grow in lockstep — otherwise the lid is sized to
  // the nominal footprint and won't seat over the overhang. Polygon bins
  // suppress overhang (matching boxBuilder), so the lid does too.
  const overhang = resolveOverhang(params.overhang);
  const expansion = !cellMask && hasOverhang(overhang) ? overhangExpansion(overhang) : null;
  const addW = expansion?.addW ?? 0;
  const addD = expansion?.addD ?? 0;
  const outerOffsetX = expansion?.offsetX ?? 0;
  const outerOffsetY = expansion?.offsetY ?? 0;

  // Lid outer footprint: `bin*42 - 2*Clearance` per side, plus the overhang
  // expansion. The lid uses its OWN corner radius (`LID_CORNER_RADIUS = 4mm`),
  // NOT the bin's `BOX_CORNER_RADIUS` (3.75mm) — using the bin value shifts
  // rails, shrinks walls, and breaks lip fit.
  const lidOuterW = params.width * gridUnitMm - 2 * fitClearance + addW;
  const lidOuterD = params.depth * gridUnitMmY - 2 * fitClearance + addD;
  // lidCornerR and cavityInset are the same expression: both are the lid's
  // effective corner radius after clearance. `cavityInset` names the semantic
  // role (inner-face distance from outer perimeter); `lidCornerR` is used by
  // geometry helpers. Cavity wall thickness in the lip-mating zone =
  // cavityInset - LIP_BIG_TAPER = 1.85mm.
  const lidCornerR = LID_CORNER_RADIUS - fitClearance;
  const cavityInset = lidCornerR;

  // The seam plane, and the two relief numbers measured against it. Resolved
  // here rather than inline below because the height reads the depth: a
  // chamfer's 45° section is sized by whichever of the two is scarcer.
  const anchorZ = lidAnchorZ(heightUnitMm, LID_FIT_CLEARANCE, cavityExtra);
  const gripDepthMm = gripActive ? resolveLidGripDepth(params).depthMm : 0;

  return {
    lidOuterW,
    lidOuterD,
    lidCornerR,
    fitClearance,
    topThickness,
    cavityExtraMm: cavityExtra,
    cavityInset,
    stackableTop: params.lid.stackableTop && !isSlide,
    // Gate here so buildStackGrid can trust the flag without re-checking.
    stackLipOnly: params.lid.stackLipOnly && params.lid.stackableTop && !isSlide,
    // Splitting the stack grid off only means anything when there IS a stack
    // grid — gate on stackableTop so buildLid/buildStackPlate can trust the
    // flag directly without re-checking stackableTop.
    separateStackPlate: params.lid.separateStackPlate && params.lid.stackableTop && !isSlide,
    // Magnets only have a stack-grid neighbour to mate with when
    // `stackableTop` is on. Off ⇒ skip the pockets even if the user
    // last toggled magnets on.
    magnetHoles: params.lid.magnetHoles && params.lid.stackableTop && !isSlide,
    magnetDiameter: params.base.magnetDiameter,
    magnetDepth: params.base.magnetDepth,
    magnetAnchor: params.magnetAnchor,
    attachment,
    retentionMagnets,
    retentionMagnetSide,
    retentionMagnetDiameter: params.lid.retentionMagnet.diameter,
    retentionMagnetDepth: params.lid.retentionMagnet.depth,
    retentionMagnetEdgeMagnets: params.lid.retentionMagnet.edgeMagnets,
    tray: {
      enabled: trayEnabled,
      depthMm: params.lid.tray.depthMm,
      wallMm: params.lid.tray.wallMm,
    },
    cellsX: params.width,
    cellsY: params.depth,
    fractionalEdgeX: params.fractionalEdgeX,
    fractionalEdgeY: params.fractionalEdgeY,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    // Whole walls a conflict denies outright — only a finger scoop filling the
    // lip pocket, plus the two blockers that stop generation anyway. Label
    // tabs, dividers, cutouts and handles are all deliberately absent (see
    // `SIDES_ARE_ADVISORY`): each costs a rail its own span, not its wall, and
    // arrives below. Centralised in `lidCompatibility.computeDisabledRails` so
    // the UI rail-summary and the worker placement code stay in sync.
    disabledRails: computeDisabledRails(checkLidCompatibility(params)),
    labelFootprints: railFoulingLabelFootprints(params),
    wallBlocks: [...dividerRailBlocks(params), ...lipGapRailBlocks(lipGaps(params))],
    polygonGaps: polygonLipGaps(params),
    // Rails only engage in clickRails mode; friction/magnetic force them off so
    // the builder's rail pass is a no-op while the user's per-side choice is
    // preserved on the persisted config.
    //
    // A hinged lid's DETENT is the exception, and it is not a new mechanism: a
    // catch on the wall opposite the axis is exactly a click rail on one wall.
    // Routing it through the rail pass rather than building a bespoke bump
    // inherits everything that pass already gets right — clipping around label
    // tabs, segmenting around cutouts and handles, splitting around a grip
    // relief — none of which a second implementation would have on day one.
    clickRails:
      attachment === 'clickRails'
        ? params.lid.clickRails
        : hingeDetentSide
          ? { front: false, back: false, left: false, right: false, [hingeDetentSide]: true }
          : { front: false, back: false, left: false, right: false },
    // Coverage stored as 0–100 percentage on LidConfig; converted to
    // a 0–1 fraction here for direct multiplication against rail lengths.
    //
    // A detent takes its own, shorter coverage: the user never sees the rail
    // controls on a hinged lid, and a full-length rail opposite a hinge is a
    // lid that has to be prised rather than flipped. Centred, so it pulls the
    // middle of the free edge down where an unsupported span would lift first.
    clickRailCoverage: hingeDetentSide
      ? LID_HINGE_DETENT_COVERAGE
      : params.lid.clickRailCoverage / 100,
    // Gate once, here: `hasLidGrip` folds in the mode, the per-side toggles and
    // the depth clamp, so no builder has to re-derive whether a relief exists.
    grip: {
      mode: gripActive ? params.lid.grip.mode : 'none',
      sides: params.lid.grip.sides,
      coverage: params.lid.grip.coverage,
    },
    gripDepthMm,
    gripHeightMm: gripActive
      ? resolveLidGripHeightPlan(params.lid.grip, anchorZ, gripDepthMm).heightMm
      : 0,
    gripSoftensSnap: hasBinLipDip(params),
    // `extraHeightMm` deepens the cavity above the lip so tall
    // contents poking out of a short bin are enclosed; 0 = standard lid.
    // Base clearance, NOT `fitClearance` — the magnetic relief is XY-only, and
    // feeding it here would lift the seated plane ~0.42mm into the corner
    // magnets' seat gap. `cavityExtra` (not just `extraHeightMm`) keeps the
    // plate from eating the lip's space; every non-worker `lidAnchorZ` caller
    // resolves the same pair so preview/thumbnail/export can't drift.
    anchorZ,
    wallBottomZ: lidWallBottomZ(heightUnitMm, LID_FIT_CLEARANCE, cavityExtra),
    cellMask,
    text,
    cutouts,
    slide,
    outerOffsetX,
    overhangAddW: addW,
    overhangAddD: addD,
    outerOffsetY,
  };
}
