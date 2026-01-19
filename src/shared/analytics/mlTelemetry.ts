/**
 * ML Telemetry Client
 *
 * Collects bin placement and label data for training predictive models.
 * Uses a hash-first strategy for labels to support any domain/language.
 *
 * Data flow:
 * 1. Events buffered in memory
 * 2. Flushed to API on: 30s interval, 20 events, or page hide
 * 3. API aggregates into Redis counters (no raw event storage)
 *
 * Privacy:
 * - Labels are hashed (not stored raw)
 * - Vocabulary provides optional enrichment
 * - No PII or layout content is transmitted
 * - User can disable via settings
 */

import type { Layout, Bin } from '@/core/types';
import { useSettingsStore } from '@/core/store/settings';
import { processLabel, VOCAB_VERSION } from './labelVocabulary';
import { analyzeGaps } from './gapAnalysis';

// ============================================
// EVENT TYPES
// ============================================

/**
 * Bin placement event for ML training.
 */
export interface BinPlacementEvent {
  type: 'bin_placed';

  // === Core (for transition matrix) ===
  /** Bin size as "WxDxH" string */
  bin_size: string;
  /** Previous bin size this session, or null if first bin */
  prev_bin_size: string | null;
  /** Drawer size as "WxDxH" string */
  drawer_size: string;

  // === Spatial context ===
  /** Position as "X,Y" string */
  position: string;
  /** Layer index (0 = bottom) */
  layer_index: number;
  /** Largest empty rectangle as "WxD" string */
  largest_gap: string;
  /** Fill percentage (0-100) */
  fill_pct: number;
  /** Whether bin fills a gap exactly, partially, or not at all */
  gap_fit: 'exact' | 'partial' | 'none';

  // === Label data (hash-first strategy) ===
  /** Label hash - ALWAYS populated if label exists */
  label_hash: string | null;
  /** Normalized label from vocabulary, or null */
  label_normalized: string | null;
  /** Label domain category, or null */
  label_domain: string | null;
  /** Category ID from the layout */
  category_id: string;

  // === Context ===
  /** How the bin was placed */
  method: PlacementMethod;
  /** nth bin placed this session */
  session_index: number;

  // === Versioning ===
  /** Vocabulary version for label normalization */
  vocab_version: string;
}

/**
 * Label update event - when user adds/edits a label on existing bin.
 */
export interface LabelUpdateEvent {
  type: 'label_updated';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  // Old label data
  old_label_hash: string | null;
  old_label_normalized: string | null;

  // New label data
  new_label_hash: string | null;
  new_label_normalized: string | null;
  new_label_domain: string | null;

  vocab_version: string;
}

export type MLTelemetryEvent = BinPlacementEvent | LabelUpdateEvent;

export type PlacementMethod = 'draw' | 'fill' | 'duplicate' | 'staging' | 'paint';

// ============================================
// SESSION STATE
// ============================================

interface SessionState {
  /** Last bin size placed this session */
  prevBinSize: string | null;
  /** Number of bins placed this session */
  sessionIndex: number;
}

let sessionState: SessionState = {
  prevBinSize: null,
  sessionIndex: 0,
};

/**
 * Reset session state (call on new layout or page load).
 */
export function resetMLSession(): void {
  sessionState = {
    prevBinSize: null,
    sessionIndex: 0,
  };
}

// ============================================
// EVENT BUFFER
// ============================================

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const FLUSH_THRESHOLD = 20; // or 20 events

let eventBuffer: MLTelemetryEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

function scheduleFlush(): void {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flush();
  }, FLUSH_INTERVAL_MS);
}

function cancelFlush(): void {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

/**
 * Flush buffered events to the API.
 */
function flush(): void {
  cancelFlush();

  if (eventBuffer.length === 0) return;

  // Check if telemetry is still enabled
  const settings = useSettingsStore.getState().settings;
  if (!settings.mlTelemetryEnabled) {
    eventBuffer = [];
    return;
  }

  const events = eventBuffer;
  eventBuffer = [];

  // Use sendBeacon for reliability on page close
  try {
    const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
    const sent = navigator.sendBeacon('/api/ml-telemetry', blob);

    if (!sent) {
      // Fallback to fetch if sendBeacon fails (shouldn't happen often)
      fetch('/api/ml-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
        keepalive: true,
      }).catch(() => {
        // Silently fail - telemetry should never break the app
      });
    }
  } catch {
    // Silently fail
  }
}

/**
 * Initialize ML telemetry listeners.
 * Call once on app startup.
 */
export function initMLTelemetry(): void {
  if (isInitialized) return;
  if (typeof window === 'undefined') return;

  isInitialized = true;

  // Flush on page hide (tab switch, close, navigation)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  });

  // Flush on page unload
  window.addEventListener('pagehide', flush);

  // Also try beforeunload as fallback
  window.addEventListener('beforeunload', flush);
}

// ============================================
// TRACKING FUNCTIONS
// ============================================

/**
 * Check if ML telemetry is enabled.
 */
function isEnabled(): boolean {
  const settings = useSettingsStore.getState().settings;
  return settings.mlTelemetryEnabled ?? true; // Default to enabled (opt-out)
}

/**
 * Track a bin placement event.
 *
 * @param bin - The bin that was placed
 * @param layout - Current layout state
 * @param method - How the bin was placed
 */
export function trackBinPlacement(
  bin: Bin,
  layout: Layout,
  method: PlacementMethod
): void {
  if (!isEnabled()) return;

  // Find layer index
  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  // Compute spatial context
  const gapAnalysis = analyzeGaps(layout, bin.layerId, {
    width: bin.width,
    depth: bin.depth,
  });

  // Process label (hash-first strategy)
  let labelHash: string | null = null;
  let labelNormalized: string | null = null;
  let labelDomain: string | null = null;

  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelHash = labelData.hash;
    labelNormalized = labelData.normalized;
    labelDomain = labelData.domain;
  }

  // Build bin size string
  const binSize = `${bin.width}x${bin.depth}x${bin.height}`;

  const event: BinPlacementEvent = {
    type: 'bin_placed',

    // Core
    bin_size: binSize,
    prev_bin_size: sessionState.prevBinSize,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,

    // Spatial
    position: `${bin.x},${bin.y}`,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    largest_gap: gapAnalysis.largestGap,
    fill_pct: gapAnalysis.fillPct,
    gap_fit: gapAnalysis.gapFit,

    // Label (hash-first)
    label_hash: labelHash,
    label_normalized: labelNormalized,
    label_domain: labelDomain,
    category_id: bin.category,

    // Context
    method,
    session_index: sessionState.sessionIndex,

    // Versioning
    vocab_version: VOCAB_VERSION,
  };

  // Update session state
  sessionState.prevBinSize = binSize;
  sessionState.sessionIndex++;

  // Buffer event
  eventBuffer.push(event);

  // Flush if threshold reached
  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Track a label update event.
 *
 * @param bin - The bin being updated
 * @param oldLabel - Previous label value
 * @param newLabel - New label value
 */
export function trackLabelUpdate(
  bin: Bin,
  oldLabel: string | undefined | null,
  newLabel: string | undefined | null
): void {
  if (!isEnabled()) return;

  // Skip if labels are effectively the same
  const oldTrimmed = oldLabel?.trim() || '';
  const newTrimmed = newLabel?.trim() || '';
  if (oldTrimmed === newTrimmed) return;

  // Process old label
  let oldLabelHash: string | null = null;
  let oldLabelNormalized: string | null = null;
  if (oldTrimmed) {
    const oldData = processLabel(oldTrimmed);
    oldLabelHash = oldData.hash;
    oldLabelNormalized = oldData.normalized;
  }

  // Process new label
  let newLabelHash: string | null = null;
  let newLabelNormalized: string | null = null;
  let newLabelDomain: string | null = null;
  if (newTrimmed) {
    const newData = processLabel(newTrimmed);
    newLabelHash = newData.hash;
    newLabelNormalized = newData.normalized;
    newLabelDomain = newData.domain;
  }

  const event: LabelUpdateEvent = {
    type: 'label_updated',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    old_label_hash: oldLabelHash,
    old_label_normalized: oldLabelNormalized,
    new_label_hash: newLabelHash,
    new_label_normalized: newLabelNormalized,
    new_label_domain: newLabelDomain,
    vocab_version: VOCAB_VERSION,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Track multiple bins placed at once (e.g., from fill operation).
 *
 * @param bins - Array of bins that were placed
 * @param layout - Current layout state
 * @param method - How the bins were placed (usually 'fill')
 */
export function trackBulkPlacement(
  bins: Bin[],
  layout: Layout,
  method: PlacementMethod
): void {
  if (!isEnabled()) return;
  if (bins.length === 0) return;

  // For bulk operations, we track as a summary rather than individual events
  // to avoid flooding the telemetry with 100+ events from a single fill
  const sampleSize = Math.min(bins.length, 5);
  const sampledBins = bins.slice(0, sampleSize);

  for (const bin of sampledBins) {
    trackBinPlacement(bin, layout, method);
  }
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Get current buffer size (for debugging/testing).
 */
export function getBufferSize(): number {
  return eventBuffer.length;
}

/**
 * Force flush (for testing or cleanup).
 */
export function forceFlush(): void {
  flush();
}
