/**
 * The one grid↔perimeter frame for a custom drawer shape.
 *
 * The baseplate re-bases the resolved (padded) outline onto its socket
 * lattice. That re-base used to live only inside
 * `buildFullParams`, so the layout side gated placement against the raw
 * stored outline — for a shape whose bbox sits off the lattice the two
 * frames disagreed by up to half a cell, and the layout could allow a bin
 * on a socket the printed plate did not have. Both sides now derive the
 * same translation from this module, so a placeable layout cell and a kept
 * plate socket agree by construction.
 *
 * The stored outline is never mutated: the frame is a derived,
 * consuming-side view. On top of the automatic lattice registration the
 * user may shift the grid within the perimeter (`drawer.gridShiftX/Y`,
 *); the grid is rendered fixed on both sides, so a grid shift is
 * applied as the equal-and-opposite outline translation.
 *
 * Because the grid is what stays put, that translation can carry the
 * perimeter OUTSIDE the grid extent — and the perimeter is the plate's
 * material, not a decoration inside it. So the frame also reports the
 * `overhang` every extent-bounded consumer must widen by.
 */

import type {
  Drawer,
  DrawerOutline,
  FractionalEdge,
  OutlineOverhang,
  StoredBaseplateParams,
} from '@/core/types';
import { clamp } from './math';
import { padOutline } from './padOutline';
import { GRID_PITCH_MM_MAX, translateOutline } from './drawerOutline';
import { clampCornerCuts, cornerCutVertices, cornerCutsMatchVertices } from './cornerCutOutline';
import {
  outlineBounds,
  outlineLatticeShift,
  type OutlineLatticeAxis,
} from './drawerOutlineGeometry';

/** Keeps regenerated cuts off degenerate geometry (mirrors the generator's
 * own geometric radius clamp). */
export const CUT_GEOMETRY_MARGIN_MM = 0.1;

/** Below this the outline is treated as already lattice-registered (no
 * re-base) — well under the 0.01mm outline-hash quantum, so it only absorbs
 * float noise, never a real pen auto-grow drift. */
const RECENTER_EPS_MM = 1e-6;

/** Keeps a whole cell from being lost to float noise in `spanMm / pitchMm`. */
const CELL_COUNT_EPS = 1e-9;

/** Every input the frame depends on. Spans are the unpadded grid extent
 * (`width × gridUnitMm`); paddings are the stored per-side values — whether
 * they actually apply is shape-dependent and resolved here. */
export interface OutlineFrameParams {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  readonly fractionalEdgeX: FractionalEdge;
  readonly fractionalEdgeY: FractionalEdge;
  readonly gridShiftX: number;
  readonly gridShiftY: number;
}

export const NO_OUTLINE_OVERHANG: OutlineOverhang = {
  left: 0,
  right: 0,
  front: 0,
  back: 0,
};

export function hasOutlineOverhang(o: OutlineOverhang | undefined): boolean {
  return o !== undefined && (o.left > 0 || o.right > 0 || o.front > 0 || o.back > 0);
}

export interface ResolvedOutlineFrame {
  /** Plate-local padded outline, before the frame translation. */
  readonly outline: DrawerOutline;
  /** False when the paddings would fold the loop (shape subsumes padding). */
  readonly paddingOn: boolean;
  /** Translation to apply to `outline` (plate) or to the raw outline in
   * drawer space (layout): lattice registration minus the manual grid
   * shift. Exactly 0 per axis when below {@link RECENTER_EPS_MM}. */
  readonly shiftX: number;
  readonly shiftY: number;
  /** How far the manual grid shift may reach on each axis — see
   * {@link manualShiftLimit}. The steppers and the command bound themselves by
   * these, so what the UI offers is what the frame applies. */
  readonly shiftLimitX: number;
  readonly shiftLimitY: number;
  /**
   * How far the translated outline reaches past the padded grid extent, per
   * side.
   *
   * The grid is rendered fixed and the perimeter carries the frame
   * translation, so a shift toward an edge the shape already touches pushes
   * the perimeter outside `[0, extent]`. The perimeter is the plate's
   * material, so every consumer that bounds material by the grid extent —
   * the generator's slab (the outline is intersected against it), the split
   * planner's piece windows, the layout overlay's canvas — must widen by
   * this, or that strip is silently cut off. Zero on every axis for a
   * registered, unshifted, in-extent shape.
   */
  readonly overhang: OutlineOverhang;
}

/**
 * The whole-cell socket lattice of one plate axis. A 'start' fractional edge
 * puts the half cell FIRST (cellDecomposition reverses the cell array), so the
 * whole-cell lattice begins after it.
 */
function latticeAxis(
  spanMm: number,
  pitchMm: number,
  padLeadMm: number,
  padTrailMm: number,
  fractionalEdge: FractionalEdge
): OutlineLatticeAxis {
  const wholeCells = Math.floor(spanMm / pitchMm + CELL_COUNT_EPS);
  const fractionalMm = spanMm - wholeCells * pitchMm;
  return {
    extentMm: spanMm + padLeadMm + padTrailMm,
    originMm: padLeadMm + (fractionalEdge === 'start' ? fractionalMm : 0),
    pitchMm,
    wholeCells,
  };
}

/**
 * Resolved padded outline (plate-local, spanning the padded extent) plus the
 * padding it permits. Corner-cut drawer shapes re-inscribe their cuts on the
 * padded rectangle; every other shape offsets its edges outward
 * (`padOutline`). Either way padding composes, unless it would fold the loop
 * (then it's functionally zeroed, stored values untouched).
 */
function resolvePaddedOutline(
  drawerOutline: DrawerOutline,
  p: OutlineFrameParams
): { outline: DrawerOutline; paddingOn: boolean } {
  // The authoring echo is a round-trip hint, never trusted blindly: only
  // regenerate from it when it provably reproduces the stored vertices.
  const cuts =
    drawerOutline.authoring?.kind === 'corners' ? drawerOutline.authoring.corners : undefined;
  const cornerShaped =
    cuts !== undefined &&
    cornerCutsMatchVertices(drawerOutline.vertices, p.widthMm, p.depthMm, cuts);
  if (!cornerShaped) {
    const padded = padOutline(drawerOutline, {
      left: p.paddingLeft,
      right: p.paddingRight,
      front: p.paddingFront,
      back: p.paddingBack,
    });
    return padded !== null
      ? { outline: padded, paddingOn: true }
      : { outline: drawerOutline, paddingOn: false };
  }

  const totalW = p.widthMm + p.paddingLeft + p.paddingRight;
  const totalD = p.depthMm + p.paddingFront + p.paddingBack;
  if (totalW === p.widthMm && totalD === p.depthMm) {
    // Zero padding: the stored outline IS the padded outline — reuse it so
    // the cache identity stays byte-stable.
    return { outline: drawerOutline, paddingOn: true };
  }
  return {
    outline: {
      vertices: cornerCutVertices(
        totalW,
        totalD,
        clampCornerCuts(cuts, totalW, totalD, CUT_GEOMETRY_MARGIN_MM)
      ),
      authoring: drawerOutline.authoring,
    },
    paddingOn: true,
  };
}

/**
 * How far the manual grid shift may move the lattice on one axis, in mm.
 *
 * Half a pitch spans every distinct grid position while the lattice fills its
 * extent — past that is the same registration relabelled, which is why the
 * bound was a flat ±pitch/2. It stops spanning them once the perimeter is
 * OVERSIZE: the lattice then has real room to slide inside the material, and
 * half a pitch could not reach the edges of a drawer with 49mm of slack against
 * a 42mm pitch, so corner alignment was unreachable.
 *
 * Half the slack is exactly the reach from the centred registration to either
 * edge, so the wider of the two bounds covers both cases and leaves every
 * non-oversize shape's range untouched. Capped at the static bound the
 * `drawer.update` payload schema enforces, so the steppers can never offer a
 * value the command would reject.
 */
function manualShiftLimit(spanMm: number, extentMm: number, pitchMm: number): number {
  const slack = Math.max(0, spanMm - extentMm);
  return Math.min(GRID_PITCH_MM_MAX / 2, Math.max(pitchMm / 2, slack / 2));
}

/**
 * Resolve the padded outline and the frame translation both sides consume.
 *
 * The registration is lattice-registered, never raw bbox centring: a
 * sub-cell shift breaks whole-cell registration and cost the reporter
 * an entire row and column of sockets. Zero-shift outlines (corner-cut /
 * radius / registered freeform, no manual shift) keep their exact vertices,
 * so square and full-extent plates stay cache-stable.
 */
export function resolveOutlineFrame(
  drawerOutline: DrawerOutline,
  p: OutlineFrameParams
): ResolvedOutlineFrame {
  const resolved = resolvePaddedOutline(drawerOutline, p);
  const padL = resolved.paddingOn ? p.paddingLeft : 0;
  const padR = resolved.paddingOn ? p.paddingRight : 0;
  const padF = resolved.paddingOn ? p.paddingFront : 0;
  const padB = resolved.paddingOn ? p.paddingBack : 0;
  const registration = outlineLatticeShift(resolved.outline, {
    x: latticeAxis(p.widthMm, p.gridUnitMm, padL, padR, p.fractionalEdgeX),
    y: latticeAxis(p.depthMm, p.gridUnitMmY, padF, padB, p.fractionalEdgeY),
  });
  // The clamp also defuses out-of-range values that bypassed the command layer
  // (imported or hand-edited layouts).
  const bounds = outlineBounds(resolved.outline);
  const shiftLimitX = manualShiftLimit(
    bounds.maxX - bounds.minX,
    p.widthMm + padL + padR,
    p.gridUnitMm
  );
  const shiftLimitY = manualShiftLimit(
    bounds.maxY - bounds.minY,
    p.depthMm + padF + padB,
    p.gridUnitMmY
  );
  const manualX = clamp(p.gridShiftX, -shiftLimitX, shiftLimitX);
  const manualY = clamp(p.gridShiftY, -shiftLimitY, shiftLimitY);
  const rawShiftX = registration.x - manualX;
  const rawShiftY = registration.y - manualY;
  const shiftX = Math.abs(rawShiftX) < RECENTER_EPS_MM ? 0 : rawShiftX;
  const shiftY = Math.abs(rawShiftY) < RECENTER_EPS_MM ? 0 : rawShiftY;
  return {
    outline: resolved.outline,
    paddingOn: resolved.paddingOn,
    shiftX,
    shiftY,
    shiftLimitX,
    shiftLimitY,
    overhang: measureOverhang(
      resolved.outline,
      shiftX,
      shiftY,
      p.widthMm + padL + padR,
      p.depthMm + padF + padB
    ),
  };
}

/**
 * Per-side reach of the translated outline past `[0, extentW] × [0, extentD]`.
 * Measured on the flattened path (via `outlineBounds`), so a corner arc that
 * bows past its own endpoints is included. Sub-epsilon reach is dropped so a
 * registered shape stays exactly zero and consumers keep their byte-stable
 * fast paths.
 */
function measureOverhang(
  outline: DrawerOutline,
  shiftX: number,
  shiftY: number,
  extentW: number,
  extentD: number
): OutlineOverhang {
  const b = outlineBounds(outline);
  const past = (v: number): number => (v > RECENTER_EPS_MM ? v : 0);
  return {
    left: past(-(b.minX + shiftX)),
    right: past(b.maxX + shiftX - extentW),
    front: past(-(b.minY + shiftY)),
    back: past(b.maxY + shiftY - extentD),
  };
}

type FrameDrawer = Pick<
  Drawer,
  | 'width'
  | 'depth'
  | 'outline'
  | 'fractionalEdgeX'
  | 'fractionalEdgeY'
  | 'gridShiftX'
  | 'gridShiftY'
>;

const ZERO_SHIFT = { x: 0, y: 0 } as const;

/** Outer footprint of the plate, in mm. */
export interface PlateExtentMm {
  readonly widthMm: number;
  readonly depthMm: number;
}

interface CachedFrame {
  readonly x: number;
  readonly y: number;
  readonly overhang: OutlineOverhang;
  readonly extent: PlateExtentMm;
  readonly shiftLimitX: number;
  readonly shiftLimitY: number;
}

const shiftCache = new WeakMap<DrawerOutline, Map<string, CachedFrame>>();
const outlineCache = new WeakMap<DrawerOutline, Map<string, DrawerOutline>>();

/**
 * Frame translation for the raw outline in drawer-local grid space — what
 * the layout's hatching, placement gating, displacement and overlay apply so
 * they agree with the plate's kept-socket set. Zero when there is no custom
 * shape, and when the plate does not sync with the layout (the outline never
 * reaches the plate, so there is no plate frame to agree with).
 */
export function drawerFrameShift(
  drawer: FrameDrawer,
  baseplateParams: StoredBaseplateParams | undefined,
  gridUnitMm: number,
  gridUnitMmY: number = gridUnitMm
): { readonly x: number; readonly y: number } {
  return frameFor(drawer, baseplateParams, gridUnitMm, gridUnitMmY) ?? ZERO_SHIFT;
}

/**
 * How far the framed shape reaches past the padded grid extent, per side in mm
 * — the layout counterpart of the plate's slab widening.
 *
 * The grid renders fixed and the shape carries the frame translation, so a
 * shift toward an edge the shape already touches draws it outside the grid
 * box. The overlay's own canvas grows to match, but it can only grow into
 * space the layout reserved: the grid sits in a scroll container, and content
 * placed at a negative offset is not reachable by scrolling — it is simply
 * clipped. Callers reserve this much gutter so the shape stays on screen.
 */
export function drawerFrameOverhang(
  drawer: FrameDrawer,
  baseplateParams: StoredBaseplateParams | undefined,
  gridUnitMm: number,
  gridUnitMmY: number = gridUnitMm
): OutlineOverhang {
  return (
    frameFor(drawer, baseplateParams, gridUnitMm, gridUnitMmY)?.overhang ?? NO_OUTLINE_OVERHANG
  );
}

/**
 * Outer footprint of a plate whose grid comes from a shaped drawer, in mm.
 *
 * The generator widens its slab by the overhang precisely so the slab contains
 * the framed perimeter, then intersects the two — so the perimeter's own bounds
 * ARE the material, whether the shape reaches past the padded grid extent (a
 * drawer measured wider than the cells it was given) or falls short of it.
 * Reporting `width × gridUnitMm + padding` instead described the lattice rather
 * than the plate, and a 21-cell grid in a 931mm drawer read as 882mm.
 *
 * `undefined` when no shape reaches the plate, leaving the padded grid extent
 * as the footprint.
 */
export function drawerFrameExtent(
  drawer: FrameDrawer,
  baseplateParams: StoredBaseplateParams | undefined,
  gridUnitMm: number,
  gridUnitMmY: number = gridUnitMm
): PlateExtentMm | undefined {
  return frameFor(drawer, baseplateParams, gridUnitMm, gridUnitMmY)?.extent;
}

/**
 * How far the manual grid shift may reach on each axis, in mm.
 *
 * The steppers, the `drawer.update` clamp and the frame itself all bound
 * themselves by this one answer, so the UI cannot offer a position the command
 * refuses to store or the frame declines to apply. Falls back to ±half pitch
 * when no shape reaches the plate — there is nothing to slide inside then.
 */
export function drawerFrameShiftLimits(
  drawer: FrameDrawer,
  baseplateParams: StoredBaseplateParams | undefined,
  gridUnitMm: number,
  gridUnitMmY: number = gridUnitMm
): { readonly x: number; readonly y: number } {
  const frame = frameFor(drawer, baseplateParams, gridUnitMm, gridUnitMmY);
  return frame === undefined
    ? { x: gridUnitMm / 2, y: gridUnitMmY / 2 }
    : { x: frame.shiftLimitX, y: frame.shiftLimitY };
}

/** Resolved frame for a synced custom shape, memoized per outline + inputs.
 * `undefined` when there is no shared frame to speak of. */
function frameFor(
  drawer: FrameDrawer,
  baseplateParams: StoredBaseplateParams | undefined,
  gridUnitMm: number,
  gridUnitMmY: number
): CachedFrame | undefined {
  const outline = drawer.outline;
  if (outline === undefined) return undefined;
  if (baseplateParams?.syncWithLayout === false) return undefined;
  const p: OutlineFrameParams = {
    widthMm: (drawer.width as number) * gridUnitMm,
    depthMm: (drawer.depth as number) * gridUnitMmY,
    gridUnitMm,
    gridUnitMmY,
    paddingLeft: baseplateParams?.paddingLeft ?? 0,
    paddingRight: baseplateParams?.paddingRight ?? 0,
    paddingFront: baseplateParams?.paddingFront ?? 0,
    paddingBack: baseplateParams?.paddingBack ?? 0,
    fractionalEdgeX: drawer.fractionalEdgeX ?? 'end',
    fractionalEdgeY: drawer.fractionalEdgeY ?? 'end',
    gridShiftX: drawer.gridShiftX ?? 0,
    gridShiftY: drawer.gridShiftY ?? 0,
  };
  const key = [
    p.widthMm,
    p.depthMm,
    p.gridUnitMm,
    p.gridUnitMmY,
    p.paddingLeft,
    p.paddingRight,
    p.paddingFront,
    p.paddingBack,
    p.fractionalEdgeX,
    p.fractionalEdgeY,
    p.gridShiftX,
    p.gridShiftY,
  ].join(',');
  let byInputs = shiftCache.get(outline);
  if (byInputs === undefined) {
    byInputs = new Map();
    shiftCache.set(outline, byInputs);
  }
  const cached = byInputs.get(key);
  if (cached !== undefined) return cached;
  const frame = resolveOutlineFrame(outline, p);
  // Bounds of the pre-translation outline: the frame translation moves the
  // perimeter without resizing it, so the untranslated span is the footprint.
  const b = outlineBounds(frame.outline);
  const resolved: CachedFrame = {
    x: frame.shiftX,
    y: frame.shiftY,
    overhang: frame.overhang,
    extent: { widthMm: b.maxX - b.minX, depthMm: b.maxY - b.minY },
    shiftLimitX: frame.shiftLimitX,
    shiftLimitY: frame.shiftLimitY,
  };
  byInputs.set(key, resolved);
  return resolved;
}

/**
 * The raw outline translated into the shared frame, memoized per raw
 * outline + shift so consumers keyed on outline reference (cell-set memo,
 * React deps) stay stable. Returns the raw outline itself on a zero shift.
 */
export function drawerFrameOutline(
  drawer: FrameDrawer,
  baseplateParams: StoredBaseplateParams | undefined,
  gridUnitMm: number,
  gridUnitMmY: number = gridUnitMm
): DrawerOutline | undefined {
  const outline = drawer.outline;
  if (outline === undefined) return undefined;
  const shift = drawerFrameShift(drawer, baseplateParams, gridUnitMm, gridUnitMmY);
  if (shift.x === 0 && shift.y === 0) return outline;
  const key = `${shift.x},${shift.y}`;
  let byShift = outlineCache.get(outline);
  if (byShift === undefined) {
    byShift = new Map();
    outlineCache.set(outline, byShift);
  }
  const cached = byShift.get(key);
  if (cached !== undefined) return cached;
  const translated = translateOutline(outline, shift.x, shift.y);
  byShift.set(key, translated);
  return translated;
}
