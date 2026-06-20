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
 * Which side of a cutout the engraved text sits on. Interpreted in WORLD
 * coordinates (top = +Y, bottom = -Y, left = -X, right = +X) — it does NOT
 * rotate with the cutout. The label is placed in the gap between the cutout's
 * rotation-aware AABB and the bin interior on that side, and the text reads
 * left-to-right regardless of cutout rotation. See
 * `@/shared/utils/cutoutLabel` (`cutoutLabelPlacement`), the single
 * placement implementation shared by the generation engraver and the 2D editor.
 */
export type CutoutTextSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * Nine-point anchor positioning a cutout's engraved label relative to the
 * cutout, in WORLD coordinates (it does NOT rotate with the cutout). The eight
 * outer points place the label in the gap between the cutout's rotation-aware
 * AABB and the bin interior on that side/corner; `center` places it over the
 * cutout face itself. A free `textOffset` (mm) nudges from the anchor and a
 * `textAngle` rotates the glyphs. Supersedes the legacy {@link CutoutTextSide}
 * (top/bottom/left/right map onto the four edge-center anchors). See
 * `@/shared/utils/cutoutLabel` (`cutoutLabelPlacement`) for the single
 * placement implementation shared by the generation engraver and the 2D editor.
 */
export type CutoutTextAnchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

/** Free fine-tune nudge (mm, WORLD coords) added to the anchored label center. */
export interface CutoutTextOffset {
  readonly x: number;
  readonly y: number;
}

/** Maps the legacy 4-side picker onto the 9-point anchor grid for migration. */
export const TEXT_SIDE_TO_ANCHOR: Record<CutoutTextSide, CutoutTextAnchor> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
} as const;

/** Anchor applied when neither `textAnchor` nor a legacy `textSide` is set. */
export const DEFAULT_CUTOUT_TEXT_ANCHOR: CutoutTextAnchor = 'top';

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
