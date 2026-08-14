/**
 * Sizing ladder for a floor label that has to fit a fixed horizontal band.
 *
 * troika reports glyph metrics only after it lays text out, so the caller
 * measures once at `baseFontSize` with wrapping disabled and passes the
 * resulting width in here. Every rung below is derived from that one
 * measurement: shrink onto a single line, then wrap, then shrink the wrapped
 * block, then truncate.
 *
 * Line counts are predicted from width alone, so a ragged string can land a
 * line over `maxLines`. That is deliberate — the label is top-anchored, so an
 * extra line grows into empty floor instead of into the dimension drawing
 * above it, and holding the cap exactly would cost a second async pass.
 */

export interface FloorLabelFit {
  fontSize: number;
  /** `undefined` keeps the text on one line; a number lets troika soft-wrap. */
  maxWidth: number | undefined;
  text: string;
}

export interface FloorLabelFitOptions {
  /** The string as it will render, already case-folded by the caller. */
  text: string;
  /** Width of `text` laid out at `baseFontSize` on a single line. */
  naturalWidth: number;
  /** Horizontal room the label may occupy, in the caller's scene units. */
  band: number;
  baseFontSize: number;
  minFontSize: number;
  maxLines: number;
}

const ELLIPSIS = '…';

export function fitFloorLabel({
  text,
  naturalWidth,
  band,
  baseFontSize,
  minFontSize,
  maxLines,
}: FloorLabelFitOptions): FloorLabelFit {
  const unwrapped: FloorLabelFit = { fontSize: baseFontSize, maxWidth: undefined, text };

  if (text.length === 0 || !Number.isFinite(naturalWidth) || naturalWidth <= 0 || band <= 0) {
    return unwrapped;
  }
  if (naturalWidth <= band) return unwrapped;

  const singleLineFontSize = (baseFontSize * band) / naturalWidth;
  if (singleLineFontSize >= minFontSize) {
    return { fontSize: singleLineFontSize, maxWidth: undefined, text };
  }

  const wrappedCapacity = band * maxLines;
  if (naturalWidth <= wrappedCapacity) {
    return { fontSize: baseFontSize, maxWidth: band, text };
  }

  const wrappedFontSize = (baseFontSize * wrappedCapacity) / naturalWidth;
  if (wrappedFontSize >= minFontSize) {
    return { fontSize: wrappedFontSize, maxWidth: band, text };
  }

  const keepRatio = (wrappedCapacity * baseFontSize) / (naturalWidth * minFontSize);
  return { fontSize: minFontSize, maxWidth: band, text: truncate(text, keepRatio) };
}

type ClusterSplitter = (text: string) => string[];

let splitter: ClusterSplitter | undefined;

/**
 * Cutting on grapheme clusters, not UTF-16 units, so a name ending in an emoji
 * loses the whole emoji rather than half a surrogate pair or the tail of a
 * joined sequence.
 */
function truncate(text: string, keepRatio: number): string {
  splitter ??= makeSplitter();
  const clusters = splitter(text);
  const keep = Math.max(1, Math.floor(clusters.length * keepRatio) - ELLIPSIS.length);
  return `${clusters.slice(0, keep).join('').trimEnd()}${ELLIPSIS}`;
}

/**
 * Falls back to code points where `Intl.Segmenter` is missing (Firefox below
 * 125, Node without full ICU) — still surrogate-pair safe, only blind to
 * joined sequences. Truncating a name must never throw.
 */
function makeSplitter(): ClusterSplitter {
  if (typeof Intl.Segmenter !== 'function') return (text) => Array.from(text);
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return (text) => Array.from(segmenter.segment(text), (segment) => segment.segment);
}
