/**
 * Lightweight floor cutter for baseplate cells.
 *
 * When magnets are enabled, removes center floor material under each cell,
 * keeping only rectangular pads around the 4 magnet positions. The result is
 * a cross-shaped cutout with sharp inner corners — the cut is a vertical prism
 * so concave corners print cleanly, and dropping the former fillets roughly
 * halves the per-cell boolean cost.
 */

import { draw, drawRectangle, clone, unwrap, translate } from 'brepjs';
import type { Shape3D, Drawing } from 'brepjs';
import { SOCKET_HEIGHT, MAGNET_FLOOR, COPLANAR_MARGIN, INSET_BOT } from './generatorConstants';
import { forEachCell } from './cellDecomposition';
import type { ForEachCellOptions, CellInfo } from './cellDecomposition';
import { resolvePitch, type GridUnitInput } from './gridPitch';
import { magnetPositionsForCell } from './baseplateMagnets';
import { sketch } from './meshUtils';

/** Margin around each magnet hole center that defines the pad extent (mm). */
const PAD_MARGIN = 1;

/** Minimum arm width for the cross cutout (mm). Skip cell if arms too narrow. */
const MIN_ARM_WIDTH = 2;

/**
 * Cross ("plus") profile centered at origin (CCW, 12 straight segments): a
 * vertical arm of half-width `padHalfX` spanning ±`hd` and a horizontal arm of
 * half-height `padHalfY` spanning ±`hw`. Removing it leaves the 4 corner magnet
 * pads. `padHalfX`/`padHalfY` are per-axis so the kept pads track the actual
 * (possibly pulled-in / non-square) magnet offsets; a square cell passes equal
 * values and the profile is identical to the symmetric case. Shared by the
 * full-cell cutter and the standard-fits partial tile.
 */
function crossProfile(hw: number, hd: number, padHalfX: number, padHalfY: number) {
  return draw([padHalfX, hd])
    .lineTo([-padHalfX, hd])
    .lineTo([-padHalfX, padHalfY])
    .lineTo([-hw, padHalfY])
    .lineTo([-hw, -padHalfY])
    .lineTo([-padHalfX, -padHalfY])
    .lineTo([-padHalfX, -hd])
    .lineTo([padHalfX, -hd])
    .lineTo([padHalfX, -padHalfY])
    .lineTo([hw, -padHalfY])
    .lineTo([hw, padHalfY])
    .lineTo([padHalfX, padHalfY])
    .close();
}

/**
 * Extrude a 2D profile downward into a floor-cutter solid at the standard cutter
 * Z-band, then translate it to (cx, cy). Caller owns the returned Shape3D.
 */
function extrudeCutter(
  profile: Drawing,
  cx: number,
  cy: number,
  cutterZ: number,
  cutterDepth: number
): Shape3D {
  const base = sketch(profile, 'XY', cutterZ).extrude(-cutterDepth);
  try {
    return translate(base, [cx, cy, 0]);
  } finally {
    base.delete();
  }
}

/**
 * Build cross-shaped floor cutters that remove center material under each cell,
 * keeping only pads around the 4 magnet positions.
 *
 * @param gridW Grid width in units
 * @param gridD Grid depth in units
 * @param magnetRadius Magnet hole radius in mm
 * @param magnetDepth Magnet hole depth in mm
 * @param cellOpts Cell iteration options including gridUnitMm
 * @param lightweight Whether lightweight floor is enabled (default true)
 * @returns Array of cutter solids to subtract from the baseplate
 */
export function buildLightweightFloorCutters(
  gridW: number,
  gridD: number,
  magnetRadius: number,
  magnetDepth: number,
  cellOpts: ForEachCellOptions & { gridUnitMm: GridUnitInput },
  lightweight?: boolean,
  cellFilter?: (cell: CellInfo) => boolean
): Shape3D[] {
  if (lightweight === false) return [];

  const { x: unitX, y: unitY } = resolvePitch(cellOpts.gridUnitMm);
  const cutterZ = -SOCKET_HEIGHT + COPLANAR_MARGIN;
  const cutterDepth = MAGNET_FLOOR + magnetDepth + 2 * COPLANAR_MARGIN;

  const cutters: Shape3D[] = [];
  const templates = new Map<string, Shape3D>();

  try {
    forEachCell(
      gridW,
      gridD,
      (cell) => {
        if (cellFilter !== undefined && !cellFilter(cell)) return;
        const cellW_mm = cell.widthUnits * unitX;
        const cellD_mm = cell.depthUnits * unitY;

        // Fractional cells (half-unit) have no magnets — cut through their
        // entire floor since the solid material serves no purpose.
        if (cell.widthUnits < 1 || cell.depthUnits < 1) {
          const fhw = cellW_mm / 2 - INSET_BOT;
          const fhd = cellD_mm / 2 - INSET_BOT;
          if (fhw <= 0 || fhd <= 0) return;
          const fractionalKey = `frac-${cell.widthUnits}x${cell.depthUnits}`;
          let fractionalTemplate = templates.get(fractionalKey);
          if (!fractionalTemplate) {
            const rectProfile = drawRectangle(fhw * 2, fhd * 2);
            fractionalTemplate = sketch(rectProfile, 'XY', cutterZ).extrude(-cutterDepth);
            templates.set(fractionalKey, fractionalTemplate);
          }
          const cloned = unwrap(clone(fractionalTemplate));
          try {
            const positioned = translate(cloned, [cell.centerX, cell.centerY, 0]);
            cutters.push(positioned);
          } finally {
            cloned.delete();
          }
          return;
        }

        // Inset by INSET_BOT so the cutout stays within the flat pocket floor
        // and doesn't undercut the tapered pocket walls (which would create overhangs).
        const hw = cellW_mm / 2 - INSET_BOT;
        const hd = cellD_mm / 2 - INSET_BOT;

        // Keep pads around the ACTUAL magnet positions — on a smaller or
        // non-square cell magnetPositionsForCell pulls the corners inward, so a
        // fixed ±HOLE_OFFSET cross would carve straight through the magnets and
        // leave the pads in empty plastic. Derive the per-axis pad half-width
        // from the real offset. Only the symmetric 4-corner layout maps to a
        // cross; 2-magnet / centered layouts (very short axes) are left solid —
        // the tiny weight saving isn't worth a bespoke cut and it can't strand a
        // magnet. A full 42mm cell yields offset 13 → the original cross exactly.
        const positions = magnetPositionsForCell(cell, magnetRadius, unitX, unitY);
        if (positions.length !== 4) return;
        const offX = Math.abs(positions[0][0] - cell.centerX);
        const offY = Math.abs(positions[0][1] - cell.centerY);
        const padHalfX = offX - magnetRadius - PAD_MARGIN;
        const padHalfY = offY - magnetRadius - PAD_MARGIN;
        if (padHalfX < MIN_ARM_WIDTH || padHalfY < MIN_ARM_WIDTH) return;
        if (hw - padHalfX < MIN_ARM_WIDTH || hd - padHalfY < MIN_ARM_WIDTH) return;

        // Cache key includes the offsets: same cell size ⇒ same pull-in ⇒ one
        // template. Inner corners left sharp (vertical-wall underside relief).
        const cacheKey = `${cell.widthUnits}x${cell.depthUnits}`;
        let template = templates.get(cacheKey);

        if (!template) {
          template = sketch(crossProfile(hw, hd, padHalfX, padHalfY), 'XY', cutterZ).extrude(
            -cutterDepth
          );
          templates.set(cacheKey, template);
        }

        const cloned = unwrap(clone(template));
        try {
          const positioned = translate(cloned, [cell.centerX, cell.centerY, 0]);
          cutters.push(positioned);
        } finally {
          cloned.delete();
        }
      },
      cellOpts
    );
  } catch (e) {
    for (const c of cutters) c.delete();
    throw e;
  } finally {
    // Dispose template shapes — they were allocated for this build only.
    // In a finally block so WASM handles are freed even if a BREP op throws.
    for (const t of templates.values()) t.delete();
  }

  return cutters;
}

/**
 * A single underside floor cut planned for a partial over-tile margin tile.
 * `rect` is an axis-aligned prism (a side strip or a center gap); `cross` is the
 * standard 4-corner plus-shape. All coordinates are absolute (world XY).
 */
export type PartialFloorCut =
  | { kind: 'rect'; centerX: number; centerY: number; width: number; depth: number }
  | {
      kind: 'cross';
      centerX: number;
      centerY: number;
      hw: number;
      hd: number;
      padHalfX: number;
      padHalfY: number;
    };

/**
 * Decide how to hollow the underside of one PARTIAL over-tile margin tile,
 * keeping material only around the magnets {@link magnetPositionsForCell} placed.
 * Pure geometry (no BREP kernel) so the branch logic is unit-testable.
 *
 * Cases, mirroring the magnet layout:
 *  - Standard-fits tile (big enough for the ±HOLE_OFFSET corners): the same
 *    cross cut a full cell gets.
 *  - Spread magnets with room on the short axis (25×42, 25×84): keep a spine
 *    along the long axis — through every magnet, anchored to both end walls —
 *    and remove the two short-axis side strips.
 *  - Short axis too thin to strip but two magnets straddle the long axis
 *    (42×13): remove the center gap between the two magnet pads; the pads stay
 *    anchored to the end walls.
 *  - Anything smaller (no magnet, or a lone magnet with no hollow-able room):
 *    no cut — left solid.
 */
export function planPartialCellFloorCuts(
  cell: CellInfo,
  magnetRadius: number,
  gridUnitMm: GridUnitInput
): PartialFloorCut[] {
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const positions = magnetPositionsForCell(cell, magnetRadius, unitX, unitY);
  if (positions.length === 0) return []; // too small for a magnet — leave solid

  const halfW = (cell.widthUnits * unitX) / 2;
  const halfD = (cell.depthUnits * unitY) / 2;
  // Inset by INSET_BOT so the cut stays within the flat pocket floor and doesn't
  // undercut the tapered pocket walls (matches the full-cell cutter).
  const hw = halfW - INSET_BOT;
  const hd = halfD - INSET_BOT;
  if (hw <= MIN_ARM_WIDTH || hd <= MIN_ARM_WIDTH) return []; // no floor worth hollowing

  // Symmetric 4-corner tile → cross cut, with per-axis pads around the ACTUAL
  // (possibly pulled-in) magnet offsets. A full 42mm tile yields offset 13 → the
  // original cross; a smaller/non-square tile pulls the pads in with the magnets.
  if (positions.length === 4) {
    const offX = Math.abs(positions[0][0] - cell.centerX);
    const offY = Math.abs(positions[0][1] - cell.centerY);
    const padHalfX = offX - magnetRadius - PAD_MARGIN;
    const padHalfY = offY - magnetRadius - PAD_MARGIN;
    if (
      padHalfX < MIN_ARM_WIDTH ||
      padHalfY < MIN_ARM_WIDTH ||
      hw - padHalfX < MIN_ARM_WIDTH ||
      hd - padHalfY < MIN_ARM_WIDTH
    ) {
      return [];
    }
    return [
      { kind: 'cross', centerX: cell.centerX, centerY: cell.centerY, hw, hd, padHalfX, padHalfY },
    ];
  }

  const keepHalf = magnetRadius + PAD_MARGIN; // material kept around each magnet

  // Lone centered magnet (small corner tile, e.g. 25×13): no spread to bridge, so
  // hollow the roomier axis's two sides while keeping a pad that spans the tighter
  // axis wall-to-wall (anchored, can't float). Leaves the magnet padded with open
  // room beside it — a wide corner tile opens left/right. Prefer the wider axis;
  // on a tie open left/right.
  if (positions.length === 1) {
    const roomX = hw - keepHalf; // hollow-able strip on each left/right side
    const roomY = hd - keepHalf; // hollow-able strip on each top/bottom side
    if (roomX >= MIN_ARM_WIDTH && roomX >= roomY) {
      const c = keepHalf + roomX / 2;
      return [
        {
          kind: 'rect',
          centerX: cell.centerX + c,
          centerY: cell.centerY,
          width: roomX,
          depth: 2 * hd,
        },
        {
          kind: 'rect',
          centerX: cell.centerX - c,
          centerY: cell.centerY,
          width: roomX,
          depth: 2 * hd,
        },
      ];
    }
    if (roomY >= MIN_ARM_WIDTH) {
      const c = keepHalf + roomY / 2;
      return [
        {
          kind: 'rect',
          centerX: cell.centerX,
          centerY: cell.centerY + c,
          width: 2 * hw,
          depth: roomY,
        },
        {
          kind: 'rect',
          centerX: cell.centerX,
          centerY: cell.centerY - c,
          width: 2 * hw,
          depth: roomY,
        },
      ];
    }
    return []; // no room on either axis — tile left solid
  }

  // Two or more magnets are spread along the longer axis, centered on the shorter.
  const alongX = halfW >= halfD;
  const shortHalf = alongX ? hd : hw; // inset half-extent on the SHORT axis
  const sideStrip = shortHalf - keepHalf; // hollow-able strip on each short side

  const cuts: PartialFloorCut[] = [];

  // Room on the short axis → remove both short-side strips, leaving a spine along
  // the long axis through the magnets.
  if (sideStrip >= MIN_ARM_WIDTH) {
    const stripCenter = keepHalf + sideStrip / 2; // offset from center to each strip
    if (alongX) {
      cuts.push(
        {
          kind: 'rect',
          centerX: cell.centerX,
          centerY: cell.centerY + stripCenter,
          width: 2 * hw,
          depth: sideStrip,
        },
        {
          kind: 'rect',
          centerX: cell.centerX,
          centerY: cell.centerY - stripCenter,
          width: 2 * hw,
          depth: sideStrip,
        }
      );
    } else {
      cuts.push(
        {
          kind: 'rect',
          centerX: cell.centerX + stripCenter,
          centerY: cell.centerY,
          width: sideStrip,
          depth: 2 * hd,
        },
        {
          kind: 'rect',
          centerX: cell.centerX - stripCenter,
          centerY: cell.centerY,
          width: sideStrip,
          depth: 2 * hd,
        }
      );
    }
  }

  // Two magnets straddling the long axis → also hollow the center gap between
  // their pads, so the spine isn't left solid (the open center prints as sparse
  // infill). Each pad stays anchored to its own end wall. A lone magnet, or 3+ in
  // a row, keep the connecting spine so no interior pad is left floating.
  if (positions.length === 2) {
    const coords = positions.map((p) => (alongX ? p[0] : p[1])).sort((a, b) => a - b);
    const gapLo = coords[0] + keepHalf;
    const gapHi = coords[1] - keepHalf;
    const gap = gapHi - gapLo;
    if (gap >= MIN_ARM_WIDTH) {
      const gapCenter = (gapLo + gapHi) / 2;
      cuts.push(
        alongX
          ? { kind: 'rect', centerX: gapCenter, centerY: cell.centerY, width: gap, depth: 2 * hd }
          : { kind: 'rect', centerX: cell.centerX, centerY: gapCenter, width: 2 * hw, depth: gap }
      );
    }
  }

  return cuts; // empty ⇒ nothing safe to hollow, tile left solid
}

/**
 * Build lightweight floor cutters for over-tile PARTIAL margin tiles. The
 * nominal-grid {@link buildLightweightFloorCutters} only hollows full cells, so
 * clipped padding tiles (a 25×42 side strip, a 42×13 top strip) would otherwise
 * keep a solid underside. Called alongside it so the preview and export match.
 */
export function buildPartialCellFloorCutters(
  cells: readonly CellInfo[],
  magnetRadius: number,
  magnetDepth: number,
  gridUnitMm: GridUnitInput,
  lightweight?: boolean
): Shape3D[] {
  if (lightweight === false) return [];

  const cutterZ = -SOCKET_HEIGHT + COPLANAR_MARGIN;
  const cutterDepth = MAGNET_FLOOR + magnetDepth + 2 * COPLANAR_MARGIN;

  const cutters: Shape3D[] = [];
  try {
    for (const cell of cells) {
      for (const cut of planPartialCellFloorCuts(cell, magnetRadius, gridUnitMm)) {
        const profile =
          cut.kind === 'cross'
            ? crossProfile(cut.hw, cut.hd, cut.padHalfX, cut.padHalfY)
            : drawRectangle(cut.width, cut.depth);
        cutters.push(extrudeCutter(profile, cut.centerX, cut.centerY, cutterZ, cutterDepth));
      }
    }
  } catch (e) {
    for (const c of cutters) c.delete();
    throw e;
  }

  return cutters;
}
