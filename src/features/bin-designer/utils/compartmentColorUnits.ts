/**
 * Per-compartment shadow-box colours.
 *
 * The sibling of `cutoutColorUnits`, and deliberately NOT built the same way.
 * A cutout's cavity always comes from one cut path, so `cutoutBuilder` can stamp
 * each tool with a face tag at generation time. Compartments have two paths —
 * `shellStage` bakes the cavities into the body (which `collectOrigins` tags
 * `BASE` wholesale) and `compartmentBuilder` fuses divider walls — so there is
 * no single place to stamp an ordinal.
 *
 * These classify SPATIALLY instead, the way `topAccent` and the lip corner/band
 * grid already do: given a triangle's centroid and normal, find the compartment
 * that can SEE that face. A face's normal points out of the solid, i.e. into the
 * cavity in front of it, so stepping off the face along its own normal lands in
 * exactly one compartment. That is what lets a shared divider be painted from
 * both sides — its two faces have opposite normals, so each is claimed by the
 * compartment it faces, and neither has to win.
 *
 * Nothing here runs at generation time. Colouring is a pure read-side change:
 * toggling one never invalidates a shape cache or regenerates a mesh.
 */

import type { BinParams } from '@/shared/types/bin';
import { binDimensions, cutoutInterior } from './binDimensions';
import { buildOverrideLookup, findPairAwareRuns, overrideKey } from './compartments';
import { DEFAULT_COMPARTMENT_COLOR_SCOPE } from '../types/compartments';
import type { CompartmentColorScope } from '../types/compartments';

/**
 * |normal.z| above which a face counts as floor rather than wall. A cavity
 * floor is ~±1 and a divider face ~0; a scoop's fillet sits between and reads
 * as wall, the same approximation `CUTOUT_FLOOR_NORMAL_THRESHOLD` makes.
 */
export const COMPARTMENT_FLOOR_NORMAL_THRESHOLD = 0.8;

/**
 * How far along its own normal a face's centroid is stepped to find the
 * compartment in front of it.
 *
 * For a real divider the centroid alone already answers: the wall is
 * `thickness / 2` inside its cell, so its faces are never on the boundary. The
 * step is what decides a face that lies exactly ON one — the inner face of a
 * perimeter wall, and any wall a `dividerOverride` has shifted onto a grid line
 * — where the normal is the only thing that says which side it belongs to. Kept
 * far below the smallest legal wall so it can never step past a neighbour.
 */
const PROBE_NUDGE_MM = 0.05;

/** Slack on the cavity Z band, so a floor triangle exactly on the plane counts. */
const Z_BAND_EPSILON_MM = 0.01;

export interface CompartmentColorUnit {
  readonly id: number;
  /** Undefined = uncoloured (inherits the zone it would otherwise take). */
  readonly color?: string;
  readonly colorScope: CompartmentColorScope;
}

/** One cell's mm footprint in MESH coordinates (origin at the bin centre). */
interface CompartmentCellRect {
  readonly id: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export interface CompartmentColorPlan {
  /**
   * Cells of COLOURED compartments only, each carrying its owning compartment
   * id. Per cell rather than per compartment because a compartment's cells need
   * not fill their bounding box — an L-shape would otherwise paint over its
   * neighbour's floor.
   */
  readonly cells: readonly CompartmentCellRect[];
  /** Cavity floor plane; anything below is the bin's slab or its socket. */
  readonly zMin: number;
  /** Interior ceiling; anything above is the rim and the stacking lip. */
  readonly zMax: number;
  readonly byId: ReadonlyMap<number, CompartmentColorUnit>;
}

/** One entry per compartment id, in reading order over the cell array. */
export function enumerateCompartmentColorUnits(params: BinParams): readonly CompartmentColorUnit[] {
  const { cells, compartmentColors, compartmentColorScopes } = params.compartments;
  const seen = new Set<number>();
  const units: CompartmentColorUnit[] = [];
  for (const id of cells) {
    if (seen.has(id)) continue;
    seen.add(id);
    units.push({
      id,
      color: compartmentColors?.[id] || undefined,
      colorScope: compartmentColorScopes?.[id] ?? DEFAULT_COMPARTMENT_COLOR_SCOPE,
    });
  }
  return units;
}

/** True when any compartment carries a colour — i.e. the design is multi-colour
 *  even if every `featureColors` zone still matches the body. */
export function anyCompartmentColored(params: BinParams): boolean {
  return (params.compartments.compartmentColors ?? []).some((c) => !!c);
}

/**
 * The cell rects and cavity Z band a classifier needs, or null when no
 * compartment is coloured (the overwhelmingly common case — callers skip the
 * per-triangle work entirely on null).
 */
export function planCompartmentColors(params: BinParams): CompartmentColorPlan | null {
  if (!anyCompartmentColored(params)) return null;

  const units = enumerateCompartmentColorUnits(params);
  const byId = new Map(units.filter((u) => u.color !== undefined).map((u) => [u.id, u]));
  if (byId.size === 0) return null;

  const { floorZ, wallHeight } = binDimensions(params);
  // Overhang translates the cavity inside the body, so the mesh's compartments
  // sit at `offsetX/Y` — the rects have to move with them or every probe lands
  // in the neighbouring cell on an asymmetric bin.
  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);

  const { cols, rows, cells: cellIds } = params.compartments;
  const cellW = innerW / cols;
  const cellH = innerD / rows;
  const originX = -innerW / 2 + offsetX;
  const originY = -innerD / 2 + offsetY;

  // A `dividerOverride` moves the compartment wall, so the grid line is not
  // the compartment edge (gotcha 9) — a rect left on the nominal line hands a
  // shifted strip of floor to the wrong compartment's colour, or to none.
  // Each interior boundary is walked in pair-aware runs (the same grouping
  // the wall builder and rail plan use), and a cell's edge takes the wall's
  // interpolated displacement at that cell's own midpoint along the run —
  // exact for a straight shift, and within half a cell's tilt for an angled
  // one, which is as much as an axis-aligned rect can express.
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  const boundaryShifts = (count: number, key: (i: number) => string | null): number[] => {
    const shifts = new Array<number>(count).fill(0);
    if (lookup.size === 0) return shifts;
    for (const run of findPairAwareRuns(count, key)) {
      const ov = lookup.get(run.pairKey);
      if (!ov) continue;
      const span = run.end - run.start;
      for (let i = run.start; i < run.end; i++) {
        const t = span <= 1 ? 0.5 : (i - run.start + 0.5) / span;
        shifts[i] = ov.offsetStart + (ov.offsetEnd - ov.offsetStart) * t;
      }
    }
    return shifts;
  };
  // shiftX[b][row] = displacement of the vertical boundary at column index b
  // (between col b-1 and col b) evaluated at `row`; shiftY mirrors it.
  const shiftX = new Map<number, number[]>();
  for (let b = 1; b < cols; b++) {
    shiftX.set(
      b,
      boundaryShifts(rows, (r) => {
        const left = cellIds[r * cols + (b - 1)];
        const right = cellIds[r * cols + b];
        return left === right ? null : overrideKey(Math.min(left, right), Math.max(left, right));
      })
    );
  }
  const shiftY = new Map<number, number[]>();
  for (let b = 1; b < rows; b++) {
    shiftY.set(
      b,
      boundaryShifts(cols, (c) => {
        const below = cellIds[(b - 1) * cols + c];
        const above = cellIds[b * cols + c];
        return below === above ? null : overrideKey(Math.min(below, above), Math.max(below, above));
      })
    );
  }

  const cells: CompartmentCellRect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cellIds[row * cols + col];
      if (!byId.has(id)) continue;
      cells.push({
        id,
        x0: originX + col * cellW + (shiftX.get(col)?.[row] ?? 0),
        x1: originX + (col + 1) * cellW + (shiftX.get(col + 1)?.[row] ?? 0),
        y0: originY + row * cellH + (shiftY.get(row)?.[col] ?? 0),
        y1: originY + (row + 1) * cellH + (shiftY.get(row + 1)?.[col] ?? 0),
      });
    }
  }
  if (cells.length === 0) return null;

  return {
    cells,
    zMin: floorZ - Z_BAND_EPSILON_MM,
    // `floorZ + wallHeight` IS the rim: `wallHeight` already has the socket
    // subtracted, so adding `floorZ` on top of `totalHeight` would double-count
    // it (CLAUDE.md gotcha 14).
    zMax: floorZ + wallHeight + Z_BAND_EPSILON_MM,
    byId,
  };
}

/**
 * Zones a compartment's colour is allowed to take over.
 *
 * Unlike a cutout tag — which only ever exists on cutout cavity faces and so
 * cannot reach anything else — this classification is purely spatial and would
 * happily repaint a label tab, a scoop or an engraved character that happens to
 * sit inside the compartment. Those have their own zones and their own swatches,
 * and a user who set them means them.
 *
 * `dividers` is included because the two compartment geometry paths disagree
 * about which zone a wall lands in: the multi-cavity cut leaves divider walls as
 * residue of the `BASE`-tagged body ('body'), while a fused divider carries
 * `FeatureTag.DIVIDER`. Including both is what makes the same bin paint the same
 * either way.
 */
export const COMPARTMENT_PAINTABLE_ZONES: ReadonlySet<string> = new Set(['body', 'dividers']);

export interface TriangleSample {
  /** Centroid in mesh mm. */
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  /** Unit face normal, pointing out of the solid. */
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}

/**
 * Colour a triangle should paint, or null to fall through to its normal zone.
 *
 * Null when no compartment faces it, when the face is outside the cavity's Z
 * band (the bin's underside, its rim, its lip), or when a wall face belongs to a
 * floor-only compartment.
 */
export function resolveCompartmentTriColor(
  plan: CompartmentColorPlan,
  tri: TriangleSample
): string | null {
  if (tri.cz < plan.zMin || tri.cz > plan.zMax) return null;

  const isFloor = Math.abs(tri.nz) > COMPARTMENT_FLOOR_NORMAL_THRESHOLD;

  // Step off the face into whatever is in front of it. A floor's normal is +Z,
  // so this is a pure Z step and the XY test is unchanged; a wall's is
  // horizontal, and the step is what picks its side of a shared divider.
  const px = tri.cx + tri.nx * PROBE_NUDGE_MM;
  const py = tri.cy + tri.ny * PROBE_NUDGE_MM;

  for (const cell of plan.cells) {
    if (px < cell.x0 || px > cell.x1 || py < cell.y0 || py > cell.y1) continue;
    const unit = plan.byId.get(cell.id);
    if (!unit?.color) return null;
    if (!isFloor && unit.colorScope === 'floor') return null;
    return unit.color;
  }
  return null;
}
