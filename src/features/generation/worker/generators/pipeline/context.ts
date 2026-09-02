/**
 * Pipeline context factory.
 *
 * Derives BinDimensions from BinParams and creates the initial
 * PipelineContext that flows through all pipeline stages.
 */

import type { BinParams } from '@/shared/types/bin';
import {
  hasDetachableFeet,
  binFloorMm,
  hasDividerLean,
  isUndersideRelief,
  resolveTileFloorThickness,
} from '@/shared/types/bin';
import { hashMask, isPartialMask } from '@/shared/utils/cellMask';
import { dividerGrooveDepth } from '@/shared/utils/slotMath';
import { isFractional } from '@/core/constants';
import { resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import {
  HEIGHT_UNIT,
  CLEARANCE,
  SOCKET_HEIGHT,
  LIP_HEIGHT,
  LIP_OVERLAP,
  LIP_SMALL_TAPER,
  LIP_TAPER_WIDTH,
  MIN_BODY_WALL_MM,
} from '../generatorConstants';
import {
  buildCompartmentsCacheKey,
  compartmentCavitiesAreViable,
  compartmentCavitiesAreViableWithOverrides,
  compartmentCornersRoundCleanly,
  compartmentEdgesAreSinglePair,
  compartmentsAreRectangular,
  hasDividerOverrides,
  hasMultipleCompartments,
} from '../compartmentBuilder';
import { planSpanningDividerClips, spanningDividerClipsKey } from '../labelTabBuilder';
// HEIGHT_UNIT is kept as a fallback default for backwards compatibility with
// callers (or serialized designs) that predate heightUnitMm. The grid-unit
// fallback now lives in `pitchFromParams` (gridPitch.ts).
import type { ProgressFn } from '../meshUtils';
import { buildCacheKey, quantize, compactKey } from '../cacheKeyUtils';
import { resolveSocketCellPlan, socketCellPlanKey } from '../socketBuilder';
import type { BinDimensions, PipelineContext } from './types';
import type { PerfCollector } from './perfCollector';
import { resolveOverhang, overhangKey, hasOverhang, overhangExpansion } from '../overhang';
import { pitchFromParams, pitchKeySegments } from '../gridPitch';
import { resolveTrayBottomInputs, trayBottomSkirtDepth } from '../trayBottomInputs';

/**
 * Depth of whatever sits under the body: a Gridfinity socket, a tray bin's lid
 * skirt, or nothing at all under a flat base.
 */
function resolveBaseOffsetZ(params: BinParams): number {
  if (params.base.style === 'lid') return trayBottomSkirtDepth(resolveTrayBottomInputs(params));
  if (params.base.style === 'flat') return 0;
  return SOCKET_HEIGHT;
}

/** Derive all dimensions from bin parameters. */
export function deriveDimensions(
  params: BinParams,
  _forExport: boolean,
  omitLipSolid = false
): BinDimensions {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fallback for legacy BinParams without heightUnitMm
  const heightUnit = params.heightUnitMm ?? HEIGHT_UNIT;
  const totalHeight = params.height * heightUnit;
  const isFlat = params.base.style === 'flat';
  // Tray bin: lid mating geometry underneath, so like a flat base there
  // is no socket to shell, drill or halve. Still distinct from `isFlat`, which
  // ends in a plain face where this grows a skirt in `trayBottomStage`.
  const isTrayBottom = params.base.style === 'lid';
  const socketless = isFlat || isTrayBottom;
  // Detachable feet: the feet print as separate parts, so the BODY has no
  // socket under it — but this is not `socketless`, which also suppresses
  // attachment hardware. The magnets move into the feet rather than vanishing,
  // and the body is otherwise bit-identical to an integral bin's, so only
  // `baseOffsetZ` and the socket build change. `hasDetachableFeet` already
  // refuses a spacer and a socketless base — but it answers "the user asked",
  // not "feet exist": the plan places NOTHING when an axis has no
  // pocket-aligned whole cell (a half-lattice 1xN, say). Both geometry
  // consumers guard on the placements; without the same guard here the socket
  // is skipped too, and the export is a flat-bottomed box with no feet part.
  const detachableFeet =
    hasDetachableFeet(params.base) && resolveDetachableFeet(params).placements.length > 0;
  const floorThickness = binFloorMm(params.wallThickness);
  // User flag only. When the mask has mixed half-bin detail, the socket
  // builder does a per-cell dispatch using the mask — it splits only
  // those 1u cells that straddle a half-bin boundary into quarter
  // sockets, leaving uniform 1u cells as one full socket. This avoids
  // decomposing every cell unnecessarily.
  const halfSockets = params.base.halfSockets && !socketless;
  // The foot layout, resolved once here so the shell, the floor pattern and the
  // cache key cannot disagree about the feet.
  const socketCellPlan = resolveSocketCellPlan(
    halfSockets,
    params.base.footLatticeX,
    params.base.footLatticeY,
    params.cellMask,
    params.width,
    params.depth
  );
  // Base-only bin: the spacer's complement. Needs feet to stand on, so like
  // the spacer it is inert on a socketless base and the constraint engine keeps
  // the two from being on together.
  const isTile = params.base.tile === true && !socketless;
  // A base-only bin always takes the solid path: its interior height is 0, so
  // the cavity cut a 'standard' style would apply is a zero-height (degenerate)
  // tool. Derived here rather than via `base.solid` because IMPLICATION_RULES
  // force that flag false for any style other than 'solid', and base-only keeps
  // style 'standard' so the user can switch back out of the mode.
  const solid = params.base.solid || isTile;
  // Spacer: a floorless riser that lifts a bin so mismatched heights line
  // up. Feet and stacking lip are unchanged — only the floor is gone, so every
  // height/stacking rule the bin already follows carries over. Needs a socket to
  // shell through, so it's inert on a flat base; the constraint engine also keeps
  // the two from being on together.
  const isSpacer = params.base.spacer && !socketless;
  // Lightweight shells the socket region; a flat bin has no socket, so the
  // flag is inert there. migrateParams backfills the field on legacy designs.
  // A spacer always shells (its feet ARE the structure once the floor is gone),
  // so it takes the same build path whether or not the user asked for lite.
  // Inert with detachable feet for the same reason it is inert on a socketless
  // base: there is no in-place foot to shell. Superseded rather than
  // contradictory, so the setting is left alone rather than cleared.
  const lightweight = (params.base.lightweight || isSpacer) && !socketless && !detachableFeet;
  // Which side the shells open from. `isUndersideRelief` already refuses a
  // spacer and a socketless base, so a crafted `{ spacer: true, lightweightMode:
  // 'underside' }` cannot close the hole that makes a spacer a spacer.
  const undersideRelief = isUndersideRelief(params.base);
  // Whether the interior floor is actually gone — NOT the same question as
  // "is the base shelled". The underside relief keeps the floor, and a solid
  // bin never had a distinct floor to open (its cups already open downward,
  // under a body that is solid all the way through). A spacer is the one case
  // that opens the floor without the user asking for lite.
  const liteFloorOpen = lightweight && !undersideRelief && !solid;
  // Base-only collapses the wall to ZERO rather than shortening it: the body is the
  // floor slab and nothing above it. `params.height` is inert here — it is
  // pinned to 1 only to satisfy the range validators (see `BaseConfig.tile`), so
  // reading it would silently build a 7mm-tall wall instead.
  // A socketed body subtracts the socket it stands on, which a short height unit
  // can drive to zero or below — only a spacer can ask for it, since every other
  // socketed base is held at MIN_HEIGHT (2u). Neither degenerate case fails
  // loudly on its own: at exactly 0 the box extrude is a zero vector and OCCT
  // throws EXTRUDE_ZERO_VECTOR, and below 0 OCCT extrudes DOWNWARD instead,
  // burying an inverted box and the stacking lip inside the foot and shipping
  // that as a bin. `minHeightUnits` keeps the UI and the server mirror above the
  // floor; this is the guard a crafted share payload cannot bypass, and it
  // degrades to the shortest real wall rather than losing the bin.
  const socketedWall = Math.max(totalHeight - SOCKET_HEIGHT, MIN_BODY_WALL_MM);
  const wallHeight = isTile ? 0 : socketless ? totalHeight : socketedWall;
  // The base-only body. Shared with `assembledHeight` so the readout and the mesh
  // cannot disagree about how tall the plate is.
  const tileFloorHeight = isTile ? resolveTileFloorThickness(params.wallThickness) : 0;
  // Exterior-wall collar: raises the outer box + lip above the
  // nominal wall height without touching the interior. Kept separate from
  // `wallHeight` so every feature stage anchors to the original top plane.
  // Floored at >= 0 and guarded against non-finite values here so a stray NaN
  // can't poison `boxWallHeight` into degenerate geometry; the full range clamp
  // (<= MAX_EXTRA_WALL_HEIGHT) lives in `migrateParams`.
  const rawCollar = params.extraWallHeightMm ?? 0;
  const finiteCollar = Number.isFinite(rawCollar) ? Math.max(0, rawCollar) : 0;
  // A collar raises the outer WALLS (and the lip with them) above the nominal
  // height. A base-only bin has no walls to raise, and `assembledHeight` ignores
  // the field there, so honouring it here would build a box the readout never
  // reports: `boxWallHeight` is `wallHeight + collarHeight`, so a stale collar
  // on a design switched into base-only mode would take the zero-wall branch away
  // and silently produce a walled bin.
  const collarHeight = isTile ? 0 : finiteCollar;

  // Per-axis grid pitch. gridUnitMmX scales width/columns, gridUnitMmY scales
  // depth/rows. They're equal for a standard square grid (gridUnitMmY omitted),
  // so the multiplications below reduce to the original `* gridUnit` form.
  // `pitchFromParams` applies the same `?? SIZE` legacy fallback as before.
  const { x: gridUnitX, y: gridUnitY } = pitchFromParams(params);
  const outerW = params.width * gridUnitX - CLEARANCE;
  const outerD = params.depth * gridUnitY - CLEARANCE;

  // Resolve overhang before innerW/innerD so interior features (compartments,
  // scoops, label tabs, etc.) see the actual available space. The box shell
  // expands in lockstep with the overhang, so innerW/innerD must include the
  // per-side addW/addD expansion.
  // Overhang is suppressed for polygon masks (the mask defines its own footprint).
  const { cellMask } = params;
  const overhang = resolveOverhang(isPartialMask(cellMask) ? undefined : params.overhang);
  const ovhExp = hasOverhang(overhang) ? overhangExpansion(overhang) : null;

  const innerW = outerW + (ovhExp?.addW ?? 0) - 2 * params.wallThickness;
  const innerD = outerD + (ovhExp?.addD ?? 0) - 2 * params.wallThickness;
  const innerOffsetX = ovhExp?.offsetX ?? 0;
  const innerOffsetY = ovhExp?.offsetY ?? 0;
  const isSlotted = params.style === 'slotted';
  const grooveDepth = liteFloorOpen ? 0 : dividerGrooveDepth(params);

  // A spacer has no floor for a magnet/screw boss to stand on — a pad inside a
  // through-hole would be a free-standing pillar — so attachment hardware is
  // suppressed here as well as ruled out by the constraint engine, keeping a
  // crafted share payload from producing a disconnected solid. Same shape of
  // guard as `socketless`, which has no socket to drill at all.
  const noAttachment = socketless || isSpacer;
  const withMagnet =
    !noAttachment && (params.base.style === 'magnet' || params.base.style === 'magnet_and_screw');
  const withScrew =
    !noAttachment && (params.base.style === 'screw' || params.base.style === 'magnet_and_screw');

  // Nothing under the body once the feet come off. The printed part is
  // SOCKET_HEIGHT shorter than the assembly, which is why `assembledHeight`
  // stays right without knowing about this mode: it counts
  // `height * heightUnitMm`, and the feet put that 5mm back.
  const baseOffsetZ = detachableFeet ? 0 : resolveBaseOffsetZ(params);

  const maxDimension = Math.max(params.width * gridUnitX, params.depth * gridUnitY);

  const hasLip = params.base.stackingLip;
  // A bin with no lip has no lip solid to omit. Normalized here rather than
  // trusted from the caller so the returned dimensions can never say
  // `hasLip: false, omitLipSolid: true`, and so a lipless bin cannot be given
  // two shell-cache keys for one shape.
  const omitsLipSolid = omitLipSolid && hasLip;
  // Material actually under the lip. A base-only bin's lip bears on its floor
  // slab, not on a wall; every other base carries it on the collar-extended wall
  // the box is extruded to. See `lipHasSupport` for what the number decides.
  const wallUnderLipMm = isTile ? tileFloorHeight : wallHeight + collarHeight;
  const lipHasSupport = hasLip && wallUnderLipMm >= LIP_TAPER_WIDTH + LIP_OVERLAP;
  // Safety: LIP_OVERLAP (0.1mm) < LIP_SMALL_TAPER (0.7mm) so interiorHeight
  // already clears the actual lip base at wallHeight - LIP_OVERLAP.
  // Floored at 0 for base-only, whose wallHeight is 0: the subtraction would
  // otherwise hand every downstream stage a -0.7mm interior, and a negative
  // extrude is a degenerate solid rather than an empty one.
  const interiorHeight = Math.max(0, hasLip ? wallHeight - LIP_SMALL_TAPER : wallHeight);

  // The rim, derived once. `shellStage` extrudes the outer box to `wallHeight +
  // collarHeight` (or a base-only bin's slab to `tileFloorHeight`) and fuses
  // the lip `LIP_OVERLAP` below its top; `translateStage` then lifts the whole
  // body by `baseOffsetZ`. Every consumer that anchors to the rim reads these
  // rather than restating that chain — the restatements landed a lid's magnet
  // posts 0.7mm proud on a socketed bin and 4.3mm short on a flat one.
  const wallTopZ = baseOffsetZ + wallHeight + tileFloorHeight + collarHeight;
  const lipTopZ = wallTopZ + (hasLip ? LIP_HEIGHT - LIP_OVERLAP : 0);

  // Bake compartment walls into the shell as a single multi-cavity cut when
  // the shape is amenable to that path: rectangular footprint (no polygon
  // mask), not solid mode, not slotted, the compartments are rectangles
  // (their cells fill their bounding box), and every per-compartment cavity
  // has viable post-inset dimensions. This avoids the fuse T-junction at
  // the cavity floor that BambuStudio flagged as non-manifold.
  //
  // Polygon-mask bins (L/T/U footprints) do not take the additive-fuse path
  // either — they get NO dividers at all. `featuresStage` runs only builders
  // declaring `supportsCellMask` once the mask is partial, and
  // `compartmentWallsFeature` does not declare it, so a masked bin carrying a
  // populated `compartments` grid exports as an undivided shell. The mask
  // check below is therefore about which of two divider paths a RECTANGULAR
  // bin takes, not about masked bins having a fallback.
  // Locked in by `compartmentBuilder.scenario.polygonGap.test.ts`.
  const overridesAllowCutPath =
    !hasDividerOverrides(params) ||
    (compartmentEdgesAreSinglePair(params) &&
      compartmentCavitiesAreViableWithOverrides(params, innerW, innerD));
  // A partial divider height can't be expressed by the cut-based multi-cavity
  // shell (cut pockets reach the rim, so the leftover divider is always full
  // height). A numeric height below the full interior height therefore always
  // routes to the additive divider-wall path (short wall boxes from the floor).
  // A numeric value that clamps up to the full interior height is treated as
  // full so it keeps the faster cut-path. (Contrast tilt overrides, which only
  // fall back to the additive path for some layouts — see overridesAllowCutPath.)
  const { dividerHeight } = params.compartments;
  const dividerHeightIsFull =
    dividerHeight === undefined ||
    dividerHeight === 'auto' ||
    (typeof dividerHeight === 'number' && dividerHeight >= interiorHeight);
  const compartmentsBakedIntoShell =
    !isSlotted &&
    !solid &&
    !isPartialMask(params.cellMask) &&
    hasMultipleCompartments(params) &&
    compartmentsAreRectangular(params) &&
    compartmentCavitiesAreViable(params, innerW, innerD) &&
    compartmentCornersRoundCleanly(params, innerW, innerD) &&
    overridesAllowCutPath &&
    dividerHeightIsFull &&
    // A leaning divider is a plane, and a cut pocket is a Z-extrusion, so the
    // cut path cannot express one at all. Same fallback a partial height takes.
    !hasDividerLean(params.compartments) &&
    // A collar builds the shell taller than the interior; the multi-cavity cut
    // path would cut pockets to the raised rim, making dividers full-height to
    // the new top. Route to the additive path (short divider boxes from the
    // floor) so dividers stay at the nominal interior height.
    collarHeight === 0;

  // Shell cache key — versioned + quantized for deterministic matching.
  // Mask hash is included only when the mask triggers the polygon path so
  // rectangular bins continue to share the existing cache bucket. The
  // compartments segment is "none" unless the bin uses the multi-cavity
  // cut path, so single-compartment bins keep their existing cache bucket.
  const maskKeySegment = isPartialMask(cellMask) ? hashMask(cellMask) : 'rect';
  // A floor-open lite bin also depends on the compartment layout: the body
  // floor openings are clipped away from divider walls, so two of them
  // differing only in dividers must not share a cached body. The underside
  // relief cuts no floor openings and needs no clip, so it stays out — keying
  // it on the compartment grid would only fragment its cache.
  const compartmentsKey =
    compartmentsBakedIntoShell || liteFloorOpen ? buildCompartmentsCacheKey(params) : 'none';

  // Only the shell-baked path carries dividers in the shell; elsewhere the
  // clip lands on the additive walls and is keyed by that feature instead.
  const spanningClipKey = compartmentsBakedIntoShell
    ? spanningDividerClipsKey(
        planSpanningDividerClips(params, innerW, innerD, interiorHeight, params.wallThickness)
      )
    : '';

  const shellKey = compactKey(
    buildCacheKey(
      'v7',
      quantize(params.width),
      quantize(params.depth),
      quantize(gridUnitX),
      // Y pitch — appended only for a non-square grid (distinguishes a 2×2 @
      // 42×22 shell from a 2×2 @ 42×42 shell, which share width/depth/gridUnitX
      // but have different outerD). Omitted when square so existing v7 keys stay
      // byte-identical.
      ...pitchKeySegments({ x: gridUnitX, y: gridUnitY }, quantize),
      isFlat,
      halfSockets,
      // A non-default foot lattice builds different feet from otherwise
      // identical params. Appended rather than folded into `halfSockets` so a
      // older key stays byte-identical.
      ...(socketCellPlanKey(socketCellPlan) ? [socketCellPlanKey(socketCellPlan)] : []),
      withMagnet,
      withScrew,
      quantize(params.base.magnetDiameter),
      quantize(params.base.magnetDepth),
      quantize(params.base.screwDiameter),
      quantize(wallHeight),
      quantize(params.wallThickness),
      params.base.stackingLip,
      solid,
      lightweight,
      maskKeySegment,
      compartmentsKey,
      overhangKey(overhang),
      // Collar segment — appended only when present so collarless bins keep
      // byte-identical v7 keys (no cache churn), mirroring the non-square pitch
      // segment above.
      ...(collarHeight > 0 ? [`collar${quantize(collarHeight)}`] : []),
      // Spacer punches the floor through, so it must never share a cached body
      // with the lite bin it otherwise looks like. Appended for the same reason.
      ...(isSpacer ? ['spacer'] : []),
      // The relief direction is part of the BODY, not just the base: the
      // interior mode cuts each cup's mouth through the floor before the body is
      // cached, and the underside mode leaves that floor intact. Without this
      // segment an underside bin reuses an interior bin's body and ships with
      // the floor already punched. Appended only when set, so every interior and
      // non-lite bin keeps a byte-identical key.
      ...(undersideRelief ? ['underside'] : []),
      // A thicker floor is a different solid from the integral bin's.
      ...(floorThickness !== params.wallThickness ? [`floor${quantize(floorThickness)}`] : []),
      // A tray bin's shell is socketless, so it must not reuse a socketed bin's
      // cached body. `isFlat` above does not separate them: a custom
      // `heightUnitMm` makes a socketed 13mm x 2u and a tray-bottom 7mm x 3u agree on
      // every other segment, including `wallHeight`.
      ...(isTrayBottom ? ['tray'] : []),
      // `quantize(wallHeight)` above is 0 for base-only, but it is also 0 for a
      // socketed bin whose totalHeight happens to equal SOCKET_HEIGHT (a custom
      // 5mm heightUnitMm at 1u). Those are different solids, so separate them.
      ...(isTile ? ['tile'] : []),
      // The one thing `omitLipSolid` changes is this shell, so it must not
      // share a cache entry with the lipped shell it is otherwise identical to.
      // Appended only when set, so every ordinary bin keeps a byte-identical
      // key.
      ...(omitsLipSolid ? ['nolipsolid'] : []),
      // A solid bin's fill surface is part of its BODY (shellStage folds it into
      // `cutoutTopOffset`), so two bins differing only in the top offset are two
      // different shells. Without this the second one silently reuses the first
      // one's cached body and the recess never appears.
      ...(solid && params.cutoutConfig.topOffset > 0
        ? [`ctop${quantize(params.cutoutConfig.topOffset)}`]
        : []),
      // Shell-baked dividers get clipped where a spanning label shelf crosses
      // them, so that clip is part of the shell. Appended only when it
      // applies, keeping every other bin's v7 key byte-identical.
      ...(spanningClipKey ? [`spanclip${spanningClipKey}`] : []),
      // A fractional axis reverses the cell run for a 'start' edge, moving
      // every lite floor opening half a unit — and those openings are cut
      // into the cached body. The socket key has always carried this; the
      // shell key has to agree, or a second design on the other edge reuses
      // a body whose openings land on the webbing. Appended only when a
      // fractional axis exists, keeping whole-unit keys byte-identical.
      ...((isFractional(params.width) || isFractional(params.depth)) &&
      (params.fractionalEdgeX !== 'end' || params.fractionalEdgeY !== 'end')
        ? [`frac:${params.fractionalEdgeX}:${params.fractionalEdgeY}`]
        : [])
    )
  );

  return {
    outerW,
    outerD,
    innerW,
    innerD,
    gridUnitMmX: gridUnitX,
    gridUnitMmY: gridUnitY,
    wallHeight,
    totalHeight,
    collarHeight,
    wallTopZ,
    lipTopZ,
    isFlat,
    isTrayBottom,
    socketless,
    detachableFeet,
    floorThickness,
    baseOffsetZ,
    halfSockets,
    socketCellPlan,
    lightweight,
    undersideRelief,
    liteFloorOpen,
    dividerGrooveDepth: grooveDepth,
    isSpacer,
    isTile,
    tileFloorHeight,
    solid,
    isSlotted,
    hasLip,
    lipHasSupport,
    interiorHeight,
    maxDimension,
    shellKey,
    omitLipSolid: omitsLipSolid,
    withMagnet,
    withScrew,
    compartmentsBakedIntoShell,
    overhang,
    innerOffsetX,
    innerOffsetY,
  };
}

/** Create the initial pipeline context from bin parameters. */
export function createInitialContext(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal,
  perfCollector?: PerfCollector,
  omitLipSolid = false
): PipelineContext {
  return {
    params,
    dimensions: deriveDimensions(params, forExport, omitLipSolid),
    forExport,
    signal,
    onProgress,
    solid: null,
    deferredSolid: null,
    deferredSolidKey: null,
    originToTag: new Map<number, number>(),
    fuseTargets: [],
    cutTargets: [],
    patternCutTargets: [],
    deferredCutTargets: [],
    featuresKey: null,
    mesh: null,
    coarseMesh: null,
    perfCollector,
  };
}
