/**
 * Lightweight ("Gridfinity Lite") base builder.
 *
 * Replaces the solid socket feet with `wallThickness` shells so the cavity
 * floor follows the inside of the socket taper — the grid shape is exposed on
 * the interior and the bin saves filament. Built per-cell so it aligns 1:1
 * with {@link buildBaseSocket}'s feet (and therefore with the baseplate).
 *
 * Construction per cell (no `shell()` — its concave-perimeter limits and
 * face-finder fragility don't apply here): build the solid foot, then cut an
 * inner foot from it. Because the Gridfinity socket profile insets are
 * absolute (2.15mm / 2.95mm), a foot built at `(cellW - 2·wt, cellD - 2·wt)`
 * is a uniform `wt` offset of the full foot at every depth, so the cut leaves
 * walls of exactly `wallThickness`.
 *
 * Open direction:
 * - `'up'` (hollow bins): the cup opens toward the cavity. The inner foot is
 *   shifted up by `wt` so the cut leaves a `wt` bottom and pokes `wt` above
 *   the foot top — that protruding slug is reused to punch the matching
 *   opening through the body floor (see `floorOpenings`).
 * - `'down'` (solid bins): the cup opens toward the underside, closed at the
 *   top by a `wt` membrane under the solid body. No floor opening.
 * - `'through'` (spacers,): NO shift, so the uniform-`wt` offset leaves the
 *   cup open at both ends — a foot-shaped tube. Still emits the floor opening, so
 *   the body floor is punched too and the cell becomes a clean through-hole. The
 *   inter-cell webbing (each cup keeps its own `wt` wall) is what ties the feet
 *   together once the floor is gone, so a multi-cell spacer stays one solid.
 * - `'underside'` (the inverted relief): the same unshifted cut, but NO floor
 *   opening — the bin's own floor is what caps the ring, so the interior stays
 *   flat and the redundant membrane `'down'` leaves under it is never built.
 *   Offset by {@link UNDERSIDE_RELIEF_BORDER_MM} rather than `wt`: this ring
 *   stands on the bed and carries a bridged floor, so it wants more material
 *   than a wall supported on both sides.
 *
 * Coordinate system matches the socket: Z=0 top (mates with body), Z=-SOCKET_HEIGHT bottom.
 */

import {
  box,
  cylinder,
  unwrap,
  fuseAll,
  cut,
  cutAll,
  fuse,
  intersect,
  clone,
  translate,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope, Drawing } from 'brepjs';
import { SIZE, CLEARANCE, SOCKET_HEIGHT, MAGNET_FLOOR } from './generatorConstants';
import { resolvePitch, type GridUnitInput } from './gridPitch';
import { cellHostsAttachmentHoles, magnetPositionsForCell } from './baseplateMagnets';
import type { MagnetAnchor } from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import { sketch } from './meshUtils';
import {
  buildSingleCellSocket,
  buildSimplifiedCellSocket,
  buildSocketTopPrism,
  forEachSocketCell,
  DEFAULT_FRACTIONAL_EDGE,
  type FractionalEdge,
  DEFAULT_SOCKET_CELL_PLAN,
  type SocketCellPlan,
} from './socketBuilder';
import { isPartialMask, isRegionFilled, type CellMask } from '@/shared/utils/cellMask';
import { UNDERSIDE_RELIEF_BORDER_MM } from '@/shared/types/bin';

/** Solid margin of plastic around each magnet/screw hole in a retained pad. */
const PAD_MARGIN = 1.2;

/** Cross-web thickness that limits each underside bridge to half a cell. */
export const UNDERSIDE_SUPPORT_RIB_MM = 1.2;

/** Which side of the base the lite shell opens toward — or both, for a spacer. */
export type LightweightOpenDirection = 'up' | 'down' | 'through' | 'underside';

/** Result of {@link buildLightweightBase}. */
export interface LightweightBase {
  /**
   * The shelled cups + retained magnet/screw pads, occupying the socket
   * region. Used in place of the solid base socket: deferred and fused into
   * the body last (export) or meshed alongside it (preview).
   */
  readonly base: Shape3D;
  /**
   * Tool that punches each cup's mouth through the body's solid floor so the
   * cavity sees the cup recess. `null` for `'down'` (the solid body keeps its
   * floor). Caller cuts it from the body, then deletes it.
   */
  readonly floorOpenings: Shape3D | null;
}

/**
 * Build a single magnet/screw retaining pad set for one full cell: four solid
 * bosses at the standard ±13mm corner positions, each tall enough to hold the
 * pocket plus {@link MAGNET_FLOOR}, sitting on the cup's closed end.
 *
 * Returned pads are positioned in cell-local coordinates (caller translates by
 * the cell center). Both directions anchor the pad at the foot bottom
 * (Z=-SOCKET_HEIGHT) because the magnet/screw always enters from there — that's
 * where the drill cutters live. `'up'` (hollow) cups close at the bottom, so a
 * short `holeFloorDepth` boss sits on the closed floor; `'down'` (solid) cups
 * open at the bottom, so the pad spans the full SOCKET_HEIGHT to tie the magnet
 * boss up to the solid body above (otherwise it'd float). Either way the drill
 * intersects the pad and the pocket is cut.
 *
 * `'underside'` behaves as `'down'` does and for the same reason: its ring is
 * open at the bottom, so the pad has to reach the solid body above or it would
 * float. `'through'` never reaches here — a spacer with magnets keeps its cup
 * floors (`'up'`) precisely because a boss standing in a through-hole would have
 * nothing to attach to; see the openDir choice in `shellStage`.
 */
function buildCellPads(
  scope: DisposalScope,
  positions: ReadonlyArray<readonly [number, number]>,
  holeRadius: number,
  holeFloorDepth: number,
  openDir: LightweightOpenDirection
): Shape3D[] {
  const padRadius = holeRadius + PAD_MARGIN;
  const padHeight = openDir === 'up' ? holeFloorDepth : SOCKET_HEIGHT;
  return positions.map(([x, y]) =>
    translate(scope.register(cylinder(padRadius, padHeight)), [x, y, -SOCKET_HEIGHT])
  );
}

/**
 * Build the lightweight base for a bin footprint.
 *
 * @param withMagnet Retain magnet pads (pocket = magnetDepth + MAGNET_FLOOR).
 * @param withScrew  Retain screw pads (through pocket).
 * @param openDir    `'up'` for hollow bins (cavity side), `'down'` for solid
 *   bins, `'underside'` for the inverted relief, `'through'` for a spacer.
 * @param forExport  Full 5-section foot profile when true; simplified for preview.
 * @param openFloorDrawings Optional open-cavity floor polygons (centered on the
 *   bin origin). When given, cup hollowing + floor openings are clipped to this
 *   region so a foot crossed by a divider keeps a solid core under the divider —
 *   the divider then rests on solid material instead of bridging the cup recess.
 *   Pass the union of compartment cavities; omit for single-compartment bins.
 */
export function buildLightweightBase(
  gridW: number,
  gridD: number,
  wallThickness: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  openDir: LightweightOpenDirection,
  forExport = false,
  plan: SocketCellPlan = DEFAULT_SOCKET_CELL_PLAN,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  openFloorDrawings?: readonly Drawing[],
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE,
  anchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR,
  /**
   * Body floor thickness (mm); defaults to `wallThickness`.
   *
   * Only the floor OPENING reads it. The cup's own wall stays `wallThickness`:
   * the opening tool has to reach the floor's top face to break through, and
   * that face is the floor's, not the wall's.
   */
  floorThickness?: number
): LightweightBase {
  const usingMask = isPartialMask(cellMask);
  // Per-axis pitch: unitX scales width/columns, unitY scales depth/rows.
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const cellInMask = (
    centerX: number,
    centerY: number,
    wUnits: number,
    dUnits: number
  ): boolean => {
    if (!usingMask) return true;
    const totalW_mm = gridW * unitX;
    const totalD_mm = gridD * unitY;
    const leftUnit = (centerX + totalW_mm / 2 - (wUnits * unitX) / 2) / unitX;
    const bottomUnit = (centerY + totalD_mm / 2 - (dUnits * unitY) / 2) / unitY;
    return isRegionFilled(cellMask, leftUnit, bottomUnit, wUnits, dUnits);
  };

  // How far the cut holds back from each foot's outer face. The socket
  // profile's insets are absolute, so an inner foot built at `cell - 2*offset`
  // is a uniform `offset` wall at EVERY depth — which is what lets the underside
  // relief take a wider border than the wall without any risk of breaching the
  // baseplate-mating taper. A straight prism would have to clear
  // SOCKET_TAPER_WIDTH before it left any wall at all.
  const shellOffset = openDir === 'underside' ? UNDERSIDE_RELIEF_BORDER_MM : wallThickness;
  // Vertical shift applied to the inner-foot cut tool. Positive opens the top
  // (cavity side); negative opens the bottom (underside); zero opens both, since
  // the inner foot is a uniform lateral offset at every depth.
  //
  // `'underside'` shares the zero shift with `'through'` and differs only in
  // what caps the result: the spacer punches the floor open over the mouth, the
  // relief leaves it solid. Cutting to exactly Z=0 rather than stopping a wall
  // short of it is the whole saving — a membrane there would sit under a floor
  // that is already solid, costing `wallThickness` of slab across the footprint
  // for nothing (it does not even shorten the bridge above it).
  const zShift =
    openDir === 'through' || openDir === 'underside'
      ? 0
      : openDir === 'up'
        ? wallThickness
        : -wallThickness;
  // Both open-top directions punch the body floor over the cup mouth.
  const opensUpward = openDir === 'up' || openDir === 'through';

  return withScope((scope: DisposalScope): LightweightBase => {
    // Build a vertical prism over the whole base Z-range from a set of footprint
    // polygons. Returns null (and the caller skips that clip) on any degenerate
    // input rather than sinking the build.
    //
    // Reaches the FLOOR top, not the wall's: it clips the opening tools, so a
    // prism that stopped short would truncate them inside the floor and re-seal
    // every cup it was only meant to narrow.
    const buildClipPrism = (drawings: readonly Drawing[] | undefined): Shape3D | null => {
      if (!drawings || drawings.length === 0) return null;
      try {
        return scope.register(
          unwrap(
            fuseAll(
              drawings.map(
                (d) =>
                  scope.register(
                    sketch(d, 'XY', -SOCKET_HEIGHT - 1).extrude(
                      SOCKET_HEIGHT + (floorThickness ?? wallThickness) + 2
                    )
                  ) as ValidSolid
              )
            )
          )
        );
      } catch {
        return null;
      }
    };

    // cavityClip = where feet MAY hollow (open compartment floor). The void and
    // floor opening are intersected with it so a foot crossed by a divider keeps
    // a solid core under the divider (no bridge over the recess).
    const cavityClip = buildClipPrism(openFloorDrawings);
    const clipRegion = (solidShape: Shape3D): Shape3D => {
      const r = unwrap(intersect(solidShape, scope.register(unwrap(clone(cavityClip as Shape3D)))));
      if (solidShape !== r) solidShape.delete();
      return r;
    };

    const buildFoot = (w: number, d: number): Shape3D =>
      forExport ? buildSingleCellSocket(w, d) : buildSimplifiedCellSocket(w, d);

    const feet: Shape3D[] = [];
    const voids: Shape3D[] = [];
    const openingTools: Shape3D[] = [];
    const undersideSupports: Shape3D[] = [];

    forEachSocketCell(
      gridW,
      gridD,
      cellMask,
      gridUnitMm,
      plan,
      (cell) => {
        if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
        const cellW_mm = cell.widthUnits * unitX - CLEARANCE;
        const cellD_mm = cell.depthUnits * unitY - CLEARANCE;
        const foot = translate(scope.register(buildFoot(cellW_mm, cellD_mm)), [
          cell.centerX,
          cell.centerY,
          0,
        ]);
        feet.push(foot);

        const innerW = cellW_mm - 2 * shellOffset;
        const innerD = cellD_mm - 2 * shellOffset;
        // Offset too large for this cell — keep the solid foot (no cavity,
        // best-effort) so the base never collapses to nothing. Reachable for the
        // relief's wider border on a small custom grid pitch, not just for a
        // thick wall.
        if (innerW <= 0.2 || innerD <= 0.2) return;

        // Inner foot shifted by ±offset: a uniform offset of the foot (socket
        // insets are absolute). The shift leaves a floor at the closed end; for
        // 'up' it also pokes a slug above the foot top, reused as the
        // floor-opening tool.
        const innerFoot = scope.register(buildFoot(innerW, innerD));
        voids.push(
          translate(scope.register(unwrap(clone(innerFoot))), [cell.centerX, cell.centerY, zShift])
        );
        if (openDir === 'underside') {
          const ribHeight = SOCKET_HEIGHT;
          const ribZ = -SOCKET_HEIGHT / 2;
          const slabs = [
            box(cellW_mm, UNDERSIDE_SUPPORT_RIB_MM, ribHeight, {
              at: [cell.centerX, cell.centerY, ribZ],
            }),
            box(UNDERSIDE_SUPPORT_RIB_MM, cellD_mm, ribHeight, {
              at: [cell.centerX, cell.centerY, ribZ],
            }),
          ];
          for (const slab of slabs) {
            const clipped = unwrap(
              intersect(scope.register(slab), scope.register(unwrap(clone(foot))))
            );
            undersideSupports.push(clipped);
          }
        }
        if (opensUpward) {
          // The SAME shape as the void, at the same shift, so the opening is
          // flush with the cup mouth. Shifting it further to reach a thicker
          // floor would cut with a narrower slice of the taper and leave an
          // unsupported horizontal ledge around every cup.
          openingTools.push(
            translate(scope.register(unwrap(clone(innerFoot))), [
              cell.centerX,
              cell.centerY,
              zShift,
            ])
          );
          // What the void does not reach: a prism of the cup mouth carrying the
          // opening the rest of the way up through the floor.
          const remaining = (floorThickness ?? wallThickness) - zShift;
          if (remaining > 0) {
            openingTools.push(
              translate(scope.register(buildSocketTopPrism(innerW, innerD, remaining)), [
                cell.centerX,
                cell.centerY,
                zShift,
              ])
            );
          }
        }
      },
      fractionalEdge
    );

    if (feet.length === 0) {
      throw new Error('Lightweight base: at least one cell required');
    }

    // Fuse feet → solid base, fuse voids → one tool, hollow in a single cut.
    let base = unwrap(fuseAll(feet as ValidSolid[], { optimisation: 'commonFace' }));
    for (const f of feet) if (f !== base) f.delete();

    if (voids.length > 0) {
      let voidSolid: Shape3D = unwrap(
        fuseAll(voids as ValidSolid[], { optimisation: 'commonFace' })
      );
      for (const v of voids) if (v !== voidSolid) v.delete();
      if (cavityClip) voidSolid = clipRegion(voidSolid);
      const hollow = unwrap(cut(base, voidSolid));
      if (hollow !== base) base.delete();
      if (voidSolid !== hollow) voidSolid.delete();
      base = hollow;
    }

    if (undersideSupports.length > 0) {
      const supports = unwrap(
        fuseAll(undersideSupports as ValidSolid[], { optimisation: 'commonFace' })
      );
      for (const rib of undersideSupports) if (rib !== supports) rib.delete();
      const supported = unwrap(fuse(base, supports));
      if (supported !== base) base.delete();
      if (supports !== supported) supports.delete();
      base = supported;
    }

    // Retain magnet/screw pads as solid islands, then drill the pockets.
    if (withMagnet || withScrew) {
      const holeRadius = Math.max(withMagnet ? magnetRadius : 0, withScrew ? screwRadius : 0);
      const floorDepth =
        (withMagnet ? magnetDepth : SOCKET_HEIGHT) + (withMagnet ? MAGNET_FLOOR : 0);
      const pads: Shape3D[] = [];
      const drills: Shape3D[] = [];
      forEachSocketCell(
        gridW,
        gridD,
        cellMask,
        gridUnitMm,
        DEFAULT_SOCKET_CELL_PLAN,
        (cell) => {
          if (!cellHostsAttachmentHoles(cell, holeRadius, unitX, unitY)) return;
          if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
          // Fit-or-center magnet positions so a non-square/small foot's pads and
          // drills stay inside the foot instead of breaching its side.
          const positions = magnetPositionsForCell(cell, holeRadius, unitX, unitY, anchor);
          for (const p of buildCellPads(scope, positions, holeRadius, floorDepth, openDir)) {
            pads.push(p);
          }
          for (const [x, y] of positions) {
            if (withMagnet) {
              drills.push(
                translate(scope.register(cylinder(magnetRadius, magnetDepth)), [
                  x,
                  y,
                  -SOCKET_HEIGHT,
                ])
              );
            }
            if (withScrew) {
              drills.push(
                translate(scope.register(cylinder(screwRadius, SOCKET_HEIGHT + 0.01)), [
                  x,
                  y,
                  -SOCKET_HEIGHT,
                ])
              );
            }
          }
        },
        fractionalEdge
      );
      if (pads.length > 0) {
        const padUnion = scope.register(unwrap(fuseAll(pads as ValidSolid[])));
        const padded = unwrap(fuse(base, padUnion));
        if (padded !== base) base.delete();
        base = padded;
      }
      if (drills.length > 0) {
        const drilled = unwrap(cutAll(base, drills as ValidSolid[]));
        if (drilled !== base) base.delete();
        base = drilled;
      }
    }

    let floorOpenings: Shape3D | null = null;
    if (openingTools.length > 0) {
      floorOpenings = unwrap(fuseAll(openingTools as ValidSolid[], { optimisation: 'commonFace' }));
      for (const t of openingTools) if (t !== floorOpenings) t.delete();
      // Clip to the open cavity (and out of scoop bands) so the floor stays
      // solid under dividers + scoops, in lockstep with the cup void above (a
      // capped recess would just relocate the bridge to the floor).
      if (cavityClip) floorOpenings = clipRegion(floorOpenings);
    }

    // base + floorOpenings are NOT scope-registered — they survive the scope.
    return { base, floorOpenings };
  });
}
