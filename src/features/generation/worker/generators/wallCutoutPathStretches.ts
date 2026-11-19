/**
 * How a straight divider run splits into stretches for the path cuts: where
 * the floor beside it steps, and how far each cut reaches across it.
 */

import type { BinParams } from '@/shared/types/bin';
import { interiorFilletCornerMm, narrowestCavitySpansMm } from '@/shared/utils/interiorFillet';
import type { labelTabFootprints } from '@/shared/utils/labelTabPlan';
import type { InteriorDividerSegment } from './compartmentDividerSegments';
import { COPLANAR_OVERLAP } from './generatorConstants';

const DEG = Math.PI / 180;

/**
 * Margin either side of a divider's faces, so a cut box never shares a plane
 * with them. Small, because whatever is fused to the face loses this much.
 */
const DIVIDER_FACE_CLEARANCE = 0.2;

/** How far a cut reaching for a compartment's middle stops short of it, or past it when padded. */
const MIDDLE_GAP_MM = 0.05;

/**
 * How far a cut reaches across from a divider's face into compartment `id`:
 * past the fillet rounding the corners on that face, but never past the
 * compartment's middle, where the next divider's own rounding starts. The
 * fillet planner keeps every corner at least 0.1 mm short of half the
 * compartment's narrowest span. A padded cut, which trims the fillet itself,
 * stops just past the middle and an unpadded one just short, so the two
 * share no plane.
 */
export function cutReachInto(
  params: BinParams,
  frame: { readonly innerW: number; readonly innerD: number; readonly depthPadding: number }
): (id: number | undefined) => number {
  const own = DIVIDER_FACE_CLEARANCE + interiorFilletCornerMm(params);
  const spans = narrowestCavitySpansMm(params, frame);
  return (id) => {
    const span = id === undefined ? undefined : spans.get(id);
    if (span === undefined) return own + frame.depthPadding;
    const middle = Math.max(DIVIDER_FACE_CLEARANCE, span / 2);
    const reach = Math.min(own, middle - MIDDLE_GAP_MM);
    return Math.min(reach + frame.depthPadding, Math.max(reach, middle + MIDDLE_GAP_MM));
  };
}

/** One grid cell's share of a straight divider run, and the compartment on each side. */
export interface RunCell {
  /** World extent along the run's axis. */
  readonly from: number;
  readonly to: number;
  /** Toward -X beside a run along Y, toward -Y beside one along X. */
  readonly below: number | undefined;
  readonly above: number | undefined;
}

/** The grid cells a divider runs between, in world order along its axis. */
export function cellsAlong(
  params: BinParams,
  seg: InteriorDividerSegment,
  innerW: number,
  innerD: number
): RunCell[] {
  const { cols, rows, cells } = params.compartments;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const out: RunCell[] = [];
  if (Math.abs(Math.sin(seg.rotateZ * DEG)) > 0.5) {
    const boundary = Math.round((seg.x + innerW / 2) / cellW);
    const r0 = Math.round((seg.y - seg.segLen / 2 + innerD / 2) / cellD);
    const r1 = Math.round((seg.y + seg.segLen / 2 + innerD / 2) / cellD);
    for (let row = Math.max(0, r0); row < Math.min(rows, r1); row++) {
      out.push({
        from: -innerD / 2 + row * cellD,
        to: -innerD / 2 + (row + 1) * cellD,
        below: boundary > 0 ? cells[row * cols + boundary - 1] : undefined,
        above: boundary < cols ? cells[row * cols + boundary] : undefined,
      });
    }
  } else {
    const boundary = Math.round((seg.y + innerD / 2) / cellD);
    const c0 = Math.round((seg.x - seg.segLen / 2 + innerW / 2) / cellW);
    const c1 = Math.round((seg.x + seg.segLen / 2 + innerW / 2) / cellW);
    for (let col = Math.max(0, c0); col < Math.min(cols, c1); col++) {
      out.push({
        from: -innerW / 2 + col * cellW,
        to: -innerW / 2 + (col + 1) * cellW,
        below: boundary > 0 ? cells[(boundary - 1) * cols + col] : undefined,
        above: boundary < rows ? cells[boundary * cols + col] : undefined,
      });
    }
  }
  return out;
}

/** What every cut along one bin's dividers is sized from. */
export interface CutSizing {
  readonly params: BinParams;
  readonly innerW: number;
  readonly innerD: number;
  readonly thickness: number;
  readonly binFloorZ: number;
  readonly raises: ReadonlyMap<number, number>;
  readonly tabs: ReturnType<typeof labelTabFootprints>;
  readonly tabInset: number;
  /** How far a cut reaches past a divider's face into compartment `id`. */
  readonly reachInto: (id: number | undefined) => number;
}

/** A stretch of a straight run that keeps one floor limit and one width across. */
export interface RunStretch {
  readonly uMin: number;
  readonly uMax: number;
  readonly wallAtMin: boolean;
  readonly wallAtMax: boolean;
  readonly floorZ: number;
  readonly vMin: number;
  readonly vMax: number;
}

/**
 * Where two stretches with different floors meet: this far off their grid
 * line, inside the lower one. A raised slab reaches 0.2 mm into the divider it
 * meets, so it stops on or short of the centre line of the thinnest divider
 * (0.4 mm), and the lower cut stays at least 0.1 mm clear of it.
 */
const FLOOR_STEP_OFFSET_MM = 0.1;

/**
 * A straight run split where the floor beside it changes, so a raised
 * compartment holds the cut up only along its own stretch.
 */
export function runStretches(
  sizing: CutSizing,
  seg: InteriorDividerSegment,
  runsAlongX: boolean,
  dir: { readonly x: number; readonly y: number },
  wallAtMin: boolean,
  wallAtMax: boolean
): RunStretch[] {
  const { thickness } = sizing;
  const sign = (runsAlongX ? dir.x : dir.y) >= 0 ? 1 : -1;
  const centre = runsAlongX ? seg.x : seg.y;
  // `v` is 90 deg anticlockwise of `u`: toward +Y beside a run along +X, and
  // toward -X beside one along +Y.
  const aboveIsPlusV = runsAlongX === sign > 0;
  const raiseOf = (id: number | undefined): number =>
    id === undefined ? 0 : (sizing.raises.get(id) ?? 0);
  const cells = cellsAlong(sizing.params, seg, sizing.innerW, sizing.innerD)
    .map((cell) => {
      const reachBelow = sizing.reachInto(cell.below);
      const reachAbove = sizing.reachInto(cell.above);
      // Label tabs hang from row dividers only.
      const tab = runsAlongX
        ? tabReachAcross(sizing, seg.y, cell, reachBelow, reachAbove)
        : { lo: 0, hi: 0 };
      const lo = Math.min(-(thickness / 2 + reachBelow), tab.lo);
      const hi = Math.max(thickness / 2 + reachAbove, tab.hi);
      const u0 = sign * (cell.from - centre);
      const u1 = sign * (cell.to - centre);
      return {
        uMin: Math.min(u0, u1),
        uMax: Math.max(u0, u1),
        floorZ:
          sizing.binFloorZ + Math.max(raiseOf(cell.below), raiseOf(cell.above)) + COPLANAR_OVERLAP,
        vMin: aboveIsPlusV ? lo : -hi,
        vMax: aboveIsPlusV ? hi : -lo,
        // How far an end on a junction reaches across the divider it meets.
        across: thickness / 2 + Math.max(reachBelow, reachAbove),
      };
    })
    .sort((a, b) => a.uMin - b.uMin);

  if (cells.length === 0) return [];
  const half = seg.wallLen / 2;
  const uMin = -half - (wallAtMin ? 0 : cells[0].across);
  const uMax = half + (wallAtMax ? 0 : cells[cells.length - 1].across);

  const merged = [cells[0]];
  for (const cell of cells.slice(1)) {
    const prev = merged[merged.length - 1];
    if (prev.floorZ === cell.floorZ && prev.vMin === cell.vMin && prev.vMax === cell.vMax) {
      merged[merged.length - 1] = { ...prev, uMax: cell.uMax };
    } else {
      merged.push(cell);
    }
  }
  const stepAt = (u: number, before: number, after: number): number =>
    before === after ? u : before < after ? u - FLOOR_STEP_OFFSET_MM : u + FLOOR_STEP_OFFSET_MM;
  const last = merged.length - 1;
  return merged.map((cell, i) => ({
    uMin: i > 0 ? stepAt(cell.uMin, merged[i - 1].floorZ, cell.floorZ) : uMin,
    uMax: i < last ? stepAt(cell.uMax, cell.floorZ, merged[i + 1].floorZ) : uMax,
    wallAtMin: i === 0 && wallAtMin,
    wallAtMax: i === last && wallAtMax,
    floorZ: cell.floorZ,
    vMin: cell.vMin,
    vMax: cell.vMax,
  }));
}

/**
 * How far either side of a divider along X its label tabs reach over one
 * cell, in world terms across the run (`lo` toward -Y), with the reach past
 * each tab that a cut takes into that side. A tab hangs from the divider's
 * top, so a cut that takes the divider must take the tab with it or leave the
 * tab floating.
 */
function tabReachAcross(
  sizing: CutSizing,
  y: number,
  cell: RunCell,
  reachBelow: number,
  reachAbove: number
): { lo: number; hi: number } {
  let lo = 0;
  let hi = 0;
  const reach = sizing.thickness / 2 + sizing.tabInset + 0.5;
  for (const tab of sizing.tabs) {
    if (tab.xMax <= cell.from || tab.xMin >= cell.to) continue;
    if (Math.abs(tab.yMax - y) <= reach && tab.yMin < y) {
      lo = Math.min(lo, tab.yMin - y - reachBelow);
    } else if (Math.abs(tab.yMin - y) <= reach && tab.yMax > y) {
      hi = Math.max(hi, tab.yMax - y + reachAbove);
    }
  }
  return { lo, hi };
}
