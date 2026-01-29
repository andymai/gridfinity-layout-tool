/**
 * Drawer Purpose Inference for ML Telemetry
 *
 * Analyzes layout composition to infer the likely purpose/use-case
 * of a drawer. This enables purpose→composition correlation learning
 * without requiring explicit user input.
 *
 * Privacy: Only aggregated domain/pattern signals are used, no raw labels.
 */

import type { Layout, Bin } from '@/core/types';
import { getGridBins, getLabeledBins } from '@/shared/utils/bins';
import { processLabel, type LabelDomain } from './labelVocabulary';

// ============================================
// TYPES
// ============================================

/**
 * A signal that contributes to purpose inference.
 */
export interface PurposeSignal {
  /** Type of signal */
  type: 'domain_concentration' | 'size_pattern' | 'label_pattern';
  /** Signal value (domain name, pattern description, etc.) */
  value: string;
  /** Weight/confidence of this signal (0-1) */
  weight: number;
}

/**
 * Result of purpose inference.
 */
export interface PurposeInferenceResult {
  /** Inferred purpose, or null if inconclusive */
  purpose: string | null;
  /** Confidence in the inference (0-1) */
  confidence: number;
  /** Signals that contributed to the inference */
  signals: PurposeSignal[];
}

// ============================================
// SIZE PATTERN DEFINITIONS
// ============================================

/**
 * Known size patterns that suggest specific purposes.
 * Maps pattern name to size characteristics.
 */
interface SizePatternDef {
  /** Description for ML signals */
  description: string;
  /** Typical bin dimensions (width, depth) */
  typicalSizes: Array<{ minW: number; maxW: number; minD: number; maxD: number }>;
  /** Suggested purpose */
  suggestedPurpose: string;
}

const SIZE_PATTERNS: Record<string, SizePatternDef> = {
  small_uniform: {
    description: 'Many small uniform bins (1x1, 1x2)',
    typicalSizes: [{ minW: 1, maxW: 2, minD: 1, maxD: 2 }],
    suggestedPurpose: 'electronics', // Small components, resistors, etc.
  },
  long_thin: {
    description: 'Long thin bins for tools',
    typicalSizes: [
      { minW: 1, maxW: 2, minD: 4, maxD: 10 },
      { minW: 4, maxW: 10, minD: 1, maxD: 2 },
    ],
    suggestedPurpose: 'workshop', // Screwdrivers, pens, etc.
  },
  medium_mixed: {
    description: 'Medium-sized mixed bins',
    typicalSizes: [{ minW: 2, maxW: 4, minD: 2, maxD: 4 }],
    suggestedPurpose: 'general',
  },
};

// ============================================
// INFERENCE LOGIC
// ============================================

/**
 * Calculate domain distribution from bins.
 */
function getDomainDistribution(bins: Bin[]): Map<LabelDomain | 'unknown', number> {
  const distribution = new Map<LabelDomain | 'unknown', number>();

  for (const bin of getGridBins(bins)) {
    if (!bin.label?.trim()) continue;

    const labelData = processLabel(bin.label);
    const domain = labelData.domain || 'unknown';
    distribution.set(domain, (distribution.get(domain) || 0) + 1);
  }

  return distribution;
}

/**
 * Check if a bin matches a size pattern.
 */
function matchesSizePattern(bin: Bin, pattern: SizePatternDef): boolean {
  return pattern.typicalSizes.some(
    (size) =>
      bin.width >= size.minW &&
      bin.width <= size.maxW &&
      bin.depth >= size.minD &&
      bin.depth <= size.maxD
  );
}

/**
 * Get size pattern signals from bins.
 */
function getSizePatternSignals(bins: Bin[]): PurposeSignal[] {
  const signals: PurposeSignal[] = [];
  const gridBins = getGridBins(bins);

  if (gridBins.length === 0) return signals;

  for (const [_patternName, pattern] of Object.entries(SIZE_PATTERNS)) {
    const matchingBins = gridBins.filter((b) => matchesSizePattern(b, pattern));
    const matchRatio = matchingBins.length / gridBins.length;

    // Only consider patterns that match at least 30% of bins
    if (matchRatio >= 0.3) {
      signals.push({
        type: 'size_pattern',
        value: pattern.suggestedPurpose,
        weight: matchRatio * 0.6, // Size patterns are less reliable than domain
      });
    }
  }

  return signals;
}

/**
 * Detect label patterns that suggest specific purposes.
 */
function getLabelPatternSignals(bins: Bin[]): PurposeSignal[] {
  const signals: PurposeSignal[] = [];
  const gridBins = getGridBins(bins);
  const labeledBins = getLabeledBins(gridBins);

  if (labeledBins.length === 0) return signals;

  // Check for measurement patterns (M3, M4, etc. - suggests fasteners/workshop)
  const measurementPattern = /\b[mM]\d+|\d+mm|\d+x\d+/;
  const measurementBins = labeledBins.filter((b) => measurementPattern.test(b.label || ''));
  if (measurementBins.length / labeledBins.length >= 0.3) {
    signals.push({
      type: 'label_pattern',
      value: 'workshop',
      weight: (measurementBins.length / labeledBins.length) * 0.5,
    });
  }

  // Check for color/brand patterns (suggests craft/cosmetics)
  const colorPattern = /\b(red|blue|green|black|white|pink|purple|orange|yellow)\b/i;
  const colorBins = labeledBins.filter((b) => colorPattern.test(b.label || ''));
  if (colorBins.length / labeledBins.length >= 0.3) {
    signals.push({
      type: 'label_pattern',
      value: 'craft',
      weight: (colorBins.length / labeledBins.length) * 0.4,
    });
  }

  return signals;
}

/**
 * Map domain to purpose.
 * Multiple domains may map to the same purpose.
 */
function domainToPurpose(domain: LabelDomain | 'unknown'): string | null {
  const mapping: Record<LabelDomain | 'unknown', string | null> = {
    tools: 'workshop',
    fasteners: 'workshop',
    electronics: 'electronics',
    office: 'office',
    craft: 'craft',
    printing_3d: 'workshop',
    cosmetics: 'bathroom',
    misc: null,
    unknown: null,
  };
  return mapping[domain];
}

/**
 * Infer the likely purpose of a drawer based on its contents.
 *
 * Analyzes:
 * 1. Domain distribution from labeled bins (strongest signal)
 * 2. Size patterns (weaker signal)
 * 3. Label patterns (medium signal)
 *
 * Returns null if no clear purpose can be inferred.
 *
 * @param layout - Layout to analyze
 * @returns Inference result with purpose, confidence, and contributing signals
 *
 * @example
 * // Tools drawer
 * inferDrawerPurpose(toolsLayout)
 * // → { purpose: 'workshop', confidence: 0.8, signals: [...] }
 *
 * @example
 * // Mixed/unclear drawer
 * inferDrawerPurpose(mixedLayout)
 * // → { purpose: null, confidence: 0.2, signals: [...] }
 */
export function inferDrawerPurpose(layout: Layout): PurposeInferenceResult {
  const bins = layout.bins;
  const gridBins = getGridBins(bins);
  const signals: PurposeSignal[] = [];

  // Collect signals

  // 1. Domain concentration (strongest signal)
  const domainDistribution = getDomainDistribution(gridBins);
  const totalLabeled = Array.from(domainDistribution.values()).reduce((a, b) => a + b, 0);

  if (totalLabeled > 0) {
    for (const [domain, count] of domainDistribution) {
      const concentration = count / totalLabeled;
      const purpose = domainToPurpose(domain);

      // Only consider domains that make up at least 40% of labeled bins
      if (concentration >= 0.4 && purpose) {
        signals.push({
          type: 'domain_concentration',
          value: purpose,
          weight: concentration * 0.9, // Domain is the strongest signal
        });
      }
    }
  }

  // 2. Size patterns
  signals.push(...getSizePatternSignals(gridBins));

  // 3. Label patterns
  signals.push(...getLabelPatternSignals(gridBins));

  // Aggregate signals by purpose
  const purposeScores = new Map<string, number>();
  for (const signal of signals) {
    const currentScore = purposeScores.get(signal.value) || 0;
    purposeScores.set(signal.value, currentScore + signal.weight);
  }

  // Find the highest-scoring purpose
  let bestPurpose: string | null = null;
  let bestScore = 0;

  for (const [purpose, score] of purposeScores) {
    if (score > bestScore) {
      bestScore = score;
      bestPurpose = purpose;
    }
  }

  // Require minimum confidence threshold
  const confidence = Math.min(bestScore, 1.0);
  const inferredPurpose = confidence >= 0.4 ? bestPurpose : null;

  return {
    purpose: inferredPurpose,
    confidence,
    signals,
  };
}

// ============================================
// CROSS-LAYOUT LABEL SIZE TRACKING
// ============================================

/**
 * Storage key for cross-layout label sizes.
 */
const LABEL_SIZES_STORAGE_KEY = 'gridfinity-ml-label-sizes-v1';

/**
 * Maximum entries to store (prevents unbounded storage growth).
 */
const MAX_LABEL_ENTRIES = 500;

/**
 * Maximum sizes to track per label.
 */
const MAX_SIZES_PER_LABEL = 5;

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
 * Load stored label sizes from localStorage.
 */
export function loadLabelSizes(): Record<string, string[]> {
  if (!isLocalStorageAvailable()) return {};

  try {
    const stored = localStorage.getItem(LABEL_SIZES_STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Save label sizes to localStorage.
 */
function saveLabelSizes(data: Record<string, string[]>): void {
  try {
    // Prune to max entries if needed
    const entries = Object.entries(data);
    if (entries.length > MAX_LABEL_ENTRIES) {
      // Keep most recent entries (approximated by keeping last entries)
      const pruned = Object.fromEntries(entries.slice(-MAX_LABEL_ENTRIES));
      localStorage.setItem(LABEL_SIZES_STORAGE_KEY, JSON.stringify(pruned));
    } else {
      localStorage.setItem(LABEL_SIZES_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Silently fail - storage may be full or disabled
  }
}

/**
 * Record a label→size association from the current layout.
 *
 * @param labelHash - Hash of the label
 * @param size - Bin size as "WxDxH" string
 */
export function recordLabelSize(labelHash: string, size: string): void {
  const data = loadLabelSizes();

  if (!data[labelHash]) {
    data[labelHash] = [];
  }

  // Add size if not already tracked
  if (!data[labelHash].includes(size)) {
    data[labelHash].push(size);

    // Limit sizes per label
    if (data[labelHash].length > MAX_SIZES_PER_LABEL) {
      data[labelHash] = data[labelHash].slice(-MAX_SIZES_PER_LABEL);
    }
  }

  saveLabelSizes(data);
}

/**
 * Extract and record all label→size associations from a layout.
 * Uses batched localStorage operations for better performance.
 *
 * @param layout - Layout to process
 */
export function recordLayoutLabelSizes(layout: Layout): void {
  const gridBins = getGridBins(layout.bins);
  const labeledBins = getLabeledBins(gridBins);

  if (labeledBins.length === 0) return;

  // Load once, update all, save once (batched for performance)
  const data = loadLabelSizes();

  for (const bin of labeledBins) {
    // bin.label is guaranteed non-null by the filter above
    const label = bin.label ?? '';
    const labelData = processLabel(label);
    const size = `${bin.width}x${bin.depth}x${bin.height}`;

    if (!data[labelData.hash]) {
      data[labelData.hash] = [];
    }

    // Add size if not already tracked
    if (!data[labelData.hash].includes(size)) {
      data[labelData.hash].push(size);

      // Limit sizes per label
      if (data[labelData.hash].length > MAX_SIZES_PER_LABEL) {
        data[labelData.hash] = data[labelData.hash].slice(-MAX_SIZES_PER_LABEL);
      }
    }
  }

  saveLabelSizes(data);
}

/**
 * Get label size consistency data for a layout.
 * Compares current bin sizes to historical sizes for the same labels.
 *
 * @param layout - Layout to analyze
 * @returns Array of label consistency records
 */
export function getLabelSizeConsistency(
  layout: Layout
): Array<{ labelHash: string; sizesUsed: string[]; isConsistent: boolean }> {
  const stored = loadLabelSizes();
  const results: Array<{ labelHash: string; sizesUsed: string[]; isConsistent: boolean }> = [];
  const processedHashes = new Set<string>();

  const gridBins = getGridBins(layout.bins);

  for (const bin of gridBins) {
    if (!bin.label?.trim()) continue;

    const labelData = processLabel(bin.label);
    if (processedHashes.has(labelData.hash)) continue;
    processedHashes.add(labelData.hash);

    const currentSize = `${bin.width}x${bin.depth}x${bin.height}`;
    const historicalSizes = stored[labelData.hash] || [];

    // Combine current with historical (deduplicated)
    const allSizes = [...new Set([...historicalSizes, currentSize])];

    // Consistent if only one size used across all layouts
    const isConsistent = allSizes.length === 1;

    results.push({
      labelHash: labelData.hash,
      sizesUsed: allSizes,
      isConsistent,
    });
  }

  return results;
}

/**
 * Calculate overall label-size consistency rate for a layout.
 *
 * @param layout - Layout to analyze
 * @returns Consistency rate (0-1), or null if no labeled bins
 */
export function calculateConsistencyRate(layout: Layout): number | null {
  const consistency = getLabelSizeConsistency(layout);
  if (consistency.length === 0) return null;

  const consistentCount = consistency.filter((c) => c.isConsistent).length;
  return consistentCount / consistency.length;
}
