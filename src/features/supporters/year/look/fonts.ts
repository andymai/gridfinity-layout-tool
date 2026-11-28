import anybodyLatin from '@fontsource-variable/anybody/files/anybody-latin-wdth-normal.woff2?url';
import anybodyLatinExt from '@fontsource-variable/anybody/files/anybody-latin-ext-wdth-normal.woff2?url';
import fredokaLatin from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url';
import fredokaLatinExt from '@fontsource-variable/fredoka/files/fredoka-latin-ext-wght-normal.woff2?url';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/**
 * Each display width is its own family. A face declared at one width pins the
 * variable font's width axis there, so canvas text (which has no stretch
 * control in every browser) draws the same condensed letters as the page.
 */
export const DISPLAY = '"Y26 Display"';
export const DISPLAY_TIGHT = '"Y26 Display Tight"';
export const DISPLAY_WIDE = '"Y26 Display Wide"';
export const TEXT = '"Y26 Text"';

interface FaceSpec {
  readonly family: string;
  readonly url: string;
  readonly range: string;
  readonly weight: string;
  readonly stretch?: string;
}

const DISPLAY_FACES: readonly [string, string][] = [
  [DISPLAY, '62%'],
  [DISPLAY_TIGHT, '52%'],
  [DISPLAY_WIDE, '80%'],
];

const FACES: readonly FaceSpec[] = [
  ...DISPLAY_FACES.flatMap(([family, stretch]) => [
    { family, url: anybodyLatin, range: LATIN, weight: '900', stretch },
    { family, url: anybodyLatinExt, range: LATIN_EXT, weight: '900', stretch },
  ]),
  { family: TEXT, url: fredokaLatin, range: LATIN, weight: '300 700' },
  { family: TEXT, url: fredokaLatinExt, range: LATIN_EXT, weight: '300 700' },
];

/**
 * Bold fallbacks for the scripts the two faces do not cover, in the order a
 * reader's device most likely has them. Characters outside the faces fall
 * through to these one by one.
 */
const SCRIPT_FALLBACKS: Readonly<Record<string, string>> = {
  ja: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", Meiryo',
  'zh-CN':
    '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei"',
  ko: '"Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", "Malgun Gothic"',
  ka: '"Noto Sans Georgian", "BPG Arial", Sylfaen',
  uk: '"Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial',
};
const LATIN_FALLBACK = '"Helvetica Neue", Arial';

/** Scripts without spaces between words, or with tall glyphs, need looser display lines. */
export function isLooseScript(locale: string): boolean {
  return locale === 'ja' || locale === 'zh-CN' || locale === 'ko' || locale === 'ka';
}

export function familyFor(face: string, locale: string): string {
  return `${face}, ${SCRIPT_FALLBACKS[locale] ?? LATIN_FALLBACK}, sans-serif`;
}

let registered = false;

/** False under jsdom and in browsers without the CSS Font Loading API. */
export function canLoadFonts(): boolean {
  return typeof document !== 'undefined' && 'fonts' in document && typeof FontFace !== 'undefined';
}

function register(): boolean {
  if (!canLoadFonts()) return false;
  if (registered) return true;
  for (const face of FACES) {
    document.fonts.add(
      new FontFace(face.family.replaceAll('"', ''), `url(${face.url}) format('woff2')`, {
        weight: face.weight,
        unicodeRange: face.range,
        display: 'block',
        ...(face.stretch ? { stretch: face.stretch } : {}),
      })
    );
  }
  registered = true;
  return true;
}

/** Past this the story starts with whatever is ready; the fallbacks still read. */
const LOAD_LIMIT_MS = 3000;

/**
 * Loads only the subsets the given text needs, in every face the cards use.
 * Text measured before its face loads would wrap against a fallback.
 */
export async function loadYearFonts(sample: string): Promise<void> {
  if (!register()) return;
  const text = `${sample} 0123456789×`;
  const loads = Promise.all([
    document.fonts.load(`900 100px ${DISPLAY}`, text),
    document.fonts.load(`900 100px ${DISPLAY_TIGHT}`, text),
    document.fonts.load(`900 100px ${DISPLAY_WIDE}`, text),
    document.fonts.load(`600 56px ${TEXT}`, text),
    document.fonts.load(`500 44px ${TEXT}`, text),
  ]).then(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, LOAD_LIMIT_MS);
  });
  await Promise.race([loads.catch(() => undefined), limit]);
  clearTimeout(timer);
}
