/**
 * The one grid↔perimeter frame for a custom drawer shape (#3157).
 *
 * The baseplate re-bases the resolved (padded) outline onto its socket
 * lattice (#3108/#3109/#3149). That re-base used to live only inside
 * `buildFullParams`, so the layout side gated placement against the raw
 * stored outline — for a shape whose bbox sits off the lattice the two
 * frames disagreed by up to half a cell, and the layout could allow a bin
 * on a socket the printed plate did not have. Both sides now derive the
 * same translation from this module, so a placeable layout cell and a kept
 * plate socket agree by construction.
 *
 * The stored outline is never mutated (#3149): the frame is a derived,
 * consuming-side view. On top of the automatic lattice registration the
 * user may shift the grid within the perimeter (`drawer.gridShiftX/Y`,
 * #3108); the grid is rendered fixed on both sides, so a grid shift is
 * applied as the equal-and-opposite outline translation.
 */

import type { Drawer, DrawerOutline, FractionalEdge, StoredBaseplateParams } from '@/core/types';
import { clamp } from './validation';
import { padOutline } from './padOutline';
import { translateOutline } from './drawerOutline';
import { clampCornerCuts, cornerCutVertices, cornerCutsMatchVertices } from './cornerCutOutline';
import { outlineLatticeShift, type OutlineLatticeAxis } from './drawerOutlineGeometry';

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
 * Resolve the padded outline and the frame translation both sides consume.
 *
 * The registration is lattice-registered, never raw bbox centring: a
 * sub-cell shift breaks whole-cell registration and cost the #3149 reporter
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
  // A manual shift beyond ±half pitch is equivalent to a different whole-cell
  // registration, so this range spans every distinct grid position; the
  // clamp also defuses out-of-range values that bypassed the command layer
  // (imported or hand-edited layouts).
  const manualX = clamp(p.gridShiftX, -p.gridUnitMm / 2, p.gridUnitMm / 2);
  const manualY = clamp(p.gridShiftY, -p.gridUnitMmY / 2, p.gridUnitMmY / 2);
  const shiftX = registration.x - manualX;
  const shiftY = registration.y - manualY;
  return {
    outline: resolved.outline,
    paddingOn: resolved.paddingOn,
    shiftX: Math.abs(shiftX) < RECENTER_EPS_MM ? 0 : shiftX,
    shiftY: Math.abs(shiftY) < RECENTER_EPS_MM ? 0 : shiftY,
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

const shiftCache = new WeakMap<DrawerOutline, Map<string, { x: number; y: number }>>();
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
  const outline = drawer.outline;
  if (outline === undefined) return ZERO_SHIFT;
  if (baseplateParams?.syncWithLayout === false) return ZERO_SHIFT;
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
  const shift = { x: frame.shiftX, y: frame.shiftY };
  byInputs.set(key, shift);
  return shift;
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
