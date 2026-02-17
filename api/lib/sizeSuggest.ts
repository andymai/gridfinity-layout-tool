/**
 * Size Suggestion Scoring and Position Ranking
 *
 * Aggregates ML telemetry signals to suggest optimal bin sizes and grid positions.
 */

export interface FreqMap {
  [key: string]: number;
}

export interface ScoreInput {
  drawerFreq: FreqMap;
  transitionFreq: FreqMap;
  labelFreq: FreqMap;
  correctionFreq: FreqMap;
}

export interface ScoredSize {
  size: string;
  score: number;
}

export interface OccupiedRect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface DrawerSize {
  width: number;
  depth: number;
}

export interface Position {
  x: number;
  y: number;
}

/**
 * Normalize a frequency map to sum to 1.0.
 * Returns empty object if input is empty or all values are zero.
 */
function normalizeFreqMap(freq: FreqMap): FreqMap {
  const total = Object.values(freq).reduce((sum, val) => sum + val, 0);
  if (total === 0) {
    return {};
  }
  const normalized: FreqMap = {};
  for (const [key, val] of Object.entries(freq)) {
    normalized[key] = val / total;
  }
  return normalized;
}

/**
 * Score bin sizes based on multiple ML telemetry signals.
 *
 * Weights:
 * - 0.3 drawer frequency (what sizes are common for this drawer?)
 * - 0.4 transition frequency (what size follows the previous one?)
 * - 0.2 label frequency (what sizes are used with these labels?)
 * - -0.1 correction penalty (sizes that get quickly corrected are bad)
 *
 * When optional signals are absent, their weight is redistributed to drawer frequency.
 * Returns top 3 scored sizes, sorted descending by score.
 * Returns empty array if no candidate sizes exist.
 */
export function scoreSizes(input: ScoreInput): ScoredSize[] {
  const { drawerFreq, transitionFreq, labelFreq, correctionFreq } = input;

  // Normalize all frequency maps
  const normDrawer = normalizeFreqMap(drawerFreq);
  const normTransition = normalizeFreqMap(transitionFreq);
  const normLabel = normalizeFreqMap(labelFreq);
  const normCorrection = normalizeFreqMap(correctionFreq);

  // Calculate effective weights based on available signals
  let drawerWeight = 0.3;
  const transitionWeight = Object.keys(normTransition).length > 0 ? 0.4 : 0;
  const labelWeight = Object.keys(normLabel).length > 0 ? 0.2 : 0;

  // Redistribute missing weights to drawer
  const missingWeight = 0.4 - transitionWeight + 0.2 - labelWeight;
  drawerWeight += missingWeight;

  // Collect all candidate sizes
  const allSizes = new Set<string>();
  for (const size of Object.keys(normDrawer)) {
    allSizes.add(size);
  }
  for (const size of Object.keys(normTransition)) {
    allSizes.add(size);
  }
  for (const size of Object.keys(normLabel)) {
    allSizes.add(size);
  }

  if (allSizes.size === 0) {
    return [];
  }

  // Score each size
  const scored: ScoredSize[] = [];
  for (const size of allSizes) {
    let score = 0;

    score += (normDrawer[size] ?? 0) * drawerWeight;
    score += (normTransition[size] ?? 0) * transitionWeight;
    score += (normLabel[size] ?? 0) * labelWeight;
    score -= (normCorrection[size] ?? 0) * 0.1;

    scored.push({ size, score });
  }

  // Sort descending by score and return top 3
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

/**
 * Parse size string (e.g., "2x1") into { width, depth }.
 * Returns null for invalid format.
 */
function parseSize(size: string): { width: number; depth: number } | null {
  const match = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(size);
  if (!match) {
    return null;
  }
  const width = parseFloat(match[1]);
  const depth = parseFloat(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) {
    return null;
  }
  return { width, depth };
}

/**
 * Check if a position is valid (no collision with occupied rects, within drawer bounds).
 */
function isValidPosition(
  x: number,
  y: number,
  width: number,
  depth: number,
  occupied: readonly OccupiedRect[],
  drawer: DrawerSize
): boolean {
  // Check drawer bounds
  if (x < 0 || y < 0 || x + width > drawer.width || y + depth > drawer.depth) {
    return false;
  }

  // Check collision with occupied rectangles
  for (const rect of occupied) {
    const noOverlap =
      x + width <= rect.x ||
      x >= rect.x + rect.width ||
      y + depth <= rect.y ||
      y >= rect.y + rect.depth;

    if (!noOverlap) {
      return false;
    }
  }

  return true;
}

/**
 * Rank grid positions for a given bin size.
 * Scans bottom-left to top-right in 0.5 steps (half-bin support).
 * Returns first position with no collision, or null if grid is full.
 */
export function rankPositions(
  size: string,
  occupied: readonly OccupiedRect[],
  drawer: DrawerSize,
  _edgeUsage: unknown
): Position | null {
  const dims = parseSize(size);
  if (!dims) {
    return null;
  }

  const { width, depth } = dims;

  // Scan from bottom-left (0,0) to top-right in 0.5 steps
  for (let y = 0; y <= drawer.depth - depth; y += 0.5) {
    for (let x = 0; x <= drawer.width - width; x += 0.5) {
      if (isValidPosition(x, y, width, depth, occupied, drawer)) {
        return { x, y };
      }
    }
  }

  return null;
}

/**
 * Parse occupied tuples [[x,y,w,d], ...] into OccupiedRect[].
 * Validates each tuple is a 4-element number array.
 * Returns empty array for invalid input.
 */
export function parseOccupied(tuples: unknown): OccupiedRect[] {
  if (!Array.isArray(tuples)) {
    return [];
  }

  const rects: OccupiedRect[] = [];
  for (const tuple of tuples) {
    if (
      !Array.isArray(tuple) ||
      tuple.length !== 4 ||
      !tuple.every((v) => typeof v === 'number' && Number.isFinite(v))
    ) {
      continue;
    }

    const [x, y, width, depth] = tuple as number[];
    rects.push({ x, y, width, depth });
  }

  return rects;
}
