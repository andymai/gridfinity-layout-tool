import type { Layout, Bin } from '@/core/types';
import type {
  LayoutQualityTier,
  QualitySignal,
  AbandonmentType,
  ConfidenceBreakdown,
} from './types';
import { getGridBins, getLabeledBins } from '@/shared/utils/bins';
import { layoutSession } from './sessionState';

// ============================================
// LAYOUT QUALITY ASSESSMENT
// ============================================

/**
 * Assess quality of a layout for ML training purposes.
 * Filters out "just trying it out" data.
 */
export function assessLayoutQuality(layout: Layout): LayoutQualityTier {
  const bins = getGridBins(layout.bins);

  // Skip if too few bins (probably just testing)
  if (bins.length < 3) return 'skip';

  const totalArea = layout.drawer.width * layout.drawer.depth;
  const filledArea = bins.reduce((sum, bin) => sum + bin.width * bin.depth, 0);
  const fillPct = totalArea > 0 ? (filledArea / totalArea) * 100 : 0;

  // Skip if very low fill (probably just placed a few test bins)
  if (fillPct < 15) return 'skip';

  // Check for variety in bin sizes (not all same size)
  const uniqueSizes = new Set(bins.map((b) => `${b.width}x${b.depth}x${b.height}`));
  const hasSizeVariety = uniqueSizes.size >= 2;

  // Check if any bins have labels (shows intentional design)
  const labeledCount = getLabeledBins(bins).length;
  const hasLabels = labeledCount > 0;

  // High quality: good fill, has labels, variety
  if (fillPct >= 50 && (hasLabels || hasSizeVariety) && bins.length >= 5) {
    return 'high';
  }

  // Medium quality: reasonable fill, some effort shown
  if (fillPct >= 30 && (hasSizeVariety || bins.length >= 4)) {
    return 'medium';
  }

  // Low quality: minimal but valid
  if (fillPct >= 15 && bins.length >= 3) {
    return 'low';
  }

  return 'skip';
}

/**
 * Check if layout is substantial enough to be worth tracking.
 */
export function isSubstantialLayout(layout: Layout): boolean {
  return assessLayoutQuality(layout) !== 'skip';
}

// ============================================
// DISTRIBUTION COMPUTATIONS
// ============================================

/**
 * Compute a hash of the layout for deduplication.
 * Uses bin composition, not positions (order-independent).
 */
export function computeLayoutHash(layout: Layout): string {
  const bins = getGridBins(layout.bins);

  // Create a deterministic representation of bin composition
  const binSignatures = bins
    .map((b) => `${b.width}x${b.depth}x${b.height}:${b.category || 'none'}`)
    .sort()
    .join('|');

  const signature = `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}:${bins.length}:${binSignatures}`;

  // Simple hash (djb2)
  let hash = 5381;
  for (let i = 0; i < signature.length; i++) {
    hash = (hash << 5) + hash + signature.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Compute size distribution from bins.
 */
export function computeSizeDistribution(bins: Bin[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const bin of getGridBins(bins)) {
    const size = `${bin.width}x${bin.depth}x${bin.height}`;
    distribution[size] = (distribution[size] || 0) + 1;
  }
  return distribution;
}

/**
 * Compute category distribution from bins.
 */
export function computeCategoryDistribution(bins: Bin[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const bin of getGridBins(bins)) {
    const category = bin.category || 'uncategorized';
    distribution[category] = (distribution[category] || 0) + 1;
  }
  return distribution;
}

/**
 * Compute domain distribution from bins (based on label vocabulary).
 */
export function computeDomainDistribution(
  bins: Bin[],
  processLabel: (label: string) => { domain: string | null }
): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const bin of getGridBins(bins)) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
    if (!bin.label?.trim()) continue;

    const labelData = processLabel(bin.label);
    const domain = labelData.domain ?? 'unknown';
    distribution[domain] = (distribution[domain] ?? 0) + 1;
  }
  return distribution;
}

/**
 * Get top N most common label hashes from bins.
 */
export function computeTopLabelHashes(
  bins: Bin[],
  n: number,
  processLabel: (label: string) => { hash: string }
): string[] {
  const hashCounts: Record<string, number> = {};

  for (const bin of getGridBins(bins)) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
    if (!bin.label?.trim()) continue;

    const labelData = processLabel(bin.label);
    hashCounts[labelData.hash] = (hashCounts[labelData.hash] || 0) + 1;
  }

  return Object.entries(hashCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([hash]) => hash);
}

/**
 * Compute fill percentage of layout.
 */
export function computeFillPercentage(layout: Layout): number {
  const bins = getGridBins(layout.bins);
  const totalArea = layout.drawer.width * layout.drawer.depth;
  if (totalArea === 0) return 0;

  const filledArea = bins.reduce((sum, bin) => sum + bin.width * bin.depth, 0);
  return Math.round((filledArea / totalArea) * 100);
}

/**
 * Compute percentage of bins that have labels.
 */
export function computeLabeledPercentage(bins: Bin[]): number {
  const gridBins = getGridBins(bins);
  if (gridBins.length === 0) return 0;

  const labeledCount = getLabeledBins(gridBins).length;
  return Math.round((labeledCount / gridBins.length) * 100);
}

// ============================================
// CONFIDENCE & QUALITY SCORING
// ============================================

/**
 * Compute session confidence score (0-1).
 * Higher scores indicate more confident, deliberate sessions.
 */
export function computeSessionConfidence(
  binsPlaced: number,
  undoCount: number,
  deletedCount: number,
  resizeCount: number,
  moveCount: number,
  sessionDurationMs: number
): number {
  // No bins placed = no confidence
  if (binsPlaced === 0) return 0;

  // Undo score
  const undoScore = undoCount === 0 ? 1.0 : undoCount <= 2 ? 0.8 : undoCount <= 5 ? 0.6 : 0.4;

  // Correction score
  const totalCorrections = deletedCount + resizeCount + moveCount;
  const correctionRatio = totalCorrections / binsPlaced;
  const correctionScore =
    correctionRatio === 0 ? 1.0 : correctionRatio < 0.3 ? 0.8 : correctionRatio < 0.6 ? 0.6 : 0.4;

  // Session score — treat zero-duration sessions as low confidence (rapid/test behavior)
  const binsPerMinute = sessionDurationMs > 0 ? binsPlaced / (sessionDurationMs / 60_000) : 0;
  const sessionScore =
    binsPerMinute > 2 ? 1.0 : binsPerMinute > 0.5 ? 0.8 : binsPerMinute > 0.1 ? 0.6 : 0.4;

  // Weighted average
  const weights = { undo: 0.25, correction: 0.45, session: 0.3 };
  const weighted =
    undoScore * weights.undo +
    correctionScore * weights.correction +
    sessionScore * weights.session;

  return Math.round(weighted * 100) / 100;
}

/**
 * Compute detailed confidence breakdown for quality events.
 */
export function computeConfidenceBreakdown(layout: Layout): ConfidenceBreakdown {
  const binsPlaced = getGridBins(layout.bins).length;

  if (binsPlaced === 0) {
    return {
      undo_score: 0,
      completion_score: 0,
      session_score: 0,
      correction_score: 0,
      combined: 0,
    };
  }

  const undoScore =
    layoutSession.undoCount === 0
      ? 1.0
      : layoutSession.undoCount <= 2
        ? 0.8
        : layoutSession.undoCount <= 5
          ? 0.6
          : 0.4;

  const fillPct = computeFillPercentage(layout);
  const labeledBins = getLabeledBins(getGridBins(layout.bins)).length;
  const labelRate = binsPlaced > 0 ? labeledBins / binsPlaced : 0;
  const completionScore = Math.round(fillPct * 0.7 + labelRate * 100 * 0.3) / 100;

  const sessionDurationMs = Date.now() - layoutSession.startTime;
  const binsPerMinute = sessionDurationMs > 0 ? binsPlaced / (sessionDurationMs / 60_000) : 0;
  const sessionScore =
    binsPerMinute > 2 ? 1.0 : binsPerMinute > 0.5 ? 0.8 : binsPerMinute > 0.1 ? 0.6 : 0.4;

  const totalCorrections =
    layoutSession.deletedCount + layoutSession.resizeCount + layoutSession.moveCount;
  const correctionRatio = totalCorrections / binsPlaced;
  const correctionScore =
    correctionRatio === 0 ? 1.0 : correctionRatio < 0.3 ? 0.8 : correctionRatio < 0.6 ? 0.6 : 0.4;

  const weights = { undo: 0.2, completion: 0.25, session: 0.25, correction: 0.3 };
  const combined =
    undoScore * weights.undo +
    completionScore * weights.completion +
    sessionScore * weights.session +
    correctionScore * weights.correction;

  return {
    undo_score: Math.round(undoScore * 100) / 100,
    completion_score: Math.round(completionScore * 100) / 100,
    session_score: Math.round(sessionScore * 100) / 100,
    correction_score: Math.round(correctionScore * 100) / 100,
    combined: Math.round(combined * 100) / 100,
  };
}

/**
 * Detect abandonment type based on layout state and session context.
 */
export function detectAbandonmentType(
  layout: Layout,
  signal: QualitySignal
): AbandonmentType | null {
  const binsOnGrid = getGridBins(layout.bins);
  const fillPct = computeFillPercentage(layout);
  const timeSinceLastEdit = Date.now() - layoutSession.lastEditTime;

  // Dormant: no edits in last 30 minutes but session still active
  const DORMANT_THRESHOLD_MS = 30 * 60 * 1000;
  if (timeSinceLastEdit > DORMANT_THRESHOLD_MS && binsOnGrid.length > 0) {
    return 'dormant';
  }

  // Incomplete: has bins but very low fill rate
  if (signal === 'modified' && fillPct < 20 && binsOnGrid.length >= 2) {
    return 'incomplete';
  }

  // Deleted: layout being cleared
  if (signal === 'modified' && binsOnGrid.length === 0 && layoutSession.deletedCount > 0) {
    return 'deleted';
  }

  // Superseded
  if (signal === 'modified' && layoutSession.editCount > 0 && fillPct < 10) {
    return 'superseded';
  }

  return null;
}

// ============================================
// CATEGORY HASHING
// ============================================

/**
 * Default category names that we skip tracking (color-based, not meaningful).
 */
const DEFAULT_CATEGORY_NAMES = new Set([
  'coral',
  'sky',
  'green',
  'cloud',
  'charcoal',
  'new category',
]);

/**
 * Check if a category name is a default/color-based name.
 */
export function isDefaultCategoryName(name: string): boolean {
  return DEFAULT_CATEGORY_NAMES.has(name.toLowerCase().trim());
}

/**
 * Simple hash for category names.
 */
export function hashCategoryName(name: string): string {
  const normalized = name.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ============================================
// CROSS-LAYOUT USER HASH
// ============================================

const USER_HASH_STORAGE_KEY = 'gridfinity-ml-user-hash-v1';

/**
 * Check if localStorage is available.
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get or create a stable user hash for cross-layout correlation.
 * This is NOT personally identifiable - just a random ID for grouping.
 */
export function getUserHash(): string {
  if (!isLocalStorageAvailable()) {
    return 'anonymous';
  }

  try {
    let hash = localStorage.getItem(USER_HASH_STORAGE_KEY);
    if (!hash) {
      hash = crypto.randomUUID();
      localStorage.setItem(USER_HASH_STORAGE_KEY, hash);
    }
    return hash;
  } catch {
    return 'anonymous';
  }
}
