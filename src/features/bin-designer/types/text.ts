/**
 * Style for text engraved/embossed/cut into label tabs and adjacent to cutouts.
 *
 * Scoping: `TextStyleDefaults` lives on `BinParams.textDefaults` (design-wide);
 * individual instances may attach a `TextStyleOverride` to selectively override
 * any subset of those fields.
 */

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

/** `fontSizeOverride` bypasses auto-fit and locks the size to a mm value. */
export type TextStyleOverride = Partial<TextStyleDefaults> & {
  readonly fontSizeOverride?: number;
};

/** Hard cap on a single text string — input above this is rejected. */
export const TEXT_MAX_LENGTH = 50;

export const DEFAULT_TEXT_STYLE_DEFAULTS: TextStyleDefaults = {
  font: 'atkinson',
  mode: 'engrave',
  depth: 0.4,
  margin: 1.5,
  minFontSize: 3,
  maxFontSize: 20,
} as const;
