/**
 * Recognise a hand-built arrangement of identical cutouts as a parametric
 * repeat. The inverse of `expandCutoutArray`: where that turns one master plus a
 * config into instances, this takes instances and recovers the master and the
 * config that would reproduce them.
 *
 * Lives beside the placement math so both directions share one definition of
 * what a grid / stagger / ring is. Every candidate is validated against
 * `arrayFieldBounds` before it is returned, so a detected pattern can never
 * produce a config the array controls would immediately clamp.
 *
 * Positions are fitted with a tolerance because the arrangements worth
 * recovering were dragged into place by hand. The caller is expected to show
 * `maxDriftMm` before applying: the merge moves instances onto the fitted
 * lattice, and on a shadow board a fraction of a millimetre is a real change.
 */

import type { Cutout, CutoutArrayConfig, CutoutArrayMode } from '@/features/bin-designer/types';
import { MAX_ARRAY_INSTANCES } from '@/features/bin-designer/types';
import { arrayFieldBounds, arrayInstanceCount, canArray, defaultArrayConfig } from './cutoutArray';

/**
 * Position slack (mm) allowed when fitting centers to a lattice. Matches the
 * editor's own 0.5mm position step: anything a user could have nudged onto an
 * exact value is close enough to be the same intent.
 */
export const REPEAT_POSITION_TOLERANCE = 0.5;

/** Two cutouts are a duplicate pair, not a pattern — a repeat needs a rhythm. */
export const MIN_REPEAT_SELECTION = 3;

/** Angular slack (deg) when fitting a ring's even spacing. */
const ANGLE_TOLERANCE_DEG = 2;

/**
 * How far any one center may actually move onto the fitted lattice (mm).
 * `REPEAT_POSITION_TOLERANCE` bounds each AXIS independently, so a grid fit at
 * the limit on both axes is `√2` times that away as a straight-line distance.
 * This is the diagonal, and it is checked once for every mode.
 */
const MAX_FIT_DRIFT_MM = REPEAT_POSITION_TOLERANCE * Math.SQRT2;

export interface RepeatDetection {
  readonly mode: CutoutArrayMode;
  readonly config: CutoutArrayConfig;
  /** The cutout that stays and carries the config. */
  readonly masterId: string;
  /** The cutouts the merge removes, in favour of derived instances. */
  readonly absorbedIds: readonly string[];
  /** Furthest any center moves onto the fitted lattice (mm), rounded to 2dp. */
  readonly maxDriftMm: number;
  /** True when an absorbed cutout's color differs from the master's. */
  readonly colorConflict: boolean;
}

interface Center {
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly rotation: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const roundHalf = (v: number): number => Math.round(v * 2) / 2;
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Fields that must be identical for instances to be interchangeable. Rotation
 * is deliberately absent: a `rotateToCenter` ring gives every instance a
 * different one, so it is checked per-mode instead.
 */
function geometryFingerprint(c: Cutout): string {
  return [
    c.shape,
    round3(c.width),
    round3(c.depth),
    round3(c.cutDepth),
    round3(c.cornerRadius),
    c.sides ?? 0,
    round3(c.clearance ?? 0),
    round3(c.chamferWidth ?? 0),
    round3(c.scoopRadiusW ?? 0),
    round3(c.scoopRadiusD ?? 0),
    c.scoopEdges ? JSON.stringify(c.scoopEdges) : '-',
    c.meshId ?? '-',
    c.hidden === true ? 'h' : '-',
  ].join('|');
}

/**
 * True when merging would delete engraved text from the part. Instances inherit
 * the master's `label`, so any engraved label that is not shared by the whole
 * selection would silently stop being cut. Colour is safe to inherit (it is
 * applied at paint time); an engraved label is geometry.
 */
function wouldDropEngravedText(cutouts: readonly Cutout[]): boolean {
  const engraved = cutouts.filter((c) => c.engraveLabel === true && c.label.trim() !== '');
  if (engraved.length === 0) return false;
  if (engraved.length !== cutouts.length) return true;
  return new Set(engraved.map((c) => c.label)).size > 1;
}

/** Sorted cluster means for values that sit within `tolerance` of each other. */
function clusterValues(values: readonly number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const v of sorted) {
    const current = clusters.at(-1);
    const last = current?.at(-1);
    if (current !== undefined && last !== undefined && v - last <= tolerance) current.push(v);
    else clusters.push([v]);
  }
  return clusters.map((group) => group.reduce((sum, v) => sum + v, 0) / group.length);
}

/** Index of the cluster a value belongs to, or -1 when it sits between them. */
function clusterIndex(clusters: readonly number[], value: number, tolerance: number): number {
  return clusters.findIndex((c) => Math.abs(c - value) <= tolerance);
}

function centersOf(cutouts: readonly Cutout[]): Center[] {
  return cutouts.map((c) => ({
    id: c.id,
    cx: c.x + c.width / 2,
    cy: c.y + c.depth / 2,
    rotation: norm360(c.rotation),
  }));
}

/**
 * Largest gap (mm) between a center and where the fitted lattice puts it.
 * `expected` is indexed to match `centers`.
 */
function maxDrift(
  centers: readonly Center[],
  expected: readonly { x: number; y: number }[]
): number {
  let worst = 0;
  for (let i = 0; i < centers.length; i++) {
    const dx = centers[i].cx - expected[i].x;
    const dy = centers[i].cy - expected[i].y;
    worst = Math.max(worst, Math.hypot(dx, dy));
  }
  return worst;
}

/**
 * A pitch the array controls will accept. Sub-minimum spacing is rejected
 * rather than clamped: widening it would shove every instance somewhere the
 * user did not put it.
 */
function fitPitch(clusters: readonly number[], fallback: number): { pitch: number; ok: boolean } {
  if (clusters.length < 2) return { pitch: fallback, ok: true };
  const span = clusters[clusters.length - 1] - clusters[0];
  const pitch = roundHalf(span / (clusters.length - 1));
  if (pitch <= 0) return { pitch: fallback, ok: false };
  const ok = clusters.every(
    (c, i) => Math.abs(c - (clusters[0] + i * pitch)) <= REPEAT_POSITION_TOLERANCE
  );
  return { pitch, ok };
}

/** Shared tail: bounds-check a candidate config and package the result. */
function finalise(
  master: Cutout,
  cutouts: readonly Cutout[],
  config: CutoutArrayConfig,
  drift: number,
  binWidth: number,
  binDepth: number
): RepeatDetection | null {
  if (arrayInstanceCount(config) !== cutouts.length) return null;
  if (cutouts.length > MAX_ARRAY_INSTANCES) return null;
  // The single place the position contract is enforced, so no mode can promise
  // a tolerance its own fit does not deliver. It matters most for rings: an
  // angular slack of 2° is an arc of 0.035·r mm, so at r = 30 it would move an
  // instance over a millimetre while every per-angle check still passed.
  if (drift > MAX_FIT_DRIFT_MM) return null;

  const bounds = arrayFieldBounds(master, binWidth, binDepth, config);
  if (config.mode === 'radial') {
    if (config.radius > bounds.maxRadius) return null;
  } else {
    if (config.cols > bounds.maxCols || config.rows > bounds.maxRows) return null;
    if (config.cols > 1 && (config.pitchX < bounds.minPitchX || config.pitchX > bounds.maxPitchX)) {
      return null;
    }
    if (config.rows > 1 && (config.pitchY < bounds.minPitchY || config.pitchY > bounds.maxPitchY)) {
      return null;
    }
  }

  return {
    mode: config.mode,
    config,
    masterId: master.id,
    absorbedIds: cutouts.filter((c) => c.id !== master.id).map((c) => c.id),
    maxDriftMm: round2(drift),
    colorConflict: cutouts.some((c) => (c.color ?? null) !== (master.color ?? null)),
  };
}

function tryGrid(
  cutouts: readonly Cutout[],
  centers: readonly Center[],
  binWidth: number,
  binDepth: number
): RepeatDetection | null {
  // A grid never rotates its instances, so a mixed-rotation selection is not one.
  if (new Set(centers.map((c) => c.rotation)).size > 1) return null;

  const xs = clusterValues(
    centers.map((c) => c.cx),
    REPEAT_POSITION_TOLERANCE
  );
  const ys = clusterValues(
    centers.map((c) => c.cy),
    REPEAT_POSITION_TOLERANCE
  );
  if (xs.length * ys.length !== centers.length) return null;

  // Every cell occupied exactly once — a ragged arrangement is not a grid.
  const occupied = new Set<string>();
  for (const c of centers) {
    const col = clusterIndex(xs, c.cx, REPEAT_POSITION_TOLERANCE);
    const row = clusterIndex(ys, c.cy, REPEAT_POSITION_TOLERANCE);
    if (col < 0 || row < 0) return null;
    const key = `${col}:${row}`;
    if (occupied.has(key)) return null;
    occupied.add(key);
  }

  const seed = cutouts[0];
  const fallback = defaultArrayConfig(seed.width, seed.depth);
  const px = fitPitch(xs, fallback.pitchX);
  const py = fitPitch(ys, fallback.pitchY);
  if (!px.ok || !py.ok) return null;

  const master = cutouts.find(
    (c) =>
      Math.abs(c.x + c.width / 2 - xs[0]) <= REPEAT_POSITION_TOLERANCE &&
      Math.abs(c.y + c.depth / 2 - ys[0]) <= REPEAT_POSITION_TOLERANCE
  );
  if (!master) return null;

  const originX = master.x + master.width / 2;
  const originY = master.y + master.depth / 2;
  const expected = centers.map((c) => ({
    x: originX + clusterIndex(xs, c.cx, REPEAT_POSITION_TOLERANCE) * px.pitch,
    y: originY + clusterIndex(ys, c.cy, REPEAT_POSITION_TOLERANCE) * py.pitch,
  }));

  return finalise(
    master,
    cutouts,
    {
      ...fallback,
      mode: 'grid',
      cols: xs.length,
      rows: ys.length,
      pitchX: px.pitch,
      pitchY: py.pitch,
    },
    maxDrift(centers, expected),
    binWidth,
    binDepth
  );
}

function tryStaggered(
  cutouts: readonly Cutout[],
  centers: readonly Center[],
  binWidth: number,
  binDepth: number
): RepeatDetection | null {
  if (new Set(centers.map((c) => c.rotation)).size > 1) return null;

  const ys = clusterValues(
    centers.map((c) => c.cy),
    REPEAT_POSITION_TOLERANCE
  );
  if (ys.length < 2) return null;
  if (centers.length % ys.length !== 0) return null;
  const cols = centers.length / ys.length;
  if (cols < 2) return null;

  // Group by row, each row left-to-right.
  const rows: Center[][] = ys.map(() => []);
  for (const c of centers) {
    const row = clusterIndex(ys, c.cy, REPEAT_POSITION_TOLERANCE);
    if (row < 0) return null;
    rows[row].push(c);
  }
  if (rows.some((r) => r.length !== cols)) return null;
  for (const r of rows) r.sort((a, b) => a.cx - b.cx);

  const seed = cutouts[0];
  const fallback = defaultArrayConfig(seed.width, seed.depth);
  const py = fitPitch(ys, fallback.pitchY);
  if (!py.ok) return null;

  // Row 0 is unshifted, so it defines both the origin and the X pitch.
  const px = fitPitch(
    rows[0].map((c) => c.cx),
    fallback.pitchX
  );
  if (!px.ok) return null;
  const originX = rows[0][0].cx;

  // Odd rows sit half a pitch right; an unshifted odd row is a plain grid,
  // which the caller already tried.
  let shifted = false;
  for (let r = 0; r < rows.length; r++) {
    const offset = r % 2 === 1 ? px.pitch / 2 : 0;
    if (offset > 0) shifted = true;
    for (let c = 0; c < cols; c++) {
      const want = originX + c * px.pitch + offset;
      if (Math.abs(rows[r][c].cx - want) > REPEAT_POSITION_TOLERANCE) return null;
    }
  }
  if (!shifted) return null;

  const masterCenter = rows[0][0];
  const master = cutouts.find((c) => c.id === masterCenter.id);
  if (!master) return null;

  const originY = master.y + master.depth / 2;
  const expected = centers.map((c) => {
    const row = clusterIndex(ys, c.cy, REPEAT_POSITION_TOLERANCE);
    const col = rows[row].findIndex((entry) => entry.id === c.id);
    return {
      x: originX + col * px.pitch + (row % 2 === 1 ? px.pitch / 2 : 0),
      y: originY + row * py.pitch,
    };
  });

  return finalise(
    master,
    cutouts,
    { ...fallback, mode: 'staggered', cols, rows: ys.length, pitchX: px.pitch, pitchY: py.pitch },
    maxDrift(centers, expected),
    binWidth,
    binDepth
  );
}

function tryRadial(
  cutouts: readonly Cutout[],
  centers: readonly Center[],
  binWidth: number,
  binDepth: number
): RepeatDetection | null {
  const n = centers.length;
  // A regular ring's centroid is its center.
  const hubX = centers.reduce((sum, c) => sum + c.cx, 0) / n;
  const hubY = centers.reduce((sum, c) => sum + c.cy, 0) / n;

  const polar = centers.map((c) => ({
    ...c,
    radius: Math.hypot(c.cx - hubX, c.cy - hubY),
    angle: norm360((Math.atan2(c.cy - hubY, c.cx - hubX) * 180) / Math.PI),
  }));

  const radius = roundHalf(polar.reduce((sum, p) => sum + p.radius, 0) / n);
  if (radius <= 0) return null;
  if (polar.some((p) => Math.abs(p.radius - radius) > REPEAT_POSITION_TOLERANCE)) return null;

  const ordered = [...polar].sort((a, b) => a.angle - b.angle);
  const step = 360 / n;
  const startAngle = Math.round(ordered[0].angle);
  for (let k = 0; k < n; k++) {
    const delta = Math.abs(norm360(ordered[k].angle - (startAngle + k * step)));
    if (Math.min(delta, 360 - delta) > ANGLE_TOLERANCE_DEG) return null;
  }

  // Instance rotation is either untouched or advances with the ring; anything
  // else cannot be expressed by a single config.
  const rotations = ordered.map((p) => p.rotation);
  const uniform = new Set(rotations).size === 1;
  const follows = rotations.every((rot, k) => {
    const delta = Math.abs(norm360(rot - (rotations[0] + k * step)));
    return Math.min(delta, 360 - delta) <= ANGLE_TOLERANCE_DEG;
  });
  if (!uniform && !follows) return null;

  const master = cutouts.find((c) => c.id === ordered[0].id);
  if (!master) return null;

  const seed = cutouts[0];
  const fallback = defaultArrayConfig(seed.width, seed.depth);
  const expected = centers.map((c) => {
    const k = ordered.findIndex((p) => p.id === c.id);
    const rad = ((startAngle + k * step) * Math.PI) / 180;
    return { x: hubX + radius * Math.cos(rad), y: hubY + radius * Math.sin(rad) };
  });

  return finalise(
    master,
    cutouts,
    {
      ...fallback,
      mode: 'radial',
      count: n,
      radius,
      startAngle: norm360(startAngle),
      rotateToCenter: !uniform,
    },
    maxDrift(centers, expected),
    binWidth,
    binDepth
  );
}

/**
 * Recover the repeat that would reproduce these cutouts, or null when they are
 * not a pattern. Modes are tried grid, staggered, radial: a stagger with a zero
 * offset is a grid, so the plainer reading always wins.
 */
export function detectRepeatPattern(
  cutouts: readonly Cutout[],
  binWidth: number,
  binDepth: number
): RepeatDetection | null {
  if (cutouts.length < MIN_REPEAT_SELECTION) return null;
  if (cutouts.some((c) => !canArray(c) || c.locked === true || c.array !== undefined)) return null;
  if (new Set(cutouts.map(geometryFingerprint)).size > 1) return null;
  if (wouldDropEngravedText(cutouts)) return null;

  const centers = centersOf(cutouts);
  return (
    tryGrid(cutouts, centers, binWidth, binDepth) ??
    tryStaggered(cutouts, centers, binWidth, binDepth) ??
    tryRadial(cutouts, centers, binWidth, binDepth)
  );
}
