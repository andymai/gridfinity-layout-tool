/**
 * Where troika-three-text finds the fonts for 3D labels: our own copy of its
 * unicode-font-resolver data, written by `scripts/vendor-label-fonts.ts`. The
 * version is in the path, so the service worker can cache it CacheFirst.
 */
export const LABEL_FONT_DATA_PATH = '/fonts/unicode-font-resolver/1.0.1';

/**
 * Covers Latin text without the resolver. drei's `<Text>` preloads the string
 * "undefined" with no weight, which the resolver serves at weight 1, a face we
 * do not vendor: troika never calls back on a failed font, so every label
 * would stay suspended.
 */
export const LABEL_DEFAULT_FONT_FILE = 'font-files/latin/sans-serif.normal.400.woff';
