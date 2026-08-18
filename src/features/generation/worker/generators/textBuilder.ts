/**
 * Text geometry builder.
 *
 * Materializes a caption as a 3D solid that the host (label tab, plate, wall,
 * lid, cutout surround) booleans against. Three modes:
 *  - `engrave` extrudes downward into the host (caller cuts)
 *  - `emboss` extrudes upward above the host (caller fuses)
 *  - `through-cut` extrudes downward through the full host depth (caller cuts)
 *
 * WHERE the glyphs go is not decided here. `@/shared/utils/typePlan` owns
 * anchoring, sizing, tracking, case and line breaking, and the designer's ghost
 * overlay reads the same plan, so this module's job is strictly to turn a
 * placed plan into kernel geometry.
 *
 * Two materialisation paths. A single untracked line is one `sketchText` call,
 * exactly as before the type system existed, so an unchanged design produces
 * bit-identical geometry and pays no new kernel cost. Tracking, multiple lines
 * or a drafted profile fall to per-glyph placement, which is the only way to
 * put a glyph anywhere other than where the font's own advances put it.
 */

import {
  sketchText,
  translate,
  rotate,
  compound,
  getFont,
  type Shape3D,
  type DisposalScope,
  type PlaneName,
} from 'brepjs';
import type { Sketches } from 'brepjs';
import type { TextFontFamily, TextMode, TextStyleDefaults } from '@/shared/types/bin';
import {
  createTypeMeasurer,
  planTypeBlock,
  resolveEffectiveFont,
  type GlyphFont,
  type TypeBlockPlan,
  type TypeHostKind,
  type TypeMeasurer,
} from '@/shared/utils/typePlan';
import { getTextSolid, setTextSolid, textSolidKey } from './textSolidCache';

export { resolveEffectiveFont };

/** A style with every field resolved, plus the legacy shrink-only size cap. */
export type ResolvedTextStyle = TextStyleDefaults & { readonly fontSizeOverride?: number };

/**
 * Lift sketches above the host top face so booleans don't touch coincident
 * surfaces (an OCCT fragility point that occasionally produces nullspace
 * results). 0.01mm is below any printable feature. Exported so tests can
 * assert against the same tolerance the runtime uses instead of duplicating
 * the magic number.
 */
export const TEXT_BOOLEAN_EPSILON = 0.01;

let measurer: TypeMeasurer | null = null;

/**
 * The worker's measurer, over brepjs's font registry. Shared with the plan so
 * a size chosen during fitting is measured against the same metrics the glyphs
 * are built from.
 */
export function getTypeMeasurer(): TypeMeasurer {
  measurer ??= createTypeMeasurer((family) => getFont(family) as GlyphFont | undefined);
  return measurer;
}

/**
 * Drop all memoized text metrics. Call when the font registry changes (font
 * (re)load, kernel switch): every measurement depends on the loaded font.
 */
export function clearTextMetricsMemo(): void {
  measurer = null;
}

export interface TextHostOptions {
  readonly text: string;
  readonly style: ResolvedTextStyle;
  /** Total available width for the host box in mm (margin not yet subtracted). */
  readonly availW: number;
  /** Total available depth for the host box in mm (margin not yet subtracted). */
  readonly availD: number;
  /**
   * A size resolved across a group. Wins over the style's own sizing but is
   * still subject to the fit, so a member that cannot hold it shrinks alone.
   */
  readonly sharedSizeMm?: number;
  /** Off for hosts where a second line has nowhere to go. */
  readonly allowWrap?: boolean;
  /** `plaque` for hosts that ARE the caption's frame (a tab, a plate). */
  readonly hostKind?: TypeHostKind;
}

/**
 * Resolve where a caption's glyphs land on a host, or `null` when it cannot be
 * rendered (empty text, missing font, or the legibility floor exceeds the host).
 *
 * Exposed separately from the build because three callers need the answer
 * BEFORE building: a group sharing one size has to fit every member up front,
 * the wall-pattern clip has to clear the same rect the glyphs will occupy, and
 * the overflow report has to name captions that will print blank.
 */
export function planTextForHost(options: TextHostOptions): TypeBlockPlan | null {
  const trimmed = options.text.trim();
  if (!trimmed) return null;
  if (!getFont(resolveEffectiveFont(options.style.font, options.style.mode))) return null;
  return planTypeBlock(
    {
      text: trimmed,
      style: options.style,
      host: { width: options.availW, depth: options.availD },
      ...(options.sharedSizeMm !== undefined ? { sharedSizeMm: options.sharedSizeMm } : {}),
      ...(options.allowWrap !== undefined ? { allowWrap: options.allowWrap } : {}),
      ...(options.hostKind !== undefined ? { hostKind: options.hostKind } : {}),
    },
    getTypeMeasurer()
  );
}

/** The rendered size a host would pick, or `null` when the caption will not fit. */
export function fitTextSize(options: TextHostOptions): number | null {
  return planTextForHost(options)?.fontSize ?? null;
}

/**
 * Whether the host should `cut` or `fuse` the returned solid. Engrave and
 * through-cut both cut; emboss fuses.
 */
export type TextOp = 'cut' | 'fuse';

export interface TextSolidResult {
  readonly solid: Shape3D;
  readonly op: TextOp;
  /** The placement the solid was built from, for callers that must clip to it. */
  readonly plan: TypeBlockPlan;
}

export interface BuildTextSolidOptions extends TextHostOptions {
  /** Visual centre of the host box in the host's local frame. */
  readonly centerX: number;
  readonly centerY: number;
  /** Z of the host's top face in the local frame; the sketch origin sits here. */
  readonly topZ: number;
  /** Engrave/emboss depth in mm, already clamped by the host. */
  readonly depth: number;
  /**
   * Total host thickness in mm. Through-cut extrudes through `hostThickness +
   * 2·EPSILON` to guarantee clean both-face exits; engrave/emboss ignore it.
   */
  readonly hostThickness: number;
  /**
   * Optional rotation in degrees about the block's own ink centre. Default 0.
   * The sign matches the cutout-rotation convention (negated about +Z) so a
   * label tracks the 2D editor preview.
   */
  readonly angleDeg?: number;
  /** A plan the caller already computed. Saves re-planning and, more
   *  importantly, guarantees the geometry matches what the caller measured. */
  readonly plan?: TypeBlockPlan;
}

/**
 * Build a text solid placed in the host's local frame, ready for the caller to
 * apply via the returned `op`.
 */
export function buildTextSolid(
  scope: DisposalScope,
  options: BuildTextSolidOptions
): TextSolidResult | null {
  const plan = options.plan ?? planTextForHost(options);
  if (!plan || plan.lines.length === 0) return null;

  const { mode } = options.style;

  // All three modes need the EPSILON lift to avoid coplanar boolean fragility:
  //  - engrave / through-cut: sketch sits ABOVE topZ, extrudes DOWN through it
  //  - emboss: sketch sits BELOW topZ, extrudes UP through it
  // Either way the solid penetrates the host's top face by EPSILON so the
  // fuse/cut surfaces overlap instead of being coincident.
  const sketchOriginZ =
    mode === 'emboss' ? options.topZ - TEXT_BOOLEAN_EPSILON : options.topZ + TEXT_BOOLEAN_EPSILON;
  const extrusion =
    mode === 'emboss'
      ? options.depth + TEXT_BOOLEAN_EPSILON
      : mode === 'through-cut'
        ? -(options.hostThickness + 2 * TEXT_BOOLEAN_EPSILON)
        : -(options.depth + TEXT_BOOLEAN_EPSILON);

  // A tapered through-cut would meet itself at a knife edge partway through a
  // thick host, so the profile applies to the two bounded modes only.
  const taper =
    options.style.cutProfile === 'drafted' && mode !== 'through-cut'
      ? options.style.draftAngleDeg
      : 0;

  const refX = plan.lines[0].x;
  const refY = plan.lines[0].baselineY;
  const canonical = getOrBuildCanonicalBlock(scope, plan, mode, {
    depth: options.depth,
    hostThickness: options.hostThickness,
    extrusion,
    taperDeg: taper,
    refX,
    refY,
  });

  const angle = options.angleDeg ?? 0;
  let solid: Shape3D;
  if (angle === 0) {
    solid = scope.register(
      translate(canonical, [options.centerX + refX, options.centerY + refY, sketchOriginZ])
    );
  } else {
    // Rotate about the block's own ink centre: recentre on it, spin about +Z
    // (negated to match the cutout-rotation convention), then place. The ink
    // centre, not the advance box, so a rotated caption pivots where it looks
    // like it should.
    const pivotX = (plan.minX + plan.maxX) / 2 - refX;
    const pivotY = (plan.minY + plan.maxY) / 2 - refY;
    const centered = scope.register(translate(canonical, [-pivotX, -pivotY, 0]));
    const rotated = scope.register(rotate(centered, -angle, { axis: [0, 0, 1] }));
    solid = scope.register(
      translate(rotated, [
        options.centerX + refX + pivotX,
        options.centerY + refY + pivotY,
        sketchOriginZ,
      ])
    );
  }

  return { solid, op: mode === 'emboss' ? 'fuse' : 'cut', plan };
}

interface CanonicalOptions {
  readonly depth: number;
  readonly hostThickness: number;
  readonly extrusion: number;
  readonly taperDeg: number;
  readonly refX: number;
  readonly refY: number;
}

/**
 * Signature of everything that shapes the canonical block, so two hosts that
 * would build identical geometry share one cache entry and two that would not
 * never collide. Positions are relative to the first line's pen origin, which
 * is what makes the entry placement-independent and therefore shareable.
 */
function blockLayoutKey(plan: TypeBlockPlan, refX: number, refY: number, taperDeg: number): string {
  const lines = plan.lines
    .map(
      (line) =>
        `${line.text}@${line.fontSize.toFixed(4)}/${line.trackingMm.toFixed(4)}` +
        `+${(line.x - refX).toFixed(4)},${(line.baselineY - refY).toFixed(4)}`
    )
    .join('|');
  return `${lines}~${taperDeg.toFixed(2)}`;
}

function getOrBuildCanonicalBlock(
  scope: DisposalScope,
  plan: TypeBlockPlan,
  mode: TextMode,
  opts: CanonicalOptions
): Shape3D {
  const key = textSolidKey(
    blockLayoutKey(plan, opts.refX, opts.refY, opts.taperDeg),
    plan.font,
    mode,
    opts.depth,
    opts.hostThickness
  );
  const hit = getTextSolid(key);
  if (hit) return scope.register(hit);

  const built = buildBlockCompound(plan, opts);
  // Cache an independent clone before handing the built shape to the scope.
  setTextSolid(key, built);
  return scope.register(built);
}

/**
 * Scale factor that insets a profile by `depth · tan(angle)` per side over the
 * extrusion.
 *
 * `extrusionProfile` scales the whole cross-section, so the inset it produces
 * is proportional to the profile's own size rather than constant. Deriving the
 * factor from the cap height makes the taper exact on a glyph's vertical
 * extent, which is the dimension a raking light reads, and slightly gentler on
 * a wide glyph's horizontal extent. At the sub-millimetre depths engraved text
 * uses, the difference between that and a true constant-angle draft is well
 * under a tenth of the wall it applies to.
 */
function taperEndFactor(taperDeg: number, depth: number, capHeight: number): number {
  if (taperDeg <= 0 || depth <= 0 || capHeight <= 0) return 1;
  const inset = depth * Math.tan((taperDeg * Math.PI) / 180);
  return Math.max(MIN_TAPER_END_FACTOR, 1 - (2 * inset) / capHeight);
}

/** Below this the profile collapses toward a point and the sweep gets fragile. */
const MIN_TAPER_END_FACTOR = 0.6;

/**
 * Sketch a run with its pen at (`penX`, `penY`).
 *
 * `sketchText` NEGATES `startX` (a run sketched at `startX: 10` lands at -10)
 * while leaving `startY` alone, so every pen position has to be handed over
 * inverted. Wrapped in one place, and pinned by a test, because the fast path
 * always passes zero and would never show the mirroring: it only surfaces once
 * a caption is tracked, wrapped or tapered, and then it moves the whole run to
 * the wrong side of its host.
 */
function sketchRunAtPen(
  text: string,
  fontSize: number,
  fontFamily: TextFontFamily,
  penX: number,
  penY: number
): Sketches {
  return sketchText(
    text,
    { fontSize, fontFamily, startX: -penX, startY: penY },
    { plane: 'XY' as PlaneName, origin: [0, 0, 0] }
  );
}

function buildBlockCompound(plan: TypeBlockPlan, opts: CanonicalOptions): Shape3D {
  const pieces: Shape3D[] = [];
  const flat = opts.taperDeg <= 0;

  for (const line of plan.lines) {
    const dx = line.x - opts.refX;
    const dy = line.baselineY - opts.refY;

    if (flat && line.trackingMm === 0) {
      // The path an untouched design takes: one sketch for the whole line, with
      // the pen placed by the plan.
      pieces.push(
        sketchRunAtPen(line.text, line.fontSize, plan.font, dx, dy).extrude(opts.extrusion)
      );
      continue;
    }

    for (const glyph of line.glyphs) {
      if (glyph.char.trim() === '') continue;
      const x = dx + glyph.x;
      if (flat) {
        pieces.push(
          sketchRunAtPen(glyph.char, line.fontSize, plan.font, x, dy).extrude(opts.extrusion)
        );
        continue;
      }
      pieces.push(buildTaperedGlyph(plan, line, glyph.char, x, dy, opts));
    }
  }

  return pieces.length === 1 ? pieces[0] : compound(pieces);
}

/**
 * One tapered glyph.
 *
 * `extrusionProfile` scales about the SKETCH ORIGIN, so a glyph drawn at its
 * final position would slide toward the origin as it scaled rather than taper
 * in place. Every tapered glyph is therefore drawn centred on the origin and
 * translated afterward.
 */
function buildTaperedGlyph(
  plan: TypeBlockPlan,
  line: TypeBlockPlan['lines'][number],
  char: string,
  x: number,
  baselineY: number,
  opts: CanonicalOptions
): Shape3D {
  const measurerRef = getTypeMeasurer();
  const run = measurerRef.run(char, plan.font);
  const vertical = measurerRef.vertical(plan.font);
  const flatGlyph = (): Shape3D =>
    sketchRunAtPen(char, line.fontSize, plan.font, x, baselineY).extrude(opts.extrusion);

  if (!run || !vertical) return flatGlyph();

  const inkCx = ((run.inkMinX + run.inkMaxX) / 2) * line.fontSize;
  const inkCy = ((run.inkMinY + run.inkMaxY) / 2) * line.fontSize;
  const endFactor = taperEndFactor(opts.taperDeg, opts.depth, vertical.capHeight * line.fontSize);
  if (endFactor >= 1) return flatGlyph();

  try {
    const tapered = sketchRunAtPen(char, line.fontSize, plan.font, -inkCx, -inkCy).extrude(
      opts.extrusion,
      {
        extrusionProfile: { profile: 'linear', endFactor },
      }
    );
    return translate(tapered, [x + inkCx, baselineY + inkCy, 0]);
  } catch {
    // A swept profile is more fragile than a prism, and a straight-walled glyph
    // is a far better outcome than a caption that vanishes.
    return flatGlyph();
  }
}
