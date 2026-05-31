export const IDENTICON_GRID = 4;

// Hand-picked hues spaced around the cool half of the wheel, deliberately kept
// clear of the sync-status badge colors (green idle ~142°, blue syncing ~221°,
// amber offline ~33°, red error ~0°) so the corner badge always reads against
// the grid. Each is vetted at the fixed saturation/lightness below.
const IDENTICON_HUES = [174, 190, 250, 264, 280, 298, 314, 330] as const;

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

// The left half of the grid (8 cells = bits 0-7) drives the pattern; the right
// half mirrors it. Balance the raw bits so no mark looks half-rendered: keep
// both vertical halves populated, enforce a minimum density, and never fully
// solid. Top nibble (bits 0-3) = rows 0-1, bottom nibble (bits 4-7) = rows 2-3.
function balancedPattern(hash: number): number {
  let pattern = hash & 0xff;
  if ((pattern & 0x0f) === 0) pattern |= 1 << ((hash >>> 16) & 0x3);
  if ((pattern & 0xf0) === 0) pattern |= 0x10 << ((hash >>> 18) & 0x3);

  let salt = (hash >>> 20) & 0x7;
  while (popcount8(pattern) < 3) {
    pattern |= 1 << (salt & 0x7);
    salt++;
  }
  if (popcount8(pattern) === 8) pattern &= ~(1 << ((hash >>> 24) & 0x7));
  return pattern;
}

export function identiconFromSeed(seed: string): Identicon {
  const hash = hashSeed(seed);
  const pattern = balancedPattern(hash);

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

// Extract the hue from a 6-digit hex color so collaborator avatars can keep
// their session-assigned distinct colors while adopting the identicon style.
export function hueFromHex(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue = Math.round(hue * 60);
  return hue < 0 ? hue + 360 : hue;
}

function popcount8(value: number): number {
  let count = 0;
  for (let bit = 0; bit < 8; bit++) {
    if (value & (1 << bit)) count++;
  }
  return count;
}
