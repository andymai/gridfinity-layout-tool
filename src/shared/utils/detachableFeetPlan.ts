/**
 * Where a detachable-feet bin's feet go, as one pure plan.
 *
 * Four layers consume this and none of them may re-derive it: the worker that
 * builds the feet, the worker that cuts their pin holes through the bin floor,
 * the print estimate that counts them, and the panel that reports the saving.
 * A second copy of the placement rule is a second chance for the holes and the
 * pins to disagree, which is not visible in any mesh assertion — both solids
 * would be perfectly valid and simply not fit together.
 *
 * Pure by construction (no brepjs, no worker imports) for the same reason
 * `labelTabPlan` and `dividerRailPlan` are: two of its consumers cannot import
 * the kernel at all.
 *
 * ## The rule
 *
 * A foot has to land inside ONE baseplate pocket, so feet anchor to the
 * outermost WHOLE grid cells rather than to the bin's outline. On an on-grid
 * bin those coincide; on a half-offset bin the outline falls mid-pocket and the
 * anchor does not move with it. That is what lets one foot shape serve every
 * placement, and it absorbs fractional bins for free, since a partial edge cell
 * is simply not a candidate anchor.
 *
 * Along each axis the feet sit at `stations`:
 *  - an axis with two or more whole cells gets a station at each end, plus
 *    interior stations until no unsupported run of floor exceeds
 *    {@link MAX_FOOT_SPAN_MM},
 *  - an axis with a single whole cell gets ONE station that SPANS it, which is
 *    what turns a 1-wide bin's feet into bars: four separate corner feet
 *    on a 42mm-wide bin put both pin groups near its centreline, and it pivots.
 *
 * A foot is then the product of one station per axis, kept only where it
 * reaches an outer edge on at least one axis (`dirX` or `dirY` non-zero). A
 * station pair that is interior on both axes would put a foot under the middle
 * of the floor, where there is no wall to carry load into it.
 */

import {
  DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
  MAX_FOOT_SPAN_MM,
  type FootLattice,
} from '@/features/bin-designer/types';
import { isFractional } from '@/core/constants';
import { magnetInsetFromCellEdgeMm } from '@/shared/printSettings/gridfinityGeometry';

/**
 * Solid margin around anything embedded in a foot (mm) — a magnet pocket or a
 * pin. Matches the margin the lightweight base already leaves around a retained
 * magnet pad, so a detachable foot is no thinner-walled than an integral one.
 */
export const FOOT_EMBED_MARGIN_MM = 1.2;

/**
 * `L` hugs a cell corner; `bar` spans one axis of a cell at one edge.
 *
 * A bar's plan outline is a rounded rectangle, not a U: it runs the full cell,
 * so it picks up the socket profile's taper on the edge it sits against and on
 * both ends at once.
 */
export type FootShape = 'L' | 'bar';

/**
 * One foot's placement, in bin-centred mm.
 *
 * `dirX`/`dirY` are the outward direction on each axis: `-1`/`+1` when the foot
 * reaches that edge, `0` when it spans that axis instead. Exactly one of them
 * is `0` on a `bar`; neither is on an `L`.
 */
export interface FootPlacement {
  readonly shape: FootShape;
  /** Anchor point: the cell corner an `L` hugs, or the edge midpoint a `bar` spans. */
  readonly x: number;
  readonly y: number;
  readonly dirX: -1 | 0 | 1;
  readonly dirY: -1 | 0 | 1;
  /** Full extent of the cell this foot sits in (mm), for the spanned axis. */
  readonly cellW: number;
  readonly cellD: number;
}

/** One axis's foot stations, resolved before the two axes are crossed. */
interface Station {
  /** Position along the axis, in bin-centred mm. */
  readonly pos: number;
  /** Outward direction, or 0 when this station spans its cell. */
  readonly dir: -1 | 0 | 1;
  /** The run this station occupies along the axis, in bin-centred mm. */
  readonly from: number;
  readonly to: number;
  /**
   * True only for a span filler — a station added to shorten a run, reaching
   * neither end of the axis. A single-cell span station also carries `dir: 0`
   * but is NOT interior: it reaches both ends at once. Conflating the two drops
   * every span filler on a 1-wide bin, because both of its axes read as `dir 0`
   * and the cross-product filter throws the pair away.
   */
  readonly interior: boolean;
}

export interface DetachableFeetInput {
  /** Bin size in grid units; may be fractional. */
  readonly widthUnits: number;
  readonly depthUnits: number;
  readonly pitchX: number;
  readonly pitchY: number;
  /** Which end a fractional remainder sits on, per axis. */
  readonly fractionalEdgeX: 'start' | 'end';
  readonly fractionalEdgeY: 'start' | 'end';
  /**
   * Where this axis's feet fall relative to the PLATE's cells, per axis.
   *
   * Anchoring to the bin's own whole cells is not enough on its own: half-bin
   * mode places a bin half a unit off-grid, and then every one of its cells
   * straddles two pockets, so a foot on any of them lands on a ridge. `half`
   * shifts the anchors half a unit so they line up with the pockets instead —
   * the same question `footLatticeX/Y` answers for integral feet, and the same
   * answer, except that no half-size foot is needed here: a full L simply sits
   * half a unit inboard of the bin's edge.
   */
  readonly latticeX: FootLattice;
  readonly latticeY: FootLattice;
  /** Arm reach of a foot along an edge (mm) — see {@link footArmMm}. */
  readonly armMm: number;
}

/**
 * How deep a foot has to be, inward from its outer faces (mm).
 *
 * Derived from what the foot must contain rather than chosen, so a smaller
 * magnet or a different pin size moves it correctly and no constant can be set
 * to a value that clips the magnet it exists to hold. The magnet term dominates
 * at spec pitch (8 + 3.25 + 1.2 = 12.45mm against 7.4mm for a 5mm pin).
 *
 * `magnetInsetFromEdgeMm` is supplied rather than computed because the magnet
 * placement rule is not this module's to restate: the inset is only the
 * familiar 8mm at 42mm pitch, and a cell smaller than that pulls the magnet
 * toward its own edge instead. Callers pass what the placement actually
 * resolved to.
 */
export function footArmMm(opts: {
  readonly pinDiameterMm: number;
  readonly magnetDiameterMm?: number;
  readonly magnetInsetFromEdgeMm?: number;
}): number {
  const pinReach = opts.pinDiameterMm + 2 * FOOT_EMBED_MARGIN_MM;
  const magnetReach =
    opts.magnetDiameterMm === undefined || opts.magnetInsetFromEdgeMm === undefined
      ? 0
      : opts.magnetInsetFromEdgeMm + opts.magnetDiameterMm / 2 + FOOT_EMBED_MARGIN_MM;
  return Math.max(pinReach, magnetReach);
}

/**
 * How many whole cells an axis has available for anchoring.
 *
 * A fractional remainder is never an anchor: it is a clipped edge foot that may
 * not even exist (the socket walk drops sub-threshold slivers), so hanging a
 * foot off it would be hanging it off geometry that is not always there. Which
 * END the remainder sits on shifts where the whole cells START, never how many
 * there are, and {@link cellCentre} is what applies that shift.
 */
function wholeCellCount(units: number): number {
  return Math.floor(units + 1e-9);
}

/**
 * Centre of anchorable cell `index` along an axis, in bin-centred mm.
 *
 * `anchorOffsetUnits` is the half-unit shift a `half` lattice applies, which
 * moves the whole anchor grid off the bin's own cells and onto the plate's.
 */
function cellCentre(
  index: number,
  units: number,
  pitch: number,
  edge: 'start' | 'end',
  anchorOffsetUnits: number
): number {
  const originUnits = edge === 'start' ? units - Math.floor(units + 1e-9) : 0;
  return (originUnits + anchorOffsetUnits + index + 0.5) * pitch - (units * pitch) / 2;
}

/**
 * The half-unit shift a lattice asks for, per axis.
 *
 * A fractional axis ignores `half` for the reason the integral lattice does:
 * it already carries a half cell, and `fractionalEdge` decides which end it
 * sits on, which covers both placements on its own.
 */
function anchorOffsetUnits(lattice: FootLattice, units: number): number {
  return lattice === 'half' && !isFractional(units) ? 0.5 : 0;
}

/** Anchorable whole cells on an axis, after the lattice shift. */
function anchorableCells(units: number, offset: number): number {
  return wholeCellCount(units - 2 * offset);
}

/**
 * Foot stations along one axis.
 *
 * Interior stations are added greedily into whichever unsupported run is
 * currently the longest, which converges on the fewest feet that satisfy the
 * limit. The run measured is EDGE to EDGE — the free span of floor between two
 * feet — not centre to centre, because that is the distance the floor actually
 * has to carry. Centre-to-centre would demand a second interior foot on a 6x3
 * for no structural reason.
 */
function axisStations(
  units: number,
  pitch: number,
  edge: 'start' | 'end',
  armMm: number,
  spanSingleCell: boolean,
  offset: number
): Station[] {
  const count = anchorableCells(units, offset);
  const centre = (i: number): number => cellCentre(i, units, pitch, edge, offset);

  if (count <= 1 && spanSingleCell) {
    const c = centre(0);
    return [{ pos: c, dir: 0, from: c - pitch / 2, to: c + pitch / 2, interior: false }];
  }

  const lo = centre(0) - pitch / 2;
  const hi = centre(count - 1) + pitch / 2;
  const stations: Station[] = [
    { pos: lo, dir: -1, from: lo, to: lo + armMm, interior: false },
    { pos: hi, dir: 1, from: hi - armMm, to: hi, interior: false },
  ];

  // Cells that could host an interior station, nearest-to-a-gap-midpoint first.
  const interiorCells: number[] = [];
  for (let i = 1; i < count - 1; i++) interiorCells.push(i);

  while (interiorCells.length > 0) {
    const sorted = [...stations].sort((a, b) => a.from - b.from);
    let worst = { gap: 0, mid: 0 };
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].from - sorted[i - 1].to;
      if (gap > worst.gap) worst = { gap, mid: (sorted[i].from + sorted[i - 1].to) / 2 };
    }
    if (worst.gap <= MAX_FOOT_SPAN_MM) break;

    let bestIdx = 0;
    let bestDist = Infinity;
    interiorCells.forEach((cellIndex, idx) => {
      const dist = Math.abs(centre(cellIndex) - worst.mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    const cellIndex = interiorCells.splice(bestIdx, 1)[0];
    const c = centre(cellIndex);
    stations.push({ pos: c, dir: 0, from: c - pitch / 2, to: c + pitch / 2, interior: true });
  }

  return stations.sort((a, b) => a.pos - b.pos);
}

/**
 * The feet a bin gets, in bin-centred mm.
 *
 * Empty only for a bin with no whole cell on an axis, which cannot carry a foot
 * at all; callers treat that as "detachable feet unavailable" rather than as a
 * bin with nothing under it.
 */
export function detachableFeetPlacements(input: DetachableFeetInput): FootPlacement[] {
  const { widthUnits, depthUnits, pitchX, pitchY, armMm } = input;
  const offsetX = anchorOffsetUnits(input.latticeX, widthUnits);
  const offsetY = anchorOffsetUnits(input.latticeY, depthUnits);
  const cellsX = anchorableCells(widthUnits, offsetX);
  const cellsY = anchorableCells(depthUnits, offsetY);
  // No pocket-aligned whole cell on an axis, so no full-size foot can land
  // inside one pocket there. Reachable for a 1-wide bin under the `half`
  // lattice, which genuinely has nowhere to put one; callers report the mode as
  // unavailable rather than placing feet that would perch on a ridge.
  if (cellsX < 1 || cellsY < 1) return [];

  const singleX = cellsX <= 1;
  const singleY = cellsY <= 1;
  // Both axes single (a 1x1) would collapse to one station pair and therefore
  // one foot, which holds nothing. Span X and keep Y's two ends, giving the
  // pair of U feet a narrow bin wants anyway.
  const spanX = singleX;
  const spanY = singleY && !singleX;

  const xs = axisStations(widthUnits, pitchX, input.fractionalEdgeX, armMm, spanX, offsetX);
  const ys = axisStations(depthUnits, pitchY, input.fractionalEdgeY, armMm, spanY, offsetY);

  const feet: FootPlacement[] = [];
  for (const sx of xs) {
    for (const sy of ys) {
      // A span filler on both axes lands under the middle of the floor, with no
      // wall above to carry load into it.
      if (sx.interior && sy.interior) continue;
      feet.push({
        shape: sx.dir === 0 || sy.dir === 0 ? 'bar' : 'L',
        x: sx.pos,
        y: sy.pos,
        dirX: sx.dir,
        dirY: sy.dir,
        cellW: pitchX,
        cellD: pitchY,
      });
    }
  }
  return feet;
}

/**
 * The centre of the cell a foot sits in, in bin-centred mm.
 *
 * A foot's own local origin is its cell centre, not its anchor, so this is what
 * turns an assembled placement back into a part at the origin — which is what
 * laying the feet out on a print plate needs.
 */
export function footCellCentre(p: FootPlacement): { x: number; y: number } {
  return { x: p.x - (p.dirX * p.cellW) / 2, y: p.y - (p.dirY * p.cellD) / 2 };
}

/**
 * Pin positions for one foot, in bin-centred mm.
 *
 * Three pins on an `L` (one in the elbow, one out along each arm) and four on a
 * `bar` (one at each end, on both sides of its width): three is the
 * fewest that constrains a corner against rotation, and a bar needs two at each
 * end for the same reason. The bin's hole cutter and the foot builder both read
 * this, so the two cannot drift.
 */
export function footPinPositions(
  foot: FootPlacement,
  armMm: number,
  pinDiameterMm: number
): Array<{ x: number; y: number }> {
  // Pins centred across the arm, and the outer pin held a full margin in from
  // the arm's end so it is never cut by the foot's own outer profile.
  const across = armMm / 2;
  const along = armMm + pinDiameterMm / 2 + FOOT_EMBED_MARGIN_MM;

  if (foot.shape === 'L') {
    const ix = foot.x - foot.dirX * across;
    const iy = foot.y - foot.dirY * across;
    return [
      { x: ix, y: iy },
      { x: foot.x - foot.dirX * along, y: iy },
      { x: ix, y: foot.y - foot.dirY * along },
    ];
  }

  // A bar spans whichever axis has dir 0, running the full cell.
  const spansX = foot.dirX === 0;
  const halfSpan = (spansX ? foot.cellW : foot.cellD) / 2 - armMm / 2;
  const inset = spansX ? foot.y - foot.dirY * across : foot.x - foot.dirX * across;
  const outer = spansX ? foot.y - foot.dirY * along : foot.x - foot.dirX * along;

  return spansX
    ? [
        { x: foot.x - halfSpan, y: inset },
        { x: foot.x + halfSpan, y: inset },
        { x: foot.x - halfSpan, y: outer },
        { x: foot.x + halfSpan, y: outer },
      ]
    : [
        { x: inset, y: foot.y - halfSpan },
        { x: inset, y: foot.y + halfSpan },
        { x: outer, y: foot.y - halfSpan },
        { x: outer, y: foot.y + halfSpan },
      ];
}

/**
 * Everything a consumer needs to place, build, count or cost the feet, resolved
 * from the bin's own params.
 *
 * One entry point on purpose. The shell stage cuts the pin holes, the parts
 * generator builds the feet, the estimate counts them and the panel reports the
 * saving — four callers, and any of them resolving the arm or the pin size
 * differently is a foot that does not match its own holes.
 */
export interface ResolvedDetachableFeet {
  readonly placements: readonly FootPlacement[];
  readonly armMm: number;
  readonly pinDiameterMm: number;
  /** Magnet pocket dimensions and positions, or `undefined` for plain feet. */
  readonly magnet?: {
    readonly diameterMm: number;
    readonly depthMm: number;
    /**
     * Every STANDARD corner position the feet could cover, in bin-centred mm.
     * The builder keeps the ones a given foot's footprint actually contains.
     *
     * These are the spec positions, not somewhere convenient inside the foot:
     * the whole point of a magnet in the foot is that it lands on the magnet in
     * the baseplate pocket beneath it, so an offset derived from the foot's own
     * dimensions would mate with nothing.
     */
    readonly positions: ReadonlyArray<readonly [number, number]>;
  };
}

/** The subset of `BinParams` the feet depend on. */
export interface DetachableFeetParams {
  readonly width: number;
  readonly depth: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY?: number;
  readonly fractionalEdgeX: 'start' | 'end';
  readonly fractionalEdgeY: 'start' | 'end';
  readonly magnetAnchor?: 'edge' | 'center';
  readonly base: {
    readonly style: string;
    readonly magnetDiameter: number;
    readonly magnetDepth: number;
    readonly feetPinDiameter?: number;
    readonly footLatticeX?: FootLattice;
    readonly footLatticeY?: FootLattice;
  };
}

export function resolveDetachableFeet(params: DetachableFeetParams): ResolvedDetachableFeet {
  const pitchX = params.gridUnitMm;
  const pitchY = params.gridUnitMmY ?? params.gridUnitMm;
  const pinDiameterMm = params.base.feetPinDiameter ?? DEFAULT_DETACHABLE_PIN_DIAMETER_MM;
  const carriesMagnet = params.base.style === 'magnet' || params.base.style === 'magnet_and_screw';

  // The arm is sized against the SHORTER pitch: a foot deep enough for the
  // magnet on one axis is not automatically deep enough on the other, and a
  // single arm value serves both.
  const magnetInsetFromEdgeMm = carriesMagnet
    ? Math.min(
        magnetInsetFromCellEdgeMm(pitchX, params.magnetAnchor ?? 'edge'),
        magnetInsetFromCellEdgeMm(pitchY, params.magnetAnchor ?? 'edge')
      )
    : undefined;

  const armMm = footArmMm({
    pinDiameterMm,
    magnetDiameterMm: carriesMagnet ? params.base.magnetDiameter : undefined,
    magnetInsetFromEdgeMm,
  });

  const placements = detachableFeetPlacements({
    widthUnits: params.width,
    depthUnits: params.depth,
    pitchX,
    pitchY,
    fractionalEdgeX: params.fractionalEdgeX,
    fractionalEdgeY: params.fractionalEdgeY,
    latticeX: params.base.footLatticeX ?? 'grid',
    latticeY: params.base.footLatticeY ?? 'grid',
    armMm,
  });

  return {
    placements,
    armMm,
    pinDiameterMm,
    magnet: carriesMagnet
      ? {
          diameterMm: params.base.magnetDiameter,
          depthMm: params.base.magnetDepth,
          positions: standardMagnetCorners(placements, pitchX, pitchY, params.magnetAnchor),
        }
      : undefined,
  };
}

/**
 * The four spec magnet positions of every cell a foot sits in, deduplicated.
 *
 * Offsets come from the same inset the magnet placement resolves to, so a foot
 * carrying one lines up with the pocket magnet under it. A candidate list, not
 * a final one: the builder drops the corners a given foot does not cover.
 */
function standardMagnetCorners(
  placements: readonly FootPlacement[],
  pitchX: number,
  pitchY: number,
  anchor: 'edge' | 'center' = 'edge'
): Array<readonly [number, number]> {
  const offX = pitchX / 2 - magnetInsetFromCellEdgeMm(pitchX, anchor);
  const offY = pitchY / 2 - magnetInsetFromCellEdgeMm(pitchY, anchor);
  const seen = new Set<string>();
  const out: Array<readonly [number, number]> = [];
  for (const p of placements) {
    const centre = footCellCentre(p);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = centre.x + sx * offX;
        const y = centre.y + sy * offY;
        const key = `${x.toFixed(4)},${y.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([x, y]);
      }
    }
  }
  return out;
}
