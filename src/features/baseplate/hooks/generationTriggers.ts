/** The layout-store selection that decides when a baseplate regenerates. */

import type { useLayoutStore } from '@/core/store/layout';
import { effectiveGridUnitMmY } from '@/core/types';
import type { StoredBaseplateParams, DrawerOutline } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { hasEffectivePerimeter } from '../utils/buildFullParams';
import { isSeatedConnectorStyle } from '@/shared/types/bin';

type LayoutStoreState = ReturnType<typeof useLayoutStore.getState>;

/**
 * Single-slot memo for {@link hasEffectivePerimeter}, which resolves and pads
 * the outline — a per-vertex pass that is wasted on unrelated store ticks.
 *
 * `selectGenerationTriggers` runs on EVERY layout-store update (bin edits,
 * camera, any slider), so without this the outline resolve+pad ran per frame of
 * every drag whenever whole-cell fitting was on. Baseplate params, drawer dims,
 * and the outline are replaced-never-mutated, so the key is a straight
 * identity/value compare of the six resolver inputs — unrelated ticks (which
 * touch none of them) hit the cache. The cache is correctness-neutral: the key
 * fully determines the result, so a stale slot at worst forces a recompute.
 */
let perimeterMemo: {
  bp: StoredBaseplateParams;
  drawerWidth: number;
  drawerDepth: number;
  gridUnitMm: number;
  drawerOutline: DrawerOutline | undefined;
  gridUnitMmY: number;
  result: boolean;
} | null = null;

function hasEffectivePerimeterMemoized(
  bp: StoredBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  drawerOutline: DrawerOutline | undefined,
  gridUnitMmY: number
): boolean {
  const cached = perimeterMemo;
  if (
    cached !== null &&
    cached.bp === bp &&
    cached.drawerWidth === drawerWidth &&
    cached.drawerDepth === drawerDepth &&
    cached.gridUnitMm === gridUnitMm &&
    cached.drawerOutline === drawerOutline &&
    cached.gridUnitMmY === gridUnitMmY
  ) {
    return cached.result;
  }
  const result = hasEffectivePerimeter(
    bp,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    drawerOutline,
    gridUnitMmY
  );
  perimeterMemo = {
    bp,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    drawerOutline,
    gridUnitMmY,
    result,
  };
  return result;
}

/**
 * The layout fields whose change must trigger a baseplate regeneration. Used as
 * the single source of truth for BOTH the `useShallow` selection and the regen
 * effect's dependency — they previously duplicated this list, and a geometry
 * param (`connectorStyle`) dropped from one half silently stopped regeneration
 * (the exploded preview kept its stale dovetail pieces). Keeping it in one place
 * means a new geometry param is wired in by adding it here once.
 */
export function selectGenerationTriggers(state: LayoutStoreState) {
  const bp = state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
  // Stacking strips screws AND magnets in buildFullParams (a flipped tile
  // would put the head recess and the magnet bridges on the underside), so
  // neither family's fields can change the mesh while it is on.
  const stackingOn = bp.stackPrint?.enabled === true;
  const screwsOn = !stackingOn && bp.screwHoles?.enabled === true;
  // The underside cross cutters run on magnet plates and screw-pad cells.
  const lightweightRelevant = (!stackingOn && bp.magnetHoles) || screwsOn;
  return {
    drawerWidth: state.layout.drawer.width,
    drawerDepth: state.layout.drawer.depth,
    // Immutability contract: outlines are replaced, never mutated, so the
    // reference is a valid change signal under useShallow.
    drawerOutline: state.layout.drawer.outline,
    gridUnitMm: state.layout.gridUnitMm,
    gridUnitMmY: effectiveGridUnitMmY(state.layout),
    printBedSize: state.layout.printBedSize,
    printBedDepth: state.layout.printBedDepth,
    fractionalEdgeX:
      bp.syncWithLayout !== false
        ? (state.layout.drawer.fractionalEdgeX ?? 'end')
        : (bp.fractionalEdgeX ?? 'end'),
    fractionalEdgeY:
      bp.syncWithLayout !== false
        ? (state.layout.drawer.fractionalEdgeY ?? 'end')
        : (bp.fractionalEdgeY ?? 'end'),
    // Manual grid shift moves the frame re-base, so it must re-trigger BREP.
    // Folded out unless a synced drawer shape is active — the resolver ignores
    // it otherwise, so it cannot change the mesh.
    gridShiftX:
      state.layout.drawer.outline !== undefined && bp.syncWithLayout !== false
        ? (state.layout.drawer.gridShiftX ?? 0)
        : 0,
    gridShiftY:
      state.layout.drawer.outline !== undefined && bp.syncWithLayout !== false
        ? (state.layout.drawer.gridShiftY ?? 0)
        : 0,
    overTile: bp.overTile ?? false,
    overTileHalfGrid: bp.overTile === true ? (bp.overTileHalfGrid ?? false) : false,
    overTileHalfGridSolidLeftover:
      bp.overTile === true && bp.overTileHalfGrid === true
        ? (bp.overTileHalfGridSolidLeftover ?? false)
        : false,
    // Folded out without a perimeter, matching buildFullParams and the mesh
    // cache key: a stored flag on a rectangular plate cannot alter geometry, so
    // toggling it must not trigger a regeneration. Uses the resolver's own
    // predicate, since a large corner radius also yields a perimeter — keying
    // on the raw drawer outline would leave those plates stale on a toggle. The
    // `&&` short-circuits the (memoized) resolve+pad away entirely unless the
    // flag is set, and the memo spares the rest of the drags.
    wholeCellsOnly:
      bp.wholeCellsOnly === true &&
      hasEffectivePerimeterMemoized(
        bp,
        state.layout.drawer.width,
        state.layout.drawer.depth,
        state.layout.gridUnitMm,
        state.layout.drawer.outline,
        effectiveGridUnitMmY(state.layout)
      ),
    magnetHoles: bp.magnetHoles,
    magnetDiameter: bp.magnetDiameter,
    magnetDepth: bp.magnetDepth,
    // Layout-scoped magnet anchor (edge vs legacy center). Changes hole XY on
    // grids >42mm, so it must re-trigger BREP like the other magnet params.
    magnetAnchor: state.layout.magnetAnchor,
    // Solid floor changes slab height + through-cut, and its thickness sets how
    // much taller the plate gets — both must re-trigger BREP. The thickness only
    // bites when the floor is on, so fold it out otherwise to avoid needless
    // regeneration while dragging the (hidden) slider.
    solidFloor: bp.solidFloor ?? false,
    solidFloorThickness: bp.solidFloor === true ? bp.solidFloorThickness : undefined,
    // Mount-down screws decide which cells keep a floor, grow the slab
    // by the pad, and cut the hole/recess geometry — every field must
    // re-trigger BREP. The geometry fields fold out while screws are off (or
    // stripped by stacking) so edits that cannot change the mesh don't
    // regenerate it; the counterbore depth additionally folds out under a
    // countersink head, whose depth is derived from the cone angle instead.
    screwHolesEnabled: screwsOn,
    screwDiameter: screwsOn ? bp.screwHoles.diameter : undefined,
    screwHeadStyle: screwsOn ? bp.screwHoles.headStyle : undefined,
    screwHeadDiameter: screwsOn ? bp.screwHoles.headDiameter : undefined,
    screwCounterboreDepth:
      screwsOn && bp.screwHoles.headStyle === 'counterbore'
        ? bp.screwHoles.counterboreDepth
        : undefined,
    screwsPerPiece: screwsOn ? bp.screwHoles.screwsPerPiece : undefined,
    // Nothing in the UI writes `lightweight` today, but synced/imported params
    // can carry it, and the underside cross cutters consume it on magnet
    // plates and screw-pad cells alike — fold it out when neither can
    // (stacking strips both, so it folds out there too).
    lightweight: lightweightRelevant ? bp.lightweight !== false : true,
    paddingLeft: bp.paddingLeft,
    paddingRight: bp.paddingRight,
    paddingFront: bp.paddingFront,
    paddingBack: bp.paddingBack,
    connectorNubs: bp.connectorNubs,
    connectorStyle: bp.connectorStyle,
    // All-edge slots add grooves to the exterior edges and change which pieces
    // dedupe, so it must re-trigger BREP — but `buildFullParams` drops it unless
    // connectors are on with a both-female style, so fold it out otherwise
    // rather than regenerating for a flag that can't change the mesh.
    connectorSlotsAllEdges:
      bp.connectorNubs === true &&
      isSeatedConnectorStyle(bp.connectorStyle) &&
      bp.connectorSlotsAllEdges === true,
    // Fit offset biases every connector clearance (tongues/grooves, snap-clip
    // levels, margin-rail seams), so it must re-trigger BREP — folded out when
    // neither split connectors nor the margin seam can consume it.
    connectorFitOffset:
      bp.connectorNubs === true || (bp.detachMargins === true && bp.detachMarginConnector === true)
        ? bp.connectorFitOffset
        : undefined,
    syncWithLayout: bp.syncWithLayout,
    baseplateWidth: bp.baseplateWidth,
    baseplateDepth: bp.baseplateDepth,
    cornerRadius: bp.cornerRadius,
    cornerRadii: bp.cornerRadii,
    invertDovetails: bp.invertDovetails,
    preferIdenticalPieces: bp.preferIdenticalPieces,
    // Toggling stacking strips magnets, screws, the solid floor and snap clips
    // in `buildFullParams`, so it must re-run generation — otherwise the preview
    // keeps the pre-strip mesh (magnet holes that the export no longer has).
    stackEnabled: bp.stackPrint?.enabled ?? false,
    // Detaching margins changes the body mesh (padding-free on detached sides)
    // and emits separate rails, so it must re-trigger generation.
    detachMargins: bp.detachMargins ?? false,
    // The connector adds a seam tongue to the body and a groove to the rail —
    // but only when margins detach (buildFullParams gates it), so ignore the
    // flag otherwise to avoid regenerating when it can't change the mesh.
    detachMarginConnector: bp.detachMargins === true && bp.detachMarginConnector === true,
    // A user-drawn split changes which pieces exist and how big each one is, so
    // it must re-run generation. Passed by reference under the same
    // immutability contract as `drawerOutline`/`cornerRadii`: stored params are
    // replaced, never mutated, so a new object means a new plan.
    splitOverride: bp.splitOverride,
  };
}
