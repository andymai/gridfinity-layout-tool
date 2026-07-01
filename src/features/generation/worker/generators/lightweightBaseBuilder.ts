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
 *
 * Coordinate system matches the socket: Z=0 top (mates with body), Z=-SOCKET_HEIGHT bottom.
 */

import {
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
import { magnetPositionsForCell } from './baseplateMagnets';
import { sketch } from './meshUtils';
import {
  buildSingleCellSocket,
  buildSimplifiedCellSocket,
  forEachSocketCell,
  DEFAULT_FRACTIONAL_EDGE,
  type FractionalEdge,
} from './socketBuilder';
import { isPartialMask, isRegionFilled, type CellMask } from '@/shared/utils/cellMask';

/** Solid margin of plastic around each magnet/screw hole in a retained pad. */
const PAD_MARGIN = 1.2;

/** Which side of the base the lite shell opens toward. */
export type LightweightOpenDirection = 'up' | 'down';

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
 * @param openDir    `'up'` for hollow bins (cavity side), `'down'` for solid bins.
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
  halfSockets = false,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  openFloorDrawings?: readonly Drawing[],
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE
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

  // Vertical shift applied to the inner-foot cut tool. Positive opens the top
  // (cavity side); negative opens the bottom (underside).
  const zShift = openDir === 'up' ? wallThickness : -wallThickness;

  return withScope((scope: DisposalScope): LightweightBase => {
    // Build a vertical prism over the whole base Z-range from a set of footprint
    // polygons. Returns null (and the caller skips that clip) on any degenerate
    // input rather than sinking the build.
    const buildClipPrism = (drawings: readonly Drawing[] | undefined): Shape3D | null => {
      if (!drawings || drawings.length === 0) return null;
      try {
        return scope.register(
          unwrap(
            fuseAll(
              drawings.map(
                (d) =>
                  scope.register(
                    sketch(d, 'XY', -SOCKET_HEIGHT - 1).extrude(SOCKET_HEIGHT + wallThickness + 2)
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

    forEachSocketCell(
      gridW,
      gridD,
      cellMask,
      gridUnitMm,
      halfSockets,
      (cell) => {
        if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
        const cellW_mm = cell.widthUnits * unitX - CLEARANCE;
        const cellD_mm = cell.depthUnits * unitY - CLEARANCE;
        feet.push(
          translate(scope.register(buildFoot(cellW_mm, cellD_mm)), [cell.centerX, cell.centerY, 0])
        );

        const innerW = cellW_mm - 2 * wallThickness;
        const innerD = cellD_mm - 2 * wallThickness;
        // Wall thickness too large for this cell — keep the solid foot (no cavity,
        // best-effort) so the base never collapses to nothing.
        if (innerW <= 0.2 || innerD <= 0.2) return;

        // Inner foot shifted by ±wt: a uniform-wt offset of the foot (socket insets
        // are absolute). The shift leaves a wt floor at the closed end; for 'up' it
        // also pokes a slug above the foot top, reused as the floor-opening tool.
        const innerFoot = scope.register(buildFoot(innerW, innerD));
        voids.push(
          translate(scope.register(unwrap(clone(innerFoot))), [cell.centerX, cell.centerY, zShift])
        );
        if (openDir === 'up') {
          openingTools.push(
            translate(scope.register(unwrap(clone(innerFoot))), [
              cell.centerX,
              cell.centerY,
              wallThickness,
            ])
          );
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
        false,
        (cell) => {
          if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
          if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
          // Fit-or-center magnet positions so a non-square/small foot's pads and
          // drills stay inside the foot instead of breaching its side.
          const positions = magnetPositionsForCell(cell, holeRadius, unitX, unitY);
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
