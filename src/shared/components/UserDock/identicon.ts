export const IDENTICON_GRID = 4;

const PATTERN_HALF_CELLS = (IDENTICON_GRID * IDENTICON_GRID) / 2;

// Hand-picked hues spaced around the wheel, each vetted to read well on both the
// light and dark dock surface at a fixed saturation/lightness. Avoids the muddy
// or neon results you get from hashing straight into raw HSL.
const IDENTICON_HUES = [210, 190, 162, 140, 95, 45, 25, 350, 320, 268] as const;

const SATURATION = 62;
const MUTED_SATURATION = 14;
// Top-to-bottom lightness ramp gives the filled cells subtle depth within a
// single hue, so the mark looks crafted rather than flat.
const ROW_LIGHTNESS = [60, 54, 49, 45] as const;

export interface Identicon {
  cells: boolean[];
  hue: number;
}

// FNV-1a (32-bit): tiny, well-distributed, and deterministic across runs.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function identiconFromSeed(seed: string): Identicon {
  const hash = hashSeed(seed);

  let pattern = hash & 0xff;
  const filled = popcount8(pattern);
  // Never render an all-empty or fully-solid mark — both read as broken.
  if (filled === 0) pattern |= 0b1;
  else if (filled === PATTERN_HALF_CELLS) pattern &= ~0b1;

  const cells: boolean[] = [];
  for (let row = 0; row < IDENTICON_GRID; row++) {
    const left = Boolean(pattern & (1 << (row * 2)));
    const right = Boolean(pattern & (1 << (row * 2 + 1)));
    // Mirror the left half onto the right so the mark is symmetric.
    cells.push(left, right, right, left);
  }

  const hue = IDENTICON_HUES[(hash >>> 8) % IDENTICON_HUES.length];
  return { cells, hue };
}

export function identiconCellColor(hue: number, row: number, muted: boolean): string {
  const saturation = muted ? MUTED_SATURATION : SATURATION;
  const lightness = ROW_LIGHTNESS[row] ?? 52;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function popcount8(value: number): number {
  let count = 0;
  for (let bit = 0; bit < 8; bit++) {
    if (value & (1 << bit)) count++;
  }
  return count;
}
