/**
 * Pure placement math for parametric cutout arrays. Lives in `shared/` so the
 * generation worker and the 2D editor derive identical instance positions from
 * the same `CutoutArrayConfig`.
 *
 * An array's instances are expressed as offsets from the master cutout's
 * center, in the bin-interior frame (mm, X right, Y up). Instance 0 is always
 * the master itself (offset 0, no extra rotation), so the master stays a real
 * cut in every mode and arrays compose with the existing single-cutout
 * positioning. The grid is world-axis-aligned (independent of master rotation).
 */

import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';
import { MAX_ARRAY_INSTANCES, MAX_ARRAY_COUNT } from '@/features/bin-designer/types';
import { clamp } from './math';

/**
 * A single loose cutout can drive a repeat of its own.
 *
 * Deliberately still refuses a grouped member: a group repeats as ONE unit
 * through {@link canGroupArray}, so a member holding a private repeat would cut
 * holes the boolean the group is built from knows nothing about. The repeat
 * detector and the merge action read this too, and both work on loose shapes.
 */
export function canArray(cutout: Pick<Cutout, 'shape' | 'groupId'>): boolean {
  return cutout.shape !== 'path' && cutout.groupId === null;
}

/**
 * A whole group can drive one shared repeat, so a boolean result (a recessed
 * ring, a keyed pocket) can be arrayed without flattening it first.
 *
 * Paths are the only refusal, and for the same reason they are refused
 * singly: the worker rebuilds a path from the master and cannot place its
 * vertices per instance.
 */
export function canGroupArray(members: readonly Pick<Cutout, 'shape'>[]): boolean {
  return members.length > 1 && members.every((m) => m.shape !== 'path');
}

/**
 * The box a grouped repeat is measured against: the union of its members'
 * nominal boxes.
 *
 * Spacing, the count ceilings and the fill action all ask "how much room is
 * left beyond this shape", and for a group the answer has to be about the whole
 * assembly. Measured on the nominal boxes, like every other bound in this
 * module, so a rotated member sweeps a wider box than this accounts for.
 */
export function groupRepeatBox(members: readonly RepeatBox[]): RepeatBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of members) {
    minX = Math.min(minX, m.x);
    minY = Math.min(minY, m.y);
    maxX = Math.max(maxX, m.x + m.width);
    maxY = Math.max(maxY, m.y + m.depth);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, depth: 0 };
  return { x: minX, y: minY, width: maxX - minX, depth: maxY - minY };
}

/**
 * A repeat config a GROUP may hold.
 *
 * `rotateToCenter` is the one setting a group cannot take. It turns each
 * instance to face the ring, which for a group means turning the whole assembly
 * about the ring center; expanding members one at a time can only turn each
 * about its own center, which pulls the assembly apart. Every other mode leaves
 * `drot` at 0, where per-member expansion is exact, so forcing this off is what
 * lets a grouped repeat stay correct in the twenty-odd places that expand a
 * cutout without knowing whether it is grouped.
 */
export function groupArrayConfig(config: CutoutArrayConfig): CutoutArrayConfig {
  return config.rotateToCenter ? { ...config, rotateToCenter: false } : config;
}

/**
 * The footprint a repeat's spacing and bounds are measured against: one
 * cutout's box, or a whole group's (see {@link groupRepeatBox}). Every bounds
 * helper here takes this rather than a `Cutout`, so the same math serves both.
 */
export type RepeatBox = Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>;

/** Absolute editor caps for array spacing (mm), independent of bin size. */
export const ARRAY_MIN_PITCH = 1;
export const ARRAY_MAX_PITCH = 200;
export const ARRAY_MIN_RADIUS = 1;
export const ARRAY_MAX_RADIUS = 200;

export interface ArrayInstance {
  /** Center offset from the master center (mm). */
  readonly dx: number;
  readonly dy: number;
  /** Extra rotation (deg) added on top of the master's rotation. */
  readonly drot: number;
  /** True for instance 0 — the master — so the editor can mark it. */
  readonly isMaster: boolean;
  /**
   * Index into {@link CutoutArrayConfig.labels} for this instance. Deliberately
   * NOT the emission index: a grid is emitted bottom row first (Y is up, gotcha
   * #1) while a label list is written the way it is read, top row first. See
   * {@link arrayLabelOrder}.
   */
  readonly labelIndex: number;
}

const clampCount = (n: number): number => Math.max(1, Math.round(Number.isFinite(n) ? n : 1));

function dir(angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/**
 * Total instance count an array expands to (clamped to MAX_ARRAY_INSTANCES).
 * Cheap — for UI display and pre-flight guards.
 */
export function arrayInstanceCount(config: CutoutArrayConfig): number {
  const raw =
    config.mode === 'radial'
      ? clampCount(config.count)
      : clampCount(config.cols) * clampCount(config.rows);
  return Math.min(raw, MAX_ARRAY_INSTANCES);
}

/**
 * Derive every instance placement for an array. Returns offsets from the master
 * center; index 0 is the master. Empty offsets array would never happen (always
 * ≥ the master), but the result is capped at MAX_ARRAY_INSTANCES.
 */
export function arrayInstances(config: CutoutArrayConfig): ArrayInstance[] {
  const out: ArrayInstance[] = [];
  const cap = MAX_ARRAY_INSTANCES;

  if (config.mode === 'radial') {
    const count = Math.min(clampCount(config.count), cap);
    const r = Math.max(0, config.radius);
    const step = 360 / count;
    const base = dir(config.startAngle);
    for (let k = 0; k < count; k++) {
      const angle = config.startAngle + k * step;
      const d = dir(angle);
      out.push({
        dx: r * (d.x - base.x),
        dy: r * (d.y - base.y),
        drot: config.rotateToCenter ? k * step : 0,
        isMaster: k === 0,
        labelIndex: k,
      });
    }
    return out;
  }

  // grid / staggered
  const cols = clampCount(config.cols);
  const rows = clampCount(config.rows);
  const staggered = config.mode === 'staggered';
  for (let row = 0; row < rows; row++) {
    const rowOffset = staggered && row % 2 === 1 ? config.pitchX / 2 : 0;
    for (let col = 0; col < cols; col++) {
      if (out.length >= cap) return out;
      out.push({
        dx: col * config.pitchX + rowOffset,
        dy: row * config.pitchY,
        drot: 0,
        isMaster: row === 0 && col === 0,
        labelIndex: (rows - 1 - row) * cols + col,
      });
    }
  }
  return out;
}

/**
 * How a label list maps onto the instances of an array, as a sentence the
 * editor can show and this module implements.
 *
 * Grid and staggered arrays grow in +Y, which is UP, so instance 0 is the
 * BOTTOM-left hole. A list of labels is written the way it is read (top row
 * first), so the two orders are reversed by row, never by column.
 */
export type ArrayLabelOrder = 'reading' | 'ring';

export function arrayLabelOrder(config: CutoutArrayConfig): ArrayLabelOrder {
  return config.mode === 'radial' ? 'ring' : 'reading';
}

/**
 * The label an instance carries: its own entry when the list reaches it (blank
 * included, since an explicit empty slot means "leave this one bare"), and the
 * master's label beyond the list's end.
 *
 * The asymmetry is the point. A list SHORTER than the array is half-finished
 * work, and blanking the tail would hide the holes the user has yet to name; a
 * blank written INSIDE the list is a decision.
 */
export function instanceLabel(
  masterLabel: string,
  labels: readonly string[] | undefined,
  labelIndex: number
): string {
  if (!labels || labelIndex >= labels.length) return masterLabel;
  return labels[labelIndex];
}

/**
 * The instances that carry an engraved label of their own.
 *
 * A repeat WITHOUT a label list engraves once, beside the master, exactly as it
 * did before the list existed, so every stored design keeps the part it
 * printed. Writing a list is the act that opts a repeat into a label per
 * instance, which is why the gate is the list's presence and not its contents:
 * a list of one on a repeat of five still labels all five (the tail falling
 * back to the master's label), and the editor reports the shortfall.
 *
 * Callers that want PLACEMENT rather than labels (bounds, sockets, fit tests)
 * want every instance regardless, and use `expandCutoutArray`.
 */
export function labelledInstances(cutout: Cutout): Cutout[] {
  if (cutout.array?.labels === undefined) return [cutout];
  return expandCutoutArray(cutout);
}

/**
 * How many labels a list supplies, against how many copies there are. The
 * editor shows this as "5 labels / 5 copies" and warns on a mismatch rather
 * than refusing it.
 *
 * Trailing blanks do not count as supplied: a list typed as `"A, B,"` has two
 * labels and a stray separator, not three.
 */
export function arrayLabelCounts(config: CutoutArrayConfig): {
  readonly labels: number;
  readonly copies: number;
} {
  const labels = config.labels ?? [];
  let last = labels.length;
  while (last > 0 && labels[last - 1].trim() === '') last--;
  return { labels: last, copies: arrayInstanceCount(config) };
}

/**
 * Expand an array master into concrete cutouts — one per instance, with the
 * array stripped, positioned/rotated per {@link arrayInstances}. Instance 0
 * keeps the master's exact placement. Used by the generator (cut tools) and the
 * editor (instance meshes). Returns `[cutout]` unchanged when there's no array.
 *
 * Derived ids are `${master.id}::a${i}` so the editor can key meshes; routing a
 * click back to the master is the caller's job (it knows the master id).
 */
export function expandCutoutArray(cutout: Cutout): Cutout[] {
  if (!cutout.array) return [cutout];
  const labels = cutout.array.labels;
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  return arrayInstances(cutout.array).map((inst, i) => {
    const label = instanceLabel(cutout.label, labels, inst.labelIndex);
    if (inst.isMaster) {
      const { array: _a, ...rest } = cutout;
      return { ...rest, id: `${cutout.id}::a${i}`, label };
    }
    const { array: _a, ...rest } = cutout;
    return {
      ...rest,
      id: `${cutout.id}::a${i}`,
      label,
      x: cx + inst.dx - cutout.width / 2,
      y: cy + inst.dy - cutout.depth / 2,
      rotation: (((cutout.rotation + inst.drot) % 360) + 360) % 360,
      // Path vertices are absolute, so they must move with the instance —
      // otherwise editor previews (and flattened arrays) stack every path
      // instance on the master. Handles are relative offsets and stay as-is.
      // (The worker rebuilds geometry from the master and ignores this path.)
      ...(cutout.path
        ? { path: cutout.path.map((p) => ({ ...p, x: p.x + inst.dx, y: p.y + inst.dy })) }
        : {}),
    };
  });
}

/**
 * The repeat a group runs, or undefined when it does not repeat.
 *
 * Members that carry no repeat adopt the one their siblings do, because that is
 * a shape shipped versions produce: repeating a loose cutout and THEN grouping
 * it left the config on that member alone, and the worker has always cut every
 * copy of it. Reading such a group as un-repeated would quietly drop pockets
 * from a board someone already printed.
 *
 * Members that carry DIFFERENT repeats decline instead. Nothing produces that,
 * so it means a hand-authored or crafted design, and there is no honest way to
 * pick a winner: whichever the worker chose, the copies of the other member
 * would land somewhere the preview never drew.
 *
 * The editor and the worker both read the group through this, which is what
 * stops them disagreeing about how many copies a group has.
 *
 * Labels are not compared. They ride on the same config but only decide what is
 * engraved, so they cannot move a copy.
 */
export function groupRepeatConfig(
  members: readonly Pick<Cutout, 'array'>[]
): CutoutArrayConfig | undefined {
  let found: CutoutArrayConfig | undefined;
  for (const member of members) {
    const array = member.array;
    if (!array) continue;
    if (!found) found = array;
    else if (!samePlacement(found, array)) return undefined;
  }
  return found;
}

/** Whether two repeats put their copies in the same places. */
function samePlacement(a: CutoutArrayConfig, b: CutoutArrayConfig): boolean {
  return (
    a.mode === b.mode &&
    a.cols === b.cols &&
    a.rows === b.rows &&
    a.pitchX === b.pitchX &&
    a.pitchY === b.pitchY &&
    a.count === b.count &&
    a.radius === b.radius &&
    a.startAngle === b.startAngle &&
    a.rotateToCenter === b.rotateToCenter
  );
}

/**
 * The members of each copy of a repeated group, outermost index being the copy.
 * A group with no repeat yields one copy: the members as they stand.
 *
 * A transpose of the per-member expansions, which is only sound because a
 * grouped repeat leaves `drot` at 0 (see {@link groupArrayConfig}). With a
 * per-instance rotation the members would each turn about their own center and
 * the assembly would come apart, so this would have to rotate the group about a
 * shared anchor instead.
 */
export function expandCutoutGroup(members: readonly Cutout[]): Cutout[][] {
  // Read through the same gate the worker uses, so the two cannot disagree
  // about whether a group repeats or how many copies it has. A member holding
  // no repeat of its own is expanded on the group's, which is what makes a
  // legacy group draw the copies it has always been cut with.
  const config = groupRepeatConfig(members);
  if (!config) return [[...members]];
  const perMember = members.map((m) => expandCutoutArray(m.array ? m : { ...m, array: config }));
  const copies = Math.min(...perMember.map((m) => m.length));
  if (!Number.isFinite(copies) || copies <= 1) return [[...members]];
  const out: Cutout[][] = [];
  for (let i = 0; i < copies; i++) out.push(perMember.map((m) => m[i]));
  return out;
}

/**
 * How many instances physically fit on each axis at the current pitch, master
 * included and BEFORE the instance cap.
 *
 * The one statement of the "how many fit" arithmetic, so the field bounds and
 * the fill action cannot disagree about where the bin ends. The grid grows in
 * +X/+Y from the master, so the room to grow is measured from the master's far
 * edge — the master's own position IS the leading margin.
 */
function spatialCounts(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>,
  binWidth: number,
  binDepth: number,
  config: CutoutArrayConfig
): { readonly cols: number; readonly rows: number } {
  const availX = Math.max(0, binWidth - cutout.x - cutout.width);
  const availY = Math.max(0, binDepth - cutout.y - cutout.depth);
  const rows = clampCount(config.rows);
  // The half-pitch X shift only exists once there's an odd row to shift, so it
  // only eats into the width when staggered AND rows > 1.
  const stagger = config.mode === 'staggered' && rows > 1 ? config.pitchX / 2 : 0;
  const stepsX = config.pitchX > 0 ? Math.floor((availX - stagger) / config.pitchX) : 0;
  const stepsY = config.pitchY > 0 ? Math.floor(availY / config.pitchY) : 0;
  return { cols: 1 + Math.max(0, stepsX), rows: 1 + Math.max(0, stepsY) };
}

/** Per-field bounds that keep an array within the bin's physical footprint. */
export interface ArrayFieldBounds {
  readonly maxCols: number;
  readonly maxRows: number;
  readonly minPitchX: number;
  readonly minPitchY: number;
  readonly maxPitchX: number;
  readonly maxPitchY: number;
  readonly maxRadius: number;
  /**
   * Smallest pitch on each axis at which no two instances' bounding boxes
   * OVERLAP, given the other axis and the mode as they currently stand.
   *
   * Edge to edge is not overlap and is exactly this value: instances packed
   * flush share a boundary and still cut two openings, so the threshold is
   * where they start eating into each other, not where they meet.
   *
   * Advisory, NOT a floor: overlap is a legitimate thing to ask for (two
   * shapes cutting into each other to make one opening), so the editor warns
   * rather than clamps. Below this the resulting cuts merge.
   */
  readonly clearPitchX: number;
  readonly clearPitchY: number;
}

/**
 * Whether any two instances of this array overlap, box against box.
 *
 * Two instances overlap only when they overlap on BOTH axes, which is what
 * makes a staggered array able to nest: adjacent rows sit half a pitch apart
 * in X, so once that half-pitch clears the master's width the rows may come
 * arbitrarily close in Y and still miss each other. Reading the Y bound off the
 * master's box alone — as a per-axis floor must — is what stopped round
 * shapes from nesting into the row below them.
 *
 * Measured on the nominal box, like every other bound here; a rotated master
 * sweeps a different box and is not corrected for.
 */
export function arrayInstancesOverlap(
  cutout: Pick<Cutout, 'width' | 'depth'>,
  config: CutoutArrayConfig
): boolean {
  if (config.mode === 'radial') return false;
  const cols = clampCount(config.cols);
  const rows = clampCount(config.rows);
  const staggered = config.mode === 'staggered';
  if (cols > 1 && config.pitchX < cutout.width) return true;
  const rowOffsetX = staggered ? config.pitchX / 2 : 0;
  return rows > 1 && rowOffsetX < cutout.width && config.pitchY < cutout.depth;
}

const floorToHalf = (v: number): number => Math.floor(v * 2) / 2;

/**
 * Feasible upper bounds for each array field given the master cutout's size and
 * position and the bin interior. The grid grows in +X/+Y from the master, so a
 * field's max is whatever keeps the furthest instance inside the bin (and the
 * total within {@link MAX_ARRAY_INSTANCES}). Each bound is computed against the
 * other fields as-is, so editing one never silently rewrites the others.
 */
export function arrayFieldBounds(
  cutout: RepeatBox,
  binWidth: number,
  binDepth: number,
  config: CutoutArrayConfig
): ArrayFieldBounds {
  const { width: w, depth: d } = cutout;
  // Room for the array to grow from the master's far edge to the bin edge.
  const availX = Math.max(0, binWidth - cutout.x - w);
  const availY = Math.max(0, binDepth - cutout.y - d);
  const cols = clampCount(config.cols);
  const rows = clampCount(config.rows);
  const colExtraSpan = config.mode === 'staggered' && rows > 1 ? 0.5 : 0;
  const spatial = spatialCounts(cutout, binWidth, binDepth, config);

  const maxCols = clamp(
    Math.min(spatial.cols, Math.floor(MAX_ARRAY_INSTANCES / rows)),
    1,
    MAX_ARRAY_COUNT
  );
  const maxRows = clamp(
    Math.min(spatial.rows, Math.floor(MAX_ARRAY_INSTANCES / cols)),
    1,
    MAX_ARRAY_COUNT
  );

  // Largest pitch that keeps the current counts inside the bin.
  const colSpan = cols - 1 + colExtraSpan;
  const rowSpan = rows - 1;
  const maxPitchX = clamp(
    floorToHalf(colSpan > 0 ? availX / colSpan : ARRAY_MAX_PITCH),
    ARRAY_MIN_PITCH,
    ARRAY_MAX_PITCH
  );
  const maxPitchY = clamp(
    floorToHalf(rowSpan > 0 ? availY / rowSpan : ARRAY_MAX_PITCH),
    ARRAY_MIN_PITCH,
    ARRAY_MAX_PITCH
  );

  // Radial ring is centered on the master, so it can only grow until it reaches
  // the nearest bin edge — bound by the master box's smallest edge clearance,
  // which (unlike a bin-wide span) respects an off-center master.
  const edgeClearance = Math.min(
    cutout.x,
    cutout.y,
    binWidth - (cutout.x + w),
    binDepth - (cutout.y + d)
  );
  const maxRadius = clamp(floorToHalf(edgeClearance), ARRAY_MIN_RADIUS, ARRAY_MAX_RADIUS);

  // Pitch floors are the absolute editor cap only. A floor derived from the
  // master's box refuses two things the user may genuinely want: a staggered
  // array nesting into the row below (where the half-pitch X offset has
  // already separated the boxes) and a deliberate overlap, where neighbouring
  // cuts are meant to merge into one opening. `clearPitch*` says where overlap
  // begins so the editor can warn instead.
  const minPitchX = ARRAY_MIN_PITCH;
  const minPitchY = ARRAY_MIN_PITCH;
  const staggerOffsetX = config.mode === 'staggered' ? config.pitchX / 2 : 0;
  const clearPitchX = cols > 1 ? Math.max(ARRAY_MIN_PITCH, w) : ARRAY_MIN_PITCH;
  const clearPitchY =
    rows > 1 && staggerOffsetX < w ? Math.max(ARRAY_MIN_PITCH, d) : ARRAY_MIN_PITCH;

  return {
    maxCols,
    maxRows,
    minPitchX,
    minPitchY,
    maxPitchX,
    maxPitchY,
    maxRadius,
    clearPitchX,
    clearPitchY,
  };
}

/**
 * Counts that fill the bin with the array's current pitch and mode.
 *
 * Deliberately expressed as counts on the existing config rather than as a
 * mode of its own: the result lands in the same `cols`/`rows` fields, so it
 * stays editable afterwards and the user can back off a row without undoing
 * the fill. Spacing is whatever the pitch fields already say, and the master's
 * position is the leading margin, so both are set the way the user is used to
 * setting them rather than through a second set of controls that mean the same
 * thing.
 *
 * The instance cap is spent on columns first and rows take what is left, so a
 * fill that cannot have everything degrades to complete rows rather than a
 * ragged final one.
 */
export function fillBinCounts(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>,
  binWidth: number,
  binDepth: number,
  config: CutoutArrayConfig
): { readonly cols: number; readonly rows: number } {
  // Rows first, and columns measured against the rows the fill will actually
  // produce: a staggered array only pays the half-pitch X offset once it has a
  // second row, so counting columns against the CURRENT single row would fit
  // one column too many and hang it off the bin's edge.
  const rowsFit = spatialCounts(cutout, binWidth, binDepth, config).rows;
  const colsFit = spatialCounts(cutout, binWidth, binDepth, { ...config, rows: rowsFit }).cols;
  const cols = clamp(colsFit, 1, MAX_ARRAY_COUNT);
  const rows = clamp(Math.min(rowsFit, Math.floor(MAX_ARRAY_INSTANCES / cols)), 1, MAX_ARRAY_COUNT);
  return { cols, rows };
}

/** A sensible default config for a freshly-enabled array, sized off the master. */
export function defaultArrayConfig(masterWidth: number, masterDepth: number): CutoutArrayConfig {
  // Pitch leaves a small gap so instances don't touch by default.
  const pitchX = Math.max(2, masterWidth + 4);
  const pitchY = Math.max(2, masterDepth + 4);
  return {
    mode: 'grid',
    cols: 3,
    rows: 2,
    pitchX,
    pitchY,
    count: 6,
    radius: Math.max(masterWidth, masterDepth) + 12,
    startAngle: 0,
    rotateToCenter: true,
  };
}
