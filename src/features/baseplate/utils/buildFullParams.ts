/**
 * Converts stored baseplate params into fully resolved generation params.
 *
 * With direct per-side padding, the conversion is a straightforward pass-through.
 */

import type {
  CornerCutParams,
  DrawerOutline,
  MagnetAnchor,
  StoredBaseplateParams,
} from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isSeatedConnectorStyle } from '@/shared/types/bin';
import { clampCornerCuts, cornerCutVertices } from '@/shared/utils/cornerCutOutline';
import { translateOutline } from '@/shared/utils/drawerOutline';
import {
  CUT_GEOMETRY_MARGIN_MM,
  hasOutlineOverhang,
  resolveOutlineFrame,
} from '@/shared/utils/outlineFrame';
import { screwPadThicknessMm } from '@/shared/generation/screwHolePlan';
import { baseplateFloorDepthBeforeScrews } from '@/shared/printSettings/baseplateHeight';
import { normalizeSplitOverride } from './splitOverride';

/**
 * Largest corner radius the plain rounding path may cut: the arc can enter
 * the outer corner cell but never past its center, so pockets survive intact.
 * Radii beyond this are converted to an outline so the generator's cell
 * classification drops/clips the sockets the arc consumes.
 */
export function plainRoundingLimit(gridUnitMm: number, minPaddingMm: number): number {
  return gridUnitMm / 2 + minPaddingMm;
}

/** Geometric ceiling for any corner radius on a totalW × totalD plate. */
export function maxCornerRadiusMm(totalW: number, totalD: number): number {
  return Math.min(totalW, totalD) / 2 - CUT_GEOMETRY_MARGIN_MM;
}

/**
 * The inputs the outline resolution depends on, derived once.
 *
 * Both `buildFullParams` and {@link hasEffectivePerimeter} read these, so the
 * rules for which dimensions apply and whether the drawer shape is in play exist
 * in one place. Restating them per caller is what let the panel and the
 * regeneration trigger disagree about radius-cut plates once already.
 *
 * A custom drawer shape (and a large corner radius, which the resolver converts
 * to a radius-cut outline) applies under stacking too: the shaped tiles
 * split and dedupe by fingerprint like any others. An unsplit rounded/shaped
 * plate stacks whole; a split one stacks its identical (square interior) tiles
 * while unique perimeter tiles print singly.
 */
function outlineInputs(
  stored: StoredBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  gridUnitMmY: number,
  drawerOutline: DrawerOutline | undefined
): { stackingOn: boolean; outlineOn: boolean; widthMm: number; depthMm: number; synced: boolean } {
  const synced = stored.syncWithLayout !== false;
  const width = synced ? drawerWidth : (stored.baseplateWidth ?? drawerWidth);
  const depth = synced ? drawerDepth : (stored.baseplateDepth ?? drawerDepth);
  const stackingOn = stored.stackPrint?.enabled === true;
  return {
    synced,
    stackingOn,
    outlineOn: drawerOutline !== undefined && synced,
    widthMm: width * gridUnitMm,
    depthMm: depth * gridUnitMmY,
  };
}

/**
 * Whether the plate ends up with a non-rectangular perimeter at generation
 * time — a drawer shape, or a corner radius large enough that the resolver
 * converts it to a radius-cut outline.
 *
 * Runs the resolver rather than restating its rules, so the panel and the
 * regeneration trigger cannot drift from what generation actually produces.
 * They did drift once, keyed on the raw drawer outline while the resolver also
 * made outlines from large radii, which showed the whole-cell control on plates
 * the trigger considered rectangular.
 *
 * Stacking-independent: both a drawer shape and a large-radius
 * conversion now yield a perimeter whether or not stacking is on, so the panel,
 * trigger and STEP export all read the same answer without an override.
 */
export function hasEffectivePerimeter(
  stored: StoredBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  drawerOutline: DrawerOutline | undefined,
  gridUnitMmY: number = gridUnitMm
): boolean {
  const inputs = outlineInputs(
    stored,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    gridUnitMmY,
    drawerOutline
  );
  // Presence only: the frame re-base translates an outline but never adds
  // or removes one, so a synced drawer shape always yields a perimeter and
  // only the radius conversion needs resolving.
  if (inputs.outlineOn) return true;
  return (
    resolveRadiusOutline(stored, inputs.widthMm, inputs.depthMm, gridUnitMm).outline !== undefined
  );
}

/**
 * The resolved outline (plate-local mm, spanning the padded extent) plus the
 * paddings it permits (see `resolveOutlineFrame` for the padding rules).
 *
 * A drawer shape is re-based onto the socket lattice — plus the user's manual
 * grid shift — via the shared frame (`outlineFrame.ts`,): the shift
 * happens here, once, on the one derived outline the generator, the split
 * planner, and every piece all consume, and the layout side derives the same
 * translation from the same module, so the two frames are identical by
 * construction. Radius-converted outlines span the full padded extent (zero
 * registration by construction) and take no manual shift — a rectangle
 * drawer's grid is its own frame — so they skip the re-base and keep their
 * exact vertices, cache-stable.
 */
function resolveOutline(
  drawerOutline: DrawerOutline | undefined,
  outlineOn: boolean,
  stored: StoredBaseplateParams,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number,
  gridUnitMmY: number,
  fractionalEdgeX: 'start' | 'end',
  fractionalEdgeY: 'start' | 'end',
  gridShiftX: number,
  gridShiftY: number
): {
  outline: DrawerOutline | undefined;
  paddingOn: boolean;
  overhang?: ResolvedBaseplateParams['outlineOverhang'];
} {
  if (outlineOn && drawerOutline !== undefined) {
    const frame = resolveOutlineFrame(drawerOutline, {
      widthMm,
      depthMm,
      gridUnitMm,
      gridUnitMmY,
      paddingLeft: stored.paddingLeft,
      paddingRight: stored.paddingRight,
      paddingFront: stored.paddingFront,
      paddingBack: stored.paddingBack,
      fractionalEdgeX,
      fractionalEdgeY,
      gridShiftX,
      gridShiftY,
    });
    // Only carried when non-zero, so registered in-extent plates keep an
    // absent field and stay byte-identical through the cache key.
    const overhang = hasOutlineOverhang(frame.overhang) ? frame.overhang : undefined;
    if (frame.shiftX === 0 && frame.shiftY === 0) {
      return { outline: frame.outline, paddingOn: frame.paddingOn, overhang };
    }
    return {
      outline: translateOutline(frame.outline, frame.shiftX, frame.shiftY),
      paddingOn: frame.paddingOn,
      overhang,
    };
  }
  return resolveRadiusOutline(stored, widthMm, depthMm, gridUnitMm);
}

function resolveRadiusOutline(
  stored: StoredBaseplateParams,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number
): { outline: DrawerOutline | undefined; paddingOn: boolean } {
  // No active drawer shape: corner radii beyond the plain rounding limit become
  // a radius-cut outline, so the generator's cell classification handles the
  // sockets the arc consumes (the plain path must never orphan a pocket, which is
  // why it clamps at the limit). This runs under stacking too: the rounded
  // perimeter survives instead of being flattened, so an unsplit rounded plate
  // stacks whole and a split one stacks its square interior tiles (the four rounded
  // corner tiles are each unique and print singly, like any perimeter tile).
  const radii = stored.cornerRadii ?? {
    tl: stored.cornerRadius ?? 0,
    tr: stored.cornerRadius ?? 0,
    bl: stored.cornerRadius ?? 0,
    br: stored.cornerRadius ?? 0,
  };
  const maxRadius = Math.max(radii.tl, radii.tr, radii.bl, radii.br);
  const minPadding = Math.min(
    Math.min(stored.paddingLeft, stored.paddingRight),
    Math.min(stored.paddingFront, stored.paddingBack)
  );
  if (maxRadius <= plainRoundingLimit(gridUnitMm, minPadding)) {
    return { outline: undefined, paddingOn: true };
  }
  const totalW = widthMm + stored.paddingLeft + stored.paddingRight;
  const totalD = depthMm + stored.paddingFront + stored.paddingBack;
  const radiusCut = (r: number): CornerCutParams['tl'] =>
    r > 0 ? { kind: 'radius', r } : { kind: 'none' };
  const cuts = clampCornerCuts(
    {
      tl: radiusCut(radii.tl),
      tr: radiusCut(radii.tr),
      bl: radiusCut(radii.bl),
      br: radiusCut(radii.br),
    },
    totalW,
    totalD,
    CUT_GEOMETRY_MARGIN_MM
  );
  return {
    outline: { vertices: cornerCutVertices(totalW, totalD, cuts) },
    paddingOn: true,
  };
}

/**
 * Build full generation params from the stored per-layout config.
 *
 * @param drawerOutline - The drawer's non-rectangular boundary, if any.
 * Applied only when the baseplate syncs with the layout (a custom-size plate
 * has no defined relationship to the drawer shape). Under stacking the shape is
 * kept too: the shaped tiles split, dedupe by fingerprint, and stack —
 * identical tiles into towers, unique perimeter tiles printed singly. Padding
 * composes with every shape — corner-cut shapes re-inscribe their cuts on the
 * padded rectangle, all others offset their edges outward (`padOutline`) — so
 * the resolved outline is plate-local over the padded extent. Corner rounding
 * and detached margins are outline-unaware, so while a shape is active they are
 * functionally zeroed, stored values untouched (the stack-print stripping
 * precedent).
 */
export function buildFullParams(
  stored: StoredBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  fractionalEdgeX: 'start' | 'end',
  fractionalEdgeY: 'start' | 'end',
  nozzleSizeMm?: number,
  drawerOutline?: DrawerOutline,
  magnetAnchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR,
  // Depth-axis pitch for a non-square grid; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm,
  // Manual grid shift within the perimeter (drawer.gridShiftX/Y,) —
  // folded into the frame re-base; only meaningful with a synced drawer shape.
  gridShiftX: number = 0,
  gridShiftY: number = 0
): ResolvedBaseplateParams {
  const {
    synced,
    stackingOn,
    outlineOn,
    widthMm: outlineWidthMm,
    depthMm: outlineDepthMm,
  } = outlineInputs(stored, drawerWidth, drawerDepth, gridUnitMm, gridUnitMmY, drawerOutline);
  const width = synced ? drawerWidth : (stored.baseplateWidth ?? drawerWidth);
  const depth = synced ? drawerDepth : (stored.baseplateDepth ?? drawerDepth);

  // Stack printing flips every plate above the bottom upside down. Magnet
  // pockets become downward bridges when flipped (audited ~10% bridge area, vs
  // 0% for a magnet-free plate), so magnets are stripped. A custom perimeter is
  // NOT stripped, and neither is corner rounding, plain or converted to a
  // radius-cut outline: the tiles split and dedupe by fingerprint, so identical
  // ones stack into towers (an unsplit rounded plate stacks whole) while the
  // unique corner tiles print singly. A corner tile's lone rounded corner is
  // congruent about neither flip axis, so its flipped copies carry it on the
  // opposite side of the tower (a few mm of overhang at one seam); that beats
  // flattening a radius the user set, which is what stripping did.
  // Dovetail connectors survive: tongues, grooves, and the dovetail key are
  // full-height vertical prisms that flip cleanly. Only snap clip is
  // incompatible — its blind top pocket (sealed floor + undercut ledge) inverts
  // into a downward bridge/overhang — so it alone is stripped. Done here rather
  // than by mutating stored params, so the user's settings return intact when
  // stacking is turned off.
  const stripConnectors = stackingOn && stored.connectorStyle === 'snapClip';

  const effFractionalEdgeX = synced ? fractionalEdgeX : (stored.fractionalEdgeX ?? 'end');
  const effFractionalEdgeY = synced ? fractionalEdgeY : (stored.fractionalEdgeY ?? 'end');
  const { outline, paddingOn, overhang } = resolveOutline(
    drawerOutline,
    outlineOn,
    stored,
    outlineWidthMm,
    outlineDepthMm,
    gridUnitMm,
    gridUnitMmY,
    effFractionalEdgeX,
    effFractionalEdgeY,
    gridShiftX,
    gridShiftY
  );
  // An outline carries its own corner geometry as arcs and shares the same
  // post-cache intersect slot, so rounding is zeroed whenever one is active —
  // whether it came from the drawer shape or from the radius conversion above.
  const roundingOn = outline === undefined;
  // Detach is mutually exclusive with any active outline (rails have no outline
  // awareness — margins would need arc-clipped rail geometry). It COMPOSES with
  // stacking: rails never enter the flipped towers — they export as
  // separate flat pieces — and zeroing edge-piece padding makes more tiles share
  // a fingerprint, so plates dedupe into taller identical stacks. Padding stays
  // at its stored values here — `emitMargins` and the camera/dimension overlay
  // need the true outer extent; the body mesh zeroes detached sides downstream.
  const detachMargins = stored.detachMargins === true && outline === undefined;
  // Mount-down screws. Stacking flips alternate tiles, which would put a
  // head recess on the underside, and per-tile hole differences break the
  // uniform-tile assumption stacking relies on: the same two reasons magnets and
  // the solid floor are stripped. The stored value returns on toggle-off.
  const screwHoles = stackingOn ? undefined : stored.screwHoles;
  // The pad is provisioned whenever screws are on, not only when this plate's
  // own bands fall short. The split plan is not known here, and a split plate
  // almost always needs it: a corner piece's seam-side anchors have no margin
  // band and a fully interior piece has none at all, so deriving from the
  // unsplit plate would leave interior pieces unfastened, the exact failure
  // per-piece placement exists to prevent. With magnets the shortfall is
  // typically 0.6mm, since the magnet floor already covers most of the recess.
  const screwPad =
    screwHoles?.enabled === true
      ? screwPadThicknessMm(
          screwHoles,
          baseplateFloorDepthBeforeScrews({
            magnetHoles: stackingOn ? false : stored.magnetHoles,
            magnetDepth: stored.magnetDepth,
            solidFloor: stackingOn ? false : stored.solidFloor,
            solidFloorThickness: stored.solidFloorThickness,
          }),
          stored.magnetHoles && !stackingOn
            ? { diameterMm: stored.magnetDiameter, depthMm: stored.magnetDepth }
            : undefined
        )
      : undefined;
  // The connector is only meaningful when margins actually detach. When
  // stacking strips a snapClip style to undefined, the seam gate downstream
  // would read undefined as the dovetail default and emit seams the unstacked
  // plate never had — so the strip turns the seam off too.
  const detachMarginConnector =
    detachMargins && stored.detachMarginConnector === true && !stripConnectors;
  // All-edge slots only exist for the both-female styles with split
  // connectors on. Normalize an orphaned flag away (rather than letting it ride
  // along) so it can't fragment the mesh cache or the piece fingerprints; the
  // stored value returns as soon as a key/clip style is selected again.
  const connectorSlotsAllEdges =
    !stripConnectors &&
    stored.connectorSlotsAllEdges === true &&
    stored.connectorNubs === true &&
    isSeatedConnectorStyle(stored.connectorStyle)
      ? true
      : undefined;

  return {
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    nozzleSizeMm,
    outline,
    outlineOverhang: overhang,
    magnetHoles: stackingOn ? false : stored.magnetHoles,
    magnetDiameter: stored.magnetDiameter,
    magnetDepth: stored.magnetDepth,
    magnetAnchor,
    paddingLeft: paddingOn ? stored.paddingLeft : 0,
    paddingRight: paddingOn ? stored.paddingRight : 0,
    paddingFront: paddingOn ? stored.paddingFront : 0,
    paddingBack: paddingOn ? stored.paddingBack : 0,
    fractionalEdgeX: effFractionalEdgeX,
    fractionalEdgeY: effFractionalEdgeY,
    overTile: stored.overTile,
    // Half-grid is meaningless without over-tile; normalize so an orphaned flag
    // can't fragment caches or trigger needless regeneration.
    overTileHalfGrid: stored.overTile === true ? stored.overTileHalfGrid : undefined,
    // Solid-leftover only applies under half-grid; drop it otherwise for the
    // same cache-stability reason.
    overTileHalfGridSolidLeftover:
      stored.overTile === true && stored.overTileHalfGrid === true
        ? stored.overTileHalfGridSolidLeftover
        : undefined,
    // Whole-cell fitting only has meaning against a perimeter — a rectangle has
    // no crossed cell to drop. Same normalization contract as the flags above,
    // so an orphaned flag can't fragment caches or force a regeneration.
    // `=== true` here as well as in the generator and the cache key: the key is
    // allowlisted server-side without a type check, and resolved params are what
    // split pieces inherit, so a malformed value must not travel that far.
    wholeCellsOnly: outline !== undefined && stored.wholeCellsOnly === true ? true : undefined,
    connectorNubs: stripConnectors ? false : stored.connectorNubs,
    invertDovetails: stored.invertDovetails,
    preferIdenticalPieces: stored.preferIdenticalPieces,
    connectorStyle: stripConnectors ? undefined : stored.connectorStyle,
    connectorSlotsAllEdges,
    connectorFitOffset: stored.connectorFitOffset,
    lightweight: stored.lightweight,
    // Stack printing nests flipped plates into each other, which needs the
    // pockets through-cut — a solid floor would block the nesting — so strip it
    // while stacking (restored when stacking is off, like magnets above).
    solidFloor: stackingOn ? false : stored.solidFloor,
    solidFloorThickness: stored.solidFloorThickness,
    screwHoles,
    screwPadThicknessMm: screwPad,
    cornerRadius: roundingOn ? stored.cornerRadius : 0,
    cornerRadii: roundingOn ? stored.cornerRadii : undefined,
    detachMargins,
    detachMarginConnector,
    // A user-drawn split plan is meaningful only while it still describes this
    // plate, so an orphaned one (grid resized, fractional edge flipped, or a
    // malformed synced payload) is dropped here and the planner falls back to
    // its own search — the plate is never rendered from a plan that disagrees
    // with the geometry. Same normalization contract as the optional flags
    // above, with shape validation on top: the field is allowlisted server-side
    // without a type check.
    splitOverride: normalizeSplitOverride(
      stored.splitOverride,
      width,
      depth,
      effFractionalEdgeX,
      effFractionalEdgeY
    ),
  };
}
