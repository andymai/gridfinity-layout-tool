/** Rows in every glyph; `X` is a bin, `.` an empty socket. Strokes are two bins thick. */
export const GLYPH_ROWS = 14;

const GLYPHS: Readonly<Partial<Record<string, readonly string[]>>> = {
  '0': [
    '.XXXX.',
    'XXXXXX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XXXXXX',
    '.XXXX.',
  ],
  '1': [
    '..XX',
    '.XXX',
    'XXXX',
    '..XX',
    '..XX',
    '..XX',
    '..XX',
    '..XX',
    '..XX',
    '..XX',
    '..XX',
    '..XX',
    'XXXX',
    'XXXX',
  ],
  '2': [
    '.XXXX.',
    'XXXXXX',
    'XX..XX',
    '....XX',
    '....XX',
    '....XX',
    '...XXX',
    '..XXX.',
    '.XXX..',
    'XXX...',
    'XX....',
    'XX....',
    'XXXXXX',
    'XXXXXX',
  ],
  '3': [
    '.XXXX.',
    'XXXXXX',
    'XX..XX',
    '....XX',
    '....XX',
    '...XX.',
    '..XXX.',
    '..XXX.',
    '....XX',
    '....XX',
    '....XX',
    'XX..XX',
    'XXXXXX',
    '.XXXX.',
  ],
  '4': [
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XXXXXX',
    'XXXXXX',
    '....XX',
    '....XX',
    '....XX',
    '....XX',
    '....XX',
  ],
  '5': [
    'XXXXXX',
    'XXXXXX',
    'XX....',
    'XX....',
    'XX....',
    'XXXXX.',
    'XXXXXX',
    '....XX',
    '....XX',
    '....XX',
    '....XX',
    'XX..XX',
    'XXXXXX',
    '.XXXX.',
  ],
  '6': [
    '.XXXX.',
    'XXXXXX',
    'XX..XX',
    'XX....',
    'XX....',
    'XX....',
    'XXXXX.',
    'XXXXXX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XXXXXX',
    '.XXXX.',
  ],
  '7': [
    'XXXXXX',
    'XXXXXX',
    '....XX',
    '....XX',
    '...XXX',
    '...XX.',
    '..XXX.',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
  ],
  '8': [
    '.XXXX.',
    'XXXXXX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    '.XXXX.',
    'XXXXXX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XXXXXX',
    '.XXXX.',
  ],
  '9': [
    '.XXXX.',
    'XXXXXX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XX..XX',
    'XXXXXX',
    '.XXXXX',
    '....XX',
    '....XX',
    '....XX',
    'XX..XX',
    'XXXXXX',
    '.XXXX.',
  ],
};

/** Group separators as the locale writes them. */
const POINT = [...Array.from({ length: 12 }, () => '..'), 'XX', 'XX'];
const GAP = Array.from({ length: GLYPH_ROWS }, () => '.');
const SEPARATORS: Readonly<Partial<Record<string, readonly string[]>>> = {
  ',': POINT,
  '.': POINT,
  [String.fromCharCode(0x66c)]: POINT,
  "'": ['XX', 'XX', ...Array.from({ length: 12 }, () => '..')],
  ' ': GAP,
  [String.fromCharCode(0xa0)]: GAP,
  [String.fromCharCode(0x202f)]: GAP,
};

export interface DigitCell {
  /** Row from the top, 0 to 13. */
  readonly r: number;
  /** Column across the whole number. */
  readonly c: number;
  /** Which glyph the cell belongs to, left to right. */
  readonly glyph: number;
}

export interface DigitLayout {
  readonly cells: readonly DigitCell[];
  readonly cols: number;
  /**
   * The one bin that missed its socket: half a cell off the grid and resting
   * crooked in the last digit's lowest gap, or null for a number with no digit.
   */
  readonly stray: { readonly r: number; readonly c: number; readonly glyph: number } | null;
}

/**
 * The lowest resting gap in a glyph: inside a bowl (stroke on both sides)
 * where the glyph has one, as in 0, 4, 6, 8 and 9, else beside a stroke.
 */
function strayIn(rows: readonly string[]): { r: number; c: number } | null {
  const width = rows[0]?.length ?? 0;
  const filled = (r: number, c: number): boolean => rows[r]?.charAt(c) === 'X';
  const supported = (r: number, c: number): boolean =>
    !filled(r, c) && (r === GLYPH_ROWS - 1 || filled(r + 1, c));
  const bounded = (r: number, c: number): boolean => {
    const row = rows[r] ?? '';
    return row.slice(0, c).includes('X') && row.slice(c + 1).includes('X');
  };
  for (const inside of [true, false]) {
    for (let r = GLYPH_ROWS - 1; r >= 0; r--) {
      let best: { c: number; score: number } | null = null;
      for (let c = 0; c < width; c++) {
        if (!supported(r, c) || (inside && !bounded(r, c))) continue;
        const pair = c + 1 < width && supported(r, c + 1) && (!inside || bounded(r, c + 1));
        const right = pair ? c + 1 : c;
        const touching = (filled(r, c - 1) ? 1 : 0) + (filled(r, right + 1) ? 1 : 0);
        if (!inside && touching === 0) continue;
        const score = (pair ? 10 : 0) + touching + c * 0.01;
        if (!best || score > best.score) best = { c: pair ? c + 0.5 : c, score };
      }
      if (best) return { r, c: best.c };
    }
  }
  return null;
}

/** The number as bins in sockets, glyphs one empty column apart. */
export function buildDigits(text: string): DigitLayout {
  const cells: DigitCell[] = [];
  let col = 0;
  let glyph = 0;
  let stray: DigitLayout['stray'] = null;
  for (const char of text) {
    const rows = GLYPHS[char] ?? SEPARATORS[char];
    if (!rows) continue;
    if (glyph > 0) col += 1;
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++)
        if (row.charAt(c) === 'X') cells.push({ r, c: col + c, glyph });
    });
    if (GLYPHS[char]) {
      const spot = strayIn(rows);
      stray = spot ? { r: spot.r, c: col + spot.c, glyph } : stray;
    }
    col += rows[0]?.length ?? 0;
    glyph += 1;
  }
  return { cells, cols: col, stray };
}
