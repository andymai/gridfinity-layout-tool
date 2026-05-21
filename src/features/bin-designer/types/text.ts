/**
 * Embedded text type definitions.
 *
 * Text engraved/embossed/cut into label tabs and adjacent to cutouts.
 * Geometry is produced by `textBuilder` at generation time using
 * brepjs `sketchText` + `extrude`. Fonts are loaded once at worker init.
 *
 * Style is scoped: `TextStyleDefaults` lives on `BinParams.textDefaults`
 * (design-wide defaults) and individual instances may attach a
 * `TextStyleOverride` to selectively override fields.
 */

/** Geometry interaction mode of an engraved text instance. */
export type TextMode = 'engrave' | 'emboss' | 'through-cut';

/**
 * Bundled font family. `allerta-stencil` is auto-substituted when
 * `mode === 'through-cut'` regardless of the picked family because
 * non-stencil glyphs have free-floating counter islands.
 */
export type TextFontFamily = 'atkinson' | 'jetbrains-mono' | 'allerta-stencil';

/**
 * Which side of a cutout the engraved text sits on, expressed in the
 * cutout's local frame (rotates with the cutout). Text orientation
 * itself stays world-aligned for legibility.
 */
export type CutoutTextSide = 'top' | 'bottom' | 'left' | 'right';

/** Design-level defaults inherited by every text instance unless overridden. */
export interface TextStyleDefaults {
  readonly font: TextFontFamily;
  readonly mode: TextMode;
  /** Engrave depth or emboss height in mm. */
  readonly depth: number;
  /** Padding to host edge for auto-fit, in mm. */
  readonly margin: number;
  /** Auto-fit floor in mm; legibility minimum. */
  readonly minFontSize: number;
  /** Auto-fit ceiling in mm. */
  readonly maxFontSize: number;
}

/**
 * Per-instance override. Any subset of `TextStyleDefaults`, plus an
 * optional `fontSizeOverride` that bypasses auto-fit and locks the
 * rendered size to an explicit mm value.
 */
export type TextStyleOverride = Partial<TextStyleDefaults> & {
  readonly fontSizeOverride?: number;
};

/** Hard upper bound on a single text string. Beyond this, input is rejected. */
export const TEXT_MAX_LENGTH = 50;

/** Soft warning threshold for input length. */
export const TEXT_WARN_LENGTH = 20;

/** Default engraved-text style applied to every text instance unless overridden. */
export const DEFAULT_TEXT_STYLE_DEFAULTS: TextStyleDefaults = {
  font: 'atkinson',
  mode: 'engrave',
  depth: 0.4,
  margin: 1.5,
  minFontSize: 3,
  maxFontSize: 20,
} as const;
