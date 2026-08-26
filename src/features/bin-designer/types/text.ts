/**
 * Style for text engraved/embossed/cut into label tabs, exterior surfaces and
 * the area adjacent to cutouts.
 *
 * Scoping is layered. `TextStyleDefaults` lives on `BinParams.textDefaults`
 * (design-wide); an instance may attach a `TextStyleOverride` selecting any
 * subset of those fields. Surface text adds a third layer: a shared style over
 * the defaults, then a per-surface style over that. {@link resolveTextStyle}
 * is the only place that ordering is expressed.
 *
 * Every field added after the original six defaults to the behaviour that
 * predated it, so a design saved before this existed renders unchanged. The
 * curated looks live in {@link TEXT_PRESETS} and are applied by writing fields,
 * never by storing a preset id: a stored id and the fields it implies can
 * disagree, and then neither is authoritative.
 */

export type TextMode = 'engrave' | 'emboss' | 'through-cut';

/**
 * Bundled font family. `allerta-stencil` is auto-substituted when
 * `mode === 'through-cut'` regardless of the picked family because
 * non-stencil glyphs have free-floating counter islands.
 *
 * Only the first three load at worker init. The rest are fetched on first use
 * (`ensureFontsLoaded`), because the four added faces total roughly 600kB and
 * a design references at most a couple of them.
 */
export type TextFontFamily =
  | 'atkinson'
  | 'atkinson-bold'
  | 'jetbrains-mono'
  | 'jetbrains-mono-bold'
  | 'barlow-condensed'
  | 'poppins'
  | 'allerta-stencil';

export const TEXT_FONT_FAMILIES: readonly TextFontFamily[] = [
  'atkinson',
  'atkinson-bold',
  'jetbrains-mono',
  'jetbrains-mono-bold',
  'barlow-condensed',
  'poppins',
  'allerta-stencil',
] as const;

/**
 * Families present before lazy loading existed. They stay eager so a design
 * that predates the expanded library never waits on a fetch, and so text
 * generation still works if the on-demand path fails.
 */
export const EAGER_TEXT_FONT_FAMILIES: readonly TextFontFamily[] = [
  'atkinson',
  'jetbrains-mono',
  'allerta-stencil',
] as const;

/**
 * The heavier cut of a family, where one is bundled. Used by the stem-width
 * guard's one-click fix: at a size the design has already committed to, moving
 * to the bold is the correction that does not change the layout.
 */
export const TEXT_FONT_BOLD_OF: Partial<Record<TextFontFamily, TextFontFamily>> = {
  atkinson: 'atkinson-bold',
  'jetbrains-mono': 'jetbrains-mono-bold',
} as const;

/**
 * Nine-point anchor. The names are shared by every text host, but each host
 * resolves them against its own frame:
 *
 *  - surfaces (wall, lid, tab, plate) place the text INSIDE the host rect, so
 *    `bottom-left` means flush to the bottom-left corner inset by `margin`
 *  - cutout labels place the outer eight OUTSIDE the cutout's rotation-aware
 *    AABB, in the gap between it and the bin interior, and `center` over the
 *    cutout face itself
 *
 * Always interpreted in WORLD coordinates: an anchor does not rotate with its
 * host. See `@/shared/utils/typePlan` for the surface resolution and
 * `@/shared/utils/cutoutLabel` for the cutout one.
 */
export type TextAnchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export const TEXT_ANCHORS: readonly TextAnchor[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;

/** Cutout labels named the nine points first; it is the same set. */
export type CutoutTextAnchor = TextAnchor;

/** Legacy 4-side picker for cutout labels, retained for migration. */
export type CutoutTextSide = 'top' | 'bottom' | 'left' | 'right';

/** Maps the legacy 4-side picker onto the 9-point anchor grid for migration. */
export const TEXT_SIDE_TO_ANCHOR: Record<CutoutTextSide, TextAnchor> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
} as const;

/** Free fine-tune nudge (mm, WORLD coords) added to the anchored position. */
export interface TextOffset {
  readonly x: number;
  readonly y: number;
}

/** Cutout labels named the offset first; it is the same shape. */
export type CutoutTextOffset = TextOffset;

export const ZERO_TEXT_OFFSET: TextOffset = { x: 0, y: 0 } as const;

/**
 * How the rendered size is chosen.
 *
 * `auto` fits the largest size the host holds, which is why an untouched set of
 * bins prints a different size on every one. `fixed` honours {@link
 * TextStyleDefaults.fixedSize} and only departs from it when the text cannot
 * physically be made to fit, which is what lets a drawer read as one family.
 */
export type TextSizeMode = 'auto' | 'fixed';

/**
 * Discrete sizes auto-fit snaps down to when
 * {@link TextStyleDefaults.snapToScale} is set. Snapping DOWN (never up) keeps
 * the guarantee that a fitted size fits, while collapsing the continuum onto a
 * shared rhythm so two differently-sized bins usually land on the same step.
 */
export const TYPE_SCALE_MM: readonly number[] = [
  2.5, 3, 3.5, 4, 5, 6, 8, 10, 12, 16, 20, 26, 32,
] as const;

/** Largest scale step at or below `size`, or `min` when every step is above it. */
export function snapToTypeScale(size: number, min: number): number {
  let best = min;
  for (const step of TYPE_SCALE_MM) {
    if (step <= size && step >= min && step > best) best = step;
  }
  return Math.min(best, size);
}

/**
 * Case applied when building geometry. The stored string is never rewritten, so
 * turning the transform off restores exactly what the user typed.
 *
 * `title` upper-cases the first letter of each word and leaves the remaining
 * letters alone, rather than lower-casing them: a caption is as likely to hold
 * `DIN`, `M3` or `PH2` as an ordinary word, and a true title-caser mangles all
 * three.
 */
export type TextCase = 'as-typed' | 'upper' | 'title';

export const TEXT_CASES: readonly TextCase[] = ['as-typed', 'upper', 'title'] as const;

export function applyTextCase(text: string, textCase: TextCase): string {
  if (textCase === 'upper') return text.toUpperCase();
  if (textCase === 'title') {
    return text.replace(/(^|\s)(\S)/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
  }
  return text;
}

/**
 * Section shape of the glyph walls.
 *
 * `straight` is a prismatic pocket, which reads as CAD output under any light.
 * `drafted` tapers the walls by {@link TextStyleDefaults.draftAngleDeg} so an
 * engraving catches a shadow line and an emboss gets a broken base instead of a
 * square shoulder that lifts.
 */
export type TextCutProfile = 'straight' | 'drafted';

export const TEXT_CUT_PROFILES: readonly TextCutProfile[] = ['straight', 'drafted'] as const;

/** Bounds on the draft angle. Past the upper bound a shallow cut closes on itself. */
export const MIN_TEXT_DRAFT_DEG = 3;
export const MAX_TEXT_DRAFT_DEG = 30;

export interface TextStyleDefaults {
  readonly font: TextFontFamily;
  readonly mode: TextMode;
  /** Engrave depth or emboss height in mm. */
  readonly depth: number;
  /**
   * Padding to the host edge, in mm. For a centered anchor this is the
   * auto-fit budget; for an edge or corner anchor it is also the inset the text
   * sits at, so it is what makes a set of bins share one datum.
   */
  readonly margin: number;
  /** Auto-fit floor in mm; legibility minimum. */
  readonly minFontSize: number;
  /** Auto-fit ceiling in mm. */
  readonly maxFontSize: number;
  /** Where the text sits within its host. Default `center` (pre-anchor behaviour). */
  readonly anchor: TextAnchor;
  /** Nudge from the anchored position, in mm. */
  readonly offset: TextOffset;
  readonly sizeMode: TextSizeMode;
  /** Rendered size in mm when `sizeMode === 'fixed'`. */
  readonly fixedSize: number;
  /** Snap an auto-fitted size down onto {@link TYPE_SCALE_MM}. */
  readonly snapToScale: boolean;
  /**
   * Resolve ONE size shared by every WALL that carries text, rather than
   * fitting each independently, so a bin does not read 12mm on the front and
   * 7mm on the left. Only meaningful under `sizeMode: 'auto'`.
   *
   * Walls and not every surface, deliberately. The lid is a separately printed
   * part whose host box only exists inside the lid pipeline, and pulling it out
   * to unify against would mean re-deriving the lid footprint in a second place.
   * A design that wants one size across the bin AND its lid AND its siblings
   * sets a fixed size, which is what the Engineering preset does and what makes
   * a whole drawer read as one family.
   */
  readonly uniformAcrossWalls: boolean;
  /** Letter-spacing in em, so it scales with the rendered size. */
  readonly tracking: number;
  /**
   * Open tracking automatically as the rendered size falls, keeping the gap
   * between adjacent glyphs above {@link MIN_GLYPH_GAP_MM}. Adds to
   * {@link tracking} rather than replacing it.
   */
  readonly autoTracking: boolean;
  readonly textCase: TextCase;
  /**
   * Size of every line after the first, as a fraction of the first line's size.
   * `1` renders a uniform block; the preset value renders line two as a
   * subheading. Applies to explicit line breaks only, never to lines produced
   * by auto-wrapping, which are continuations of one phrase.
   */
  readonly lineScale: number;
  /** Leading between baselines, in em of the larger of the two adjacent lines. */
  readonly lineGap: number;
  readonly cutProfile: TextCutProfile;
  /** Wall taper in degrees when `cutProfile === 'drafted'`. */
  readonly draftAngleDeg: number;
}

/**
 * `fontSizeOverride` caps auto-fit at a fixed mm value (clamped to the band, so
 * it only ever shrinks the label below what auto-fit would pick). It predates
 * {@link TextSizeMode} and means something different: an override is a ceiling,
 * `sizeMode: 'fixed'` is an instruction. When `sizeMode` is `'fixed'` the
 * override is ignored.
 */
export type TextStyleOverride = Partial<TextStyleDefaults> & {
  readonly fontSizeOverride?: number;
};

/**
 * Layer style overrides onto the design defaults, later layers winning
 * field-by-field. Undefined entries and undefined fields are skipped, so a
 * sparse override never resets a field it does not mention.
 */
export function resolveTextStyle(
  defaults: TextStyleDefaults,
  ...layers: readonly (TextStyleOverride | undefined)[]
): TextStyleDefaults & { readonly fontSizeOverride?: number } {
  let out: TextStyleDefaults & { fontSizeOverride?: number } = { ...defaults };
  for (const layer of layers) {
    if (layer) out = { ...out, ...dropUndefined(layer) };
  }
  return out;
}

/** Spreading a sparse override directly would let an explicit `undefined` reset
 *  a field the layer never meant to mention. */
function dropUndefined<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return out;
}

/**
 * Set (`size` in mm) or clear (`null`) the label-size override on a text style,
 * preserving any other override fields. Returns `undefined` when the result
 * would be an empty object so the style key can be dropped rather than left as
 * `{}`. Shared by the cutout inspector and the label-tab panel.
 */
export function withFontSizeOverride(
  current: TextStyleOverride | undefined,
  size: number | null
): TextStyleOverride | undefined {
  const { fontSizeOverride: _drop, ...rest } = current ?? {};
  if (size === null) return Object.keys(rest).length > 0 ? rest : undefined;
  return { ...rest, fontSizeOverride: size };
}

/**
 * Set (`size` in mm) or clear (`null`) an exact label size on a text style:
 * `sizeMode: 'fixed'` plus the size, which generation treats as a target
 * rather than a ceiling. Setting or clearing also drops any legacy
 * `fontSizeOverride` — the two mechanisms answer the same question, so leaving
 * the ceiling behind would silently cap a design that just asked for exact.
 * Returns `undefined` when the result would be empty, like
 * {@link withFontSizeOverride}.
 */
export function withExactLabelSize(
  current: TextStyleOverride | undefined,
  size: number | null
): TextStyleOverride | undefined {
  const { fontSizeOverride: _o, sizeMode: _m, fixedSize: _f, ...rest } = current ?? {};
  if (size === null) return Object.keys(rest).length > 0 ? rest : undefined;
  return { ...rest, sizeMode: 'fixed', fixedSize: size };
}

/** Hard cap on a single LINE of text. Input above this is rejected. */
export const TEXT_MAX_LENGTH = 50;

/** Lines a single caption may hold. */
export const TEXT_MAX_LINES = 3;

/**
 * Cap on a whole multi-line caption, counting the separators. The server
 * mirrors this number, so the client has to truncate to it rather than merely
 * refusing above it: an honest oversized paste must arrive clamped, not
 * silently dropped by a 400.
 */
export const TEXT_MAX_TOTAL_LENGTH = TEXT_MAX_LENGTH * TEXT_MAX_LINES + (TEXT_MAX_LINES - 1);

/**
 * Clamp a caption to the line, per-line length and total budgets, normalising
 * line endings first so a paste from a text editor does not consume a line of
 * budget per CR.
 */
export function normalizeTextInput(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .slice(0, TEXT_MAX_LINES)
    .map((line) => line.slice(0, TEXT_MAX_LENGTH))
    .join('\n')
    .slice(0, TEXT_MAX_TOTAL_LENGTH);
}

/**
 * Explicit lines of a caption, trimmed, with empties dropped. Blank lines are
 * removed rather than rendered: an empty run builds no geometry, so keeping it
 * would only push the following line off the anchor by a leading it never
 * visually occupies.
 */
export function splitTextLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** Outer wall that can carry surface text. Same axis convention as the bin. */
export type WallTextSide = 'front' | 'back' | 'left' | 'right';
export const WALL_TEXT_SIDES: readonly WallTextSide[] = ['front', 'back', 'left', 'right'] as const;

/**
 * Legacy vertical alignment of wall text, one knob shared by all four walls.
 * Superseded by {@link TextAnchor}; retained so `migrateSurfaceText` can fold a
 * persisted value into `style.anchor` (horizontal was always centered, so the
 * three values map exactly onto `top`, `center` and `bottom`).
 */
export type WallTextVerticalAlign = 'top' | 'center' | 'bottom';
export const WALL_TEXT_ALIGNS: readonly WallTextVerticalAlign[] = [
  'top',
  'center',
  'bottom',
] as const;

export const WALL_ALIGN_TO_ANCHOR: Record<WallTextVerticalAlign, TextAnchor> = {
  top: 'top',
  center: 'center',
  bottom: 'bottom',
} as const;

/**
 * Text on the design's exterior surfaces. One shared style for all surface
 * text (merged over `BinParams.textDefaults`), optionally refined per surface,
 * with a string per surface.
 *
 * Absent object or absent/empty strings mean no surface text; store setters
 * drop the key entirely rather than persisting `{}` so pre-feature designs
 * serialize byte-identically.
 */
export interface SurfaceTextConfig {
  /**
   * Text on the lid's top face, or the tray floor when the lid has a tray
   * recess, or the recessed floor inside the lip on a lip-only stack top.
   * Ignored under a FULL stack grid (no flat face left) or on a bin with a
   * polygon `cellMask` (auto-fit assumes a rectangle).
   */
  readonly lidText?: string;
  /**
   * Per-wall text on the bin's outer walls. Each string fits into the largest
   * clear region on its wall (avoiding wall cutouts and handles, and clearing
   * any wall pattern behind it). Ignored for polygon `cellMask` bins and for
   * walls occupied by slots (slotted style).
   */
  readonly walls?: Partial<Record<WallTextSide, string>>;
  /** Legacy shared vertical alignment. Migrated into `style.anchor`. */
  readonly wallAlign?: WallTextVerticalAlign;
  /** Shared style for all surface text, merged over `textDefaults`. */
  readonly style?: TextStyleOverride;
  /** Lid-only refinement, merged over {@link style}. */
  readonly lidStyle?: TextStyleOverride;
  /** Per-wall refinement, merged over {@link style}. */
  readonly wallStyles?: Partial<Record<WallTextSide, TextStyleOverride>>;
}

/**
 * Neutral defaults: the six original fields at their historical values, and
 * every field added since set to the behaviour that predated it. A design
 * migrated from before the type system therefore renders as it always did,
 * while a design created after it starts from {@link TEXT_PRESETS.engineering}.
 */
export const DEFAULT_TEXT_STYLE_DEFAULTS: TextStyleDefaults = {
  font: 'atkinson',
  mode: 'engrave',
  depth: 0.4,
  margin: 1.5,
  minFontSize: 3,
  maxFontSize: 20,
  anchor: 'center',
  offset: ZERO_TEXT_OFFSET,
  sizeMode: 'auto',
  fixedSize: 6,
  snapToScale: false,
  uniformAcrossWalls: false,
  tracking: 0,
  autoTracking: false,
  textCase: 'as-typed',
  lineScale: 1,
  lineGap: 0.3,
  cutProfile: 'straight',
  draftAngleDeg: 12,
} as const;

export type TextPresetId = 'engineering' | 'utility-mono' | 'condensed-display' | 'classic';

export const TEXT_PRESET_IDS: readonly TextPresetId[] = [
  'engineering',
  'utility-mono',
  'condensed-display',
  'classic',
] as const;

/**
 * Curated looks. A preset is a complete style, not a patch: applying one
 * replaces every field it names so switching between two never leaves a knob
 * from the previous one behind.
 */
export const TEXT_PRESETS: Record<TextPresetId, TextStyleDefaults> = {
  engineering: {
    ...DEFAULT_TEXT_STYLE_DEFAULTS,
    font: 'atkinson-bold',
    margin: 3,
    anchor: 'bottom-left',
    sizeMode: 'fixed',
    fixedSize: 6,
    uniformAcrossWalls: true,
    tracking: 0.08,
    autoTracking: true,
    textCase: 'upper',
    lineScale: 0.6,
    cutProfile: 'drafted',
  },
  'utility-mono': {
    ...DEFAULT_TEXT_STYLE_DEFAULTS,
    font: 'jetbrains-mono-bold',
    depth: 0.5,
    margin: 2.5,
    anchor: 'bottom-left',
    sizeMode: 'fixed',
    fixedSize: 5,
    uniformAcrossWalls: true,
    autoTracking: true,
    textCase: 'upper',
    lineScale: 0.7,
    cutProfile: 'drafted',
  },
  'condensed-display': {
    ...DEFAULT_TEXT_STYLE_DEFAULTS,
    font: 'barlow-condensed',
    depth: 0.5,
    margin: 3,
    anchor: 'bottom-left',
    sizeMode: 'fixed',
    fixedSize: 9,
    uniformAcrossWalls: true,
    tracking: 0.04,
    autoTracking: true,
    textCase: 'upper',
    lineScale: 0.55,
    cutProfile: 'drafted',
  },
  classic: DEFAULT_TEXT_STYLE_DEFAULTS,
} as const;

/** Fields a preset is defined by. Comparing only these keeps the panel's
 *  "which preset is active" answer stable when an unrelated default changes. */
const PRESET_KEYS = [
  'font',
  'mode',
  'depth',
  'margin',
  'anchor',
  'sizeMode',
  'fixedSize',
  'uniformAcrossWalls',
  'tracking',
  'autoTracking',
  'textCase',
  'lineScale',
  'cutProfile',
] as const satisfies readonly (keyof TextStyleDefaults)[];

/**
 * Which preset a resolved style corresponds to, or `null` for a custom style.
 * Derived rather than stored so the panel can never claim a preset the geometry
 * does not reflect.
 */
export function matchTextPreset(style: TextStyleDefaults): TextPresetId | null {
  for (const id of TEXT_PRESET_IDS) {
    const preset = TEXT_PRESETS[id];
    if (PRESET_KEYS.every((key) => style[key] === preset[key])) return id;
  }
  return null;
}

/**
 * Smallest gap the slicer can resolve between two adjacent glyph edges, in mm.
 * Below roughly one extrusion width the wall between them is dropped and the
 * letters print merged. Drives {@link TextStyleDefaults.autoTracking}.
 */
export const MIN_GLYPH_GAP_MM = 0.45;

/**
 * Gap a typical sans leaves between adjacent glyphs at 1em, from the pair of
 * side bearings. Used only to decide how much tracking to ADD: the authority on
 * whether a run actually prints is the measured stem-width guard, which does
 * not estimate.
 */
export const NOMINAL_GLYPH_GAP_EM = 0.06;

/** Extra tracking (em) needed to hold {@link MIN_GLYPH_GAP_MM} at `fontSize`. */
export function autoTrackingEm(fontSize: number): number {
  if (fontSize <= 0) return 0;
  const natural = NOMINAL_GLYPH_GAP_EM * fontSize;
  if (natural >= MIN_GLYPH_GAP_MM) return 0;
  return (MIN_GLYPH_GAP_MM - natural) / fontSize;
}
