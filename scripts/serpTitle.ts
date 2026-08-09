/**
 * SERP title width estimation.
 *
 * Google truncates the search-result title by rendered pixel width, not by
 * character count, so a char budget misjudges both narrow titles (which fit far
 * more than their length suggests) and the CJK locales, where every glyph is
 * full-width and a 30-char title is already twice the budget of a 30-char Latin
 * one.
 *
 * Widths are Arial advance units per 1000 em. Google renders desktop titles in
 * a 20px Arial-metric font, so `units / 1000 * 20` is the pixel width.
 */

const ADVANCE_GROUPS: ReadonlyArray<readonly [number, string]> = [
  [222, "ijl'"],
  [278, ' !,./:;I[]ft|'],
  [333, '()-`r'],
  [500, 'JckLsvxyz'],
  [584, '+<=>~'],
  [611, 'FTZ'],
  [667, '&ABEKPSVXY'],
  [722, 'CDHNRU'],
  [778, 'GOQ'],
  [833, 'Mm'],
  [889, '%'],
  [944, 'W'],
  [1000, '—@'],
];

const ADVANCE = new Map<string, number>(
  ADVANCE_GROUPS.flatMap(([width, chars]) => [...chars].map((c) => [c, width] as const))
);

/** Latin lowercase, digits, and anything else unlisted. */
const DEFAULT_ADVANCE = 556;

/**
 * CJK, Hangul, and the fullwidth forms all occupy one em. `zh-CN` and `ko`
 * titles are made almost entirely of these, so treating them as
 * DEFAULT_ADVANCE would under-count their width by roughly 80%.
 */
function isFullWidth(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}

const TITLE_FONT_PX = 20;

/**
 * Google's desktop title column. Titles wider than this are cut with an
 * ellipsis. The exact point drifts a few pixels between renderings, so leave
 * the tail of a title expendable rather than budgeting to the last pixel.
 */
export const SERP_TITLE_MAX_PX = 580;

export function estimateTitlePx(text: string): number {
  let units = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    units += isFullWidth(codePoint) ? 1000 : (ADVANCE.get(char) ?? DEFAULT_ADVANCE);
  }
  return (units / 1000) * TITLE_FONT_PX;
}

/**
 * Append the brand suffix only when the whole title still fits.
 *
 * A suffix that truncates is worse than no suffix: it never renders, and on the
 * way out it eats the tail of the unique title, which does.
 */
export function composeSerpTitle(title: string, siteName: string): string {
  const withBrand = `${title} | ${siteName}`;
  return estimateTitlePx(withBrand) <= SERP_TITLE_MAX_PX ? withBrand : title;
}
