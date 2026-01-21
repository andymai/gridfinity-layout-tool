/**
 * ML Telemetry Client
 *
 * Collects bin placement, layout snapshot, and quality signal data for training
 * predictive models and enabling smart layout generation.
 *
 * Uses a hash-first strategy for labels to support any domain/language.
 *
 * Data flow:
 * 1. Events buffered in memory
 * 2. Flushed to API on: 30s interval, 20 events, or page hide
 * 3. API aggregates into Redis counters (no raw event storage)
 *
 * Event types:
 * - bin_placed: Individual bin placements (for transition matrix)
 * - label_updated: Label changes on existing bins
 * - layout_snapshot: Complete layout state at commit points
 * - layout_quality: Quality signals (shared, exported, deleted, etc.)
 * - drawer_purpose: User-specified drawer categorization
 */

import type { Layout, Bin } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { useSettingsStore } from '@/core/store/settings';
import { processLabel, VOCAB_VERSION } from './labelVocabulary';
import { analyzeGaps } from './gapAnalysis';
import {
  detectArchetype,
  detectSpatialPatterns,
  computeUniformityScore,
  computeEdgeUsage,
  type LayoutArchetype,
  type SpatialPattern,
  type EdgeUsage,
} from './layoutPatterns';
import { computeStructureHash, computeTemporalFields } from './structureHash';

// Lazy store getter to avoid circular dependencies
// The store is imported dynamically on first use after initialization
let layoutStoreGetter: (() => { layout: Layout; lastEditSource: string | null }) | null = null;
let layoutStoreSubscribe: ((callback: (state: { lastEditSource: string | null }) => void) => () => void) | null = null;

/**
 * Set the layout store getter (call from App initialization).
 * This avoids circular dependencies.
 */
export function setLayoutStoreRef(
  getState: () => { layout: Layout; lastEditSource: string | null },
  subscribe: (callback: (state: { lastEditSource: string | null }) => void) => () => void
): void {
  layoutStoreGetter = getState;
  layoutStoreSubscribe = subscribe;
}

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

/**
 * Layout snapshot event - captures complete layout state at commit points.
 * Used for training smart layout generation models.
 */
export interface LayoutSnapshotEvent {
  type: 'layout_snapshot';

  // === Trigger context ===
  /** What action triggered the snapshot */
  trigger: LayoutSnapshotTrigger;

  // === Layout identity ===
  /** Hash of layout for deduplication */
  layout_hash: string;
  /** nth snapshot of this layout in current session */
  snapshot_index: number;

  // === Drawer context ===
  /** Drawer size as "WxDxH" string */
  drawer_size: string;
  /** Number of layers in the layout */
  layer_count: number;
  /** Optional drawer purpose if set */
  purpose: string | null;

  // === Composition (aggregated, not positions) ===
  /** Total number of bins (excluding staging) */
  bin_count: number;
  /** Distribution of bin sizes: {"1x1x6": 4, "2x2x3": 2} */
  size_distribution: Record<string, number>;
  /** Distribution by category ID: {"cat_abc": 6} */
  category_distribution: Record<string, number>;
  /** Distribution by label domain: {"tools": 5, "fasteners": 3} */
  domain_distribution: Record<string, number>;

  // === Label data (for co-occurrence learning) ===
  /** Top 10 most common label hashes in layout */
  top_label_hashes: string[];

  // === Quality metrics ===
  /** Percentage of drawer filled (0-100) */
  fill_percentage: number;
  /** Percentage of bins with labels (0-100) */
  labeled_percentage: number;

  // === Session context ===
  /** Milliseconds since session started */
  session_duration_ms: number;
  /** Number of edits in current session */
  edit_count: number;

  // === Quality tier ===
  /** Assessed quality tier for backend weighting */
  quality_tier: LayoutQualityTier;

  // === Pattern detection ===
  /** High-level layout archetype */
  archetype: LayoutArchetype;
  /** Spatial patterns detected in layout */
  spatial_patterns: SpatialPattern[];
  /** Bin size uniformity score (0-1) */
  uniformity_score: number;
  /** Which drawer edges have bins touching */
  edge_usage: EdgeUsage;

  // === Temporal patterns ===
  /** Hour of day when snapshot was taken (0-23) */
  hour_of_day: number;
  /** Day of week (0 = Sunday, 6 = Saturday) */
  day_of_week: number;
  /** Whether this is a weekend day */
  is_weekend: boolean;

  // === Structure clustering ===
  /** Structural fingerprint hash for clustering similar layouts */
  structure_hash: string;

  vocab_version: string;
}

/**
 * Quality signal event - tracks what happens to layouts after creation.
 * Used to weight training data (shared layouts are higher quality).
 */
export interface LayoutQualityEvent {
  type: 'layout_quality';

  /** Hash of layout for correlation */
  layout_hash: string;

  /** Type of quality signal */
  signal: QualitySignal;

  /** Days since layout was created */
  days_since_creation: number;
}

/**
 * Drawer purpose event - user-specified categorization.
 * Enables purpose→composition correlation learning.
 */
export interface DrawerPurposeEvent {
  type: 'drawer_purpose';

  /** Hash of layout */
  layout_hash: string;

  /** Selected or entered purpose */
  purpose: string;

  /** True if user entered custom text */
  is_custom: boolean;
}

/**
 * Category change event - when user assigns/changes a bin's category.
 * Tracks category assignment patterns for learning grouping behavior.
 *
 * Only tracks changes to custom categories (user-created names).
 * Default color-based categories (Coral, Sky, Green, etc.) are skipped.
 */
export interface CategoryChangeEvent {
  type: 'category_changed';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  /** Hash of the NEW category name (for pattern learning) */
  category_name_hash: string;

  /** Number of bins changed in this batch (for bulk operations) */
  batch_size: number;

  /** Label data for context (helps correlate item types with categories) */
  label_hash: string | null;
  label_domain: string | null;

  vocab_version: string;
}

/**
 * Bin resize event - when user manually resizes a bin.
 * Tracks size adjustment patterns after initial placement.
 */
export interface BinResizeEvent {
  type: 'bin_resized';

  /** Original size as "WxDxH" string */
  old_size: string;

  /** New size as "WxDxH" string */
  new_size: string;

  /** Which dimension(s) changed */
  dimensions_changed: ('width' | 'depth')[];

  /** Number of bins resized together (for multi-select resize) */
  batch_size: number;

  /** Fill percentage after resize */
  fill_pct: number;
}

/**
 * Bin deletion event - when user deletes a bin.
 * Important negative signal for ML training - helps identify
 * which placements users reject or find unsuitable.
 */
export interface BinDeletedEvent {
  type: 'bin_deleted';

  /** Size of deleted bin as "WxDxH" string */
  bin_size: string;

  /** Position of deleted bin as "X,Y" string */
  position: string;

  /** Layer index where bin was (0 = bottom) */
  layer_index: number;

  /** Whether bin had a label (indicates intentional placement) */
  had_label: boolean;

  /** Label domain if present (for correlation) */
  label_domain: string | null;

  /** How long bin existed before deletion (ms), or null if unknown */
  age_ms: number | null;

  /** Number of bins deleted together (for bulk delete) */
  batch_size: number;

  /** Fill percentage after deletion */
  fill_pct: number;

  /** Delete method */
  method: DeleteMethod;
}

/**
 * Bin move event - when user moves/nudges a bin after placement.
 * Tracks position adjustment patterns to understand preferred layouts.
 */
export interface BinMovedEvent {
  type: 'bin_moved';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  /** Original position as "X,Y" string */
  old_position: string;

  /** New position as "X,Y" string */
  new_position: string;

  /** Manhattan distance moved (grid units) */
  distance: number;

  /** Layer index (0 = bottom) */
  layer_index: number;

  /** Number of bins moved together (for multi-select move) */
  batch_size: number;

  /** Move method */
  method: MoveMethod;
}

/**
 * Drawer resize event - when user changes drawer dimensions.
 * Essential context for understanding container constraints.
 */
export interface DrawerResizedEvent {
  type: 'drawer_resized';

  /** Old size as "WxDxH" string */
  old_size: string;

  /** New size as "WxDxH" string */
  new_size: string;

  /** Which dimension(s) changed */
  dimensions_changed: ('width' | 'depth' | 'height')[];

  /** Number of bins moved to staging due to resize */
  bins_staged: number;

  /** Fill percentage after resize */
  fill_pct: number;
}

/**
 * Fill operation event - when user uses fill to populate the grid.
 * Direct statement of user's preferred bin size for the area.
 */
export interface FillOperationEvent {
  type: 'fill_operation';

  /** Fill method: 'uniform' for fillAllWithSize, 'gaps' for fillGaps */
  method: FillMethod;

  /** Bin size used for uniform fill as "WxD" (no height - layer determines it) */
  fill_size: string | null;

  /** Number of bins created by the fill */
  bins_created: number;

  /** Layer index where fill was applied */
  layer_index: number;

  /** Fill percentage after operation */
  fill_pct: number;

  /** Drawer size for context */
  drawer_size: string;
}

/**
 * Layer movement event - when bins are moved between layers.
 * Reveals organizational strategy and layer usage patterns.
 */
export interface LayerMoveEvent {
  type: 'layer_move';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  /** Source layer index (0 = bottom, -1 = staging) */
  from_layer_index: number;

  /** Target layer index (0 = bottom, -1 = staging) */
  to_layer_index: number;

  /** Number of bins moved together */
  batch_size: number;

  /** How the move was initiated */
  method: LayerMoveMethod;
}

/**
 * Bin rotation event - when user swaps width and depth.
 * Completes the picture of dimension adjustments.
 */
export interface BinRotatedEvent {
  type: 'bin_rotated';

  /** Original size as "WxDxH" string */
  old_size: string;

  /** New size (rotated) as "WxDxH" string */
  new_size: string;

  /** Number of bins rotated together (for multi-select) */
  batch_size: number;
}

// ============================================
// NEGATIVE SIGNAL EVENT TYPES
// ============================================

/**
 * Placement rejected event - when user cancels a draw/paint interaction.
 * Critical negative signal showing what users DON'T want.
 */
export interface PlacementRejectedEvent {
  type: 'placement_rejected';

  /** Why the placement was rejected */
  rejection_reason: RejectionReason;

  /** Intended bin size as "WxD" string (if determinable) */
  intended_size: string | null;

  /** Intended position as "X,Y" string (if determinable) */
  intended_position: string | null;

  /** Layer index where placement was attempted */
  layer_index: number;

  /** Drawer size for context */
  drawer_size: string;

  /** Fill percentage at rejection time */
  fill_pct: number;

  /** Whether it was paint mode (multi-bin) or draw mode (single bin) */
  mode: 'draw' | 'paint';
}

/**
 * Undo event - when user undoes an action.
 * Strong signal that previous action was a mistake.
 */
export interface UndoEvent {
  type: 'undo';

  /** What type of action was undone */
  action_undone: UndoActionType;

  /** Number of bins affected by the undo */
  bins_affected: number;

  /** Milliseconds since the action was originally performed */
  time_since_action_ms: number;

  /** Drawer size for context */
  drawer_size: string;
}

/**
 * Quick correction event - when user deletes or resizes a bin shortly after placing it.
 * Indicates the original placement was wrong.
 */
export interface QuickCorrectionEvent {
  type: 'quick_correction';

  /** Type of correction */
  correction_type: 'delete' | 'resize' | 'move';

  /** Original bin size as "WxDxH" string */
  original_size: string;

  /** New size (for resize) or null (for delete) */
  new_size: string | null;

  /** How the bin was originally placed */
  placement_method: PlacementMethod;

  /** Milliseconds between placement and correction */
  time_to_correction_ms: number;

  /** Layer index */
  layer_index: number;
}

export type MLTelemetryEvent =
  | BinPlacementEvent
  | LabelUpdateEvent
  | LayoutSnapshotEvent
  | LayoutQualityEvent
  | DrawerPurposeEvent
  | CategoryChangeEvent
  | BinResizeEvent
  | BinDeletedEvent
  | BinMovedEvent
  | DrawerResizedEvent
  | FillOperationEvent
  | LayerMoveEvent
  | BinRotatedEvent
  | PlacementRejectedEvent
  | UndoEvent
  | QuickCorrectionEvent;

export type PlacementMethod = 'draw' | 'fill' | 'duplicate' | 'staging' | 'paint';

export type DeleteMethod = 'key' | 'context_menu' | 'bulk' | 'inspector';

export type MoveMethod = 'drag' | 'nudge';

export type FillMethod = 'uniform' | 'gaps';

export type LayerMoveMethod = 'inspector' | 'drag' | 'keyboard' | 'context_menu';

export type RejectionReason =
  | 'cancelled'        // User pressed Escape or clicked away
  | 'second_touch'     // Second finger arrived (two-finger pan)
  | 'outside_bounds'   // Released outside grid bounds
  | 'too_small';       // Rectangle too small to create bin

export type UndoActionType =
  | 'placement'        // Undid bin placement
  | 'deletion'         // Undid bin deletion
  | 'move'             // Undid bin move
  | 'resize'           // Undid bin resize
  | 'fill'             // Undid fill operation
  | 'layer_change'     // Undid layer assignment
  | 'drawer_resize'    // Undid drawer resize
  | 'other';           // Unknown/mixed action

export type LayoutSnapshotTrigger =
  | 'save'
  | 'export_json'
  | 'export_tsv'
  | 'share'
  | 'print'
  | 'session_end'      // Tab close / navigate away
  | 'layout_switch'    // Switched to different layout
  | 'idle'             // No edits for 5+ minutes
  | 'print_preview';   // Opened print modal

export type QualitySignal =
  | 'shared'           // User shared publicly (high confidence)
  | 'exported'         // User exported to print (high confidence)
  | 'duplicated'       // Used as starting point
  | 'deleted'          // Negative signal
  | 'revisited_edited' // Came back and changed
  | 'revisited_kept';  // Came back, no changes (validation)

// ============================================
// DRAWER PURPOSE CONSTANTS
// ============================================

/**
 * Predefined drawer purposes for categorization.
 */
export const DRAWER_PURPOSES = [
  'workshop',      // Tools, hardware, DIY
  'electronics',   // Components, cables, dev boards
  'office',        // Supplies, stationery
  'craft',         // Art supplies, sewing, hobby
  'kitchen',       // Utensils, spices, gadgets
  'bathroom',      // Toiletries, medicine
  'garage',        // Automotive, outdoor
  'other',         // Custom entry
] as const;

export type DrawerPurpose = typeof DRAWER_PURPOSES[number];

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
 * Layout session state for snapshot tracking.
 */
interface LayoutSessionState {
  /** When the current layout session started */
  startTime: number;
  /** Number of edits in this session */
  editCount: number;
  /** Snapshot counts by layout hash (for deduplication) */
  snapshotCounts: Map<string, number>;
  /** Last snapshot timestamp by layout hash (for rate limiting) */
  lastSnapshotTime: Map<string, number>;
}

let layoutSession: LayoutSessionState = {
  startTime: Date.now(),
  editCount: 0,
  snapshotCounts: new Map(),
  lastSnapshotTime: new Map(),
};

// Minimum time between snapshots for same layout (60 seconds)
const MIN_SNAPSHOT_INTERVAL_MS = 60_000;

// ============================================
// BIN TIMESTAMP TRACKING (for quick-correction detection)
// ============================================

/**
 * Tracks when bins were created and how they were placed.
 * Used to detect quick corrections (delete/resize shortly after placement).
 */
interface BinCreationRecord {
  createdAt: number;
  method: PlacementMethod;
  originalSize: string;
}

/** Map of bin ID to creation record */
const binCreationRecords: Map<string, BinCreationRecord> = new Map();

/** Threshold for "quick" corrections (30 seconds) */
const QUICK_CORRECTION_THRESHOLD_MS = 30_000;

/** Maximum records to keep (prevents memory leak) */
const MAX_BIN_RECORDS = 500;

/**
 * Record that a bin was created.
 * Call this after successful bin placement.
 */
export function recordBinCreation(binId: string, method: PlacementMethod, size: string): void {
  // Prune old records if at or above capacity
  if (binCreationRecords.size >= MAX_BIN_RECORDS) {
    const now = Date.now();

    // First, remove records that are clearly too old
    for (const [id, record] of binCreationRecords) {
      if (now - record.createdAt > QUICK_CORRECTION_THRESHOLD_MS * 2) {
        binCreationRecords.delete(id);
      }
    }

    // If still at capacity, force-remove oldest records to make room
    if (binCreationRecords.size >= MAX_BIN_RECORDS) {
      const entries = Array.from(binCreationRecords.entries());
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);

      // Remove oldest entries to get below capacity
      const toDelete = entries.length - MAX_BIN_RECORDS + 1;
      for (let i = 0; i < toDelete; i++) {
        binCreationRecords.delete(entries[i][0]);
      }
    }
  }

  binCreationRecords.set(binId, {
    createdAt: Date.now(),
    method,
    originalSize: size,
  });
}

/**
 * Get creation record for a bin (if tracked and recent).
 */
export function getBinCreationRecord(binId: string): BinCreationRecord | null {
  const record = binCreationRecords.get(binId);
  if (!record) return null;

  // Only return if within threshold
  if (Date.now() - record.createdAt > QUICK_CORRECTION_THRESHOLD_MS) {
    binCreationRecords.delete(binId);
    return null;
  }

  return record;
}

/**
 * Remove a bin from tracking (call on delete).
 */
export function removeBinCreationRecord(binId: string): BinCreationRecord | null {
  const record = binCreationRecords.get(binId);
  binCreationRecords.delete(binId);
  return record ?? null;
}

// ============================================
// UNDO TIMESTAMP TRACKING
// ============================================

/** Timestamp of the last action (for undo timing) */
let lastActionTimestamp = Date.now();

/**
 * Record that an action was performed (call before undoable actions).
 */
export function recordActionTimestamp(): void {
  lastActionTimestamp = Date.now();
}

/**
 * Get time since last action (for undo event).
 */
export function getTimeSinceLastAction(): number {
  return Date.now() - lastActionTimestamp;
}

/**
 * Reset session state (call on new layout or page load).
 */
export function resetMLSession(): void {
  sessionState = {
    prevBinSize: null,
    sessionIndex: 0,
  };
  layoutSession = {
    startTime: Date.now(),
    editCount: 0,
    snapshotCounts: new Map(),
    lastSnapshotTime: new Map(),
  };
}

/**
 * Increment edit count for session tracking.
 * Call this when bins are added, removed, or modified.
 */
export function incrementEditCount(): void {
  layoutSession.editCount++;
}

/**
 * Get current session context for layout snapshots.
 */
export function getSessionContext(): { durationMs: number; editCount: number } {
  return {
    durationMs: Date.now() - layoutSession.startTime,
    editCount: layoutSession.editCount,
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

// Idle detection state
let lastEditTime = Date.now();
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
let hasTrackedIdleForCurrentState = false;

/**
 * Mark that an edit occurred (resets idle timer).
 * Call this when bins are modified.
 */
export function markEditActivity(): void {
  lastEditTime = Date.now();
  hasTrackedIdleForCurrentState = false;
}

/**
 * Quality tier for layout data.
 * Backend can use this to weight training data.
 */
export type LayoutQualityTier = 'high' | 'medium' | 'low' | 'skip';

/**
 * Assess quality of a layout for ML training purposes.
 * Filters out "just trying it out" data.
 */
function assessLayoutQuality(layout: Layout): LayoutQualityTier {
  const bins = layout.bins.filter(b => b.layerId !== STAGING_ID);

  // Skip if too few bins (probably just testing)
  if (bins.length < 3) return 'skip';

  const totalArea = layout.drawer.width * layout.drawer.depth;
  const filledArea = bins.reduce((sum, bin) => sum + (bin.width * bin.depth), 0);
  const fillPct = totalArea > 0 ? (filledArea / totalArea) * 100 : 0;

  // Skip if very low fill (probably just placed a few test bins)
  if (fillPct < 15) return 'skip';

  // Check for variety in bin sizes (not all same size)
  const uniqueSizes = new Set(bins.map(b => `${b.width}x${b.depth}x${b.height}`));
  const hasSizeVariety = uniqueSizes.size >= 2;

  // Check if any bins have labels (shows intentional design)
  const labeledCount = bins.filter(b => b.label?.trim()).length;
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
 * Avoids capturing empty or trivial layouts.
 */
function isSubstantialLayout(layout: Layout): boolean {
  return assessLayoutQuality(layout) !== 'skip';
}

// Cleanup function references (for testing)
let cleanupFunctions: (() => void)[] = [];

/**
 * Initialize ML telemetry listeners.
 * Call once on app startup.
 *
 * @returns Cleanup function to remove event listeners (useful for testing)
 */
export function initMLTelemetry(): () => void {
  if (isInitialized) {
    // Return existing cleanup if already initialized
    return () => cleanupMLTelemetry();
  }
  if (typeof window === 'undefined') {
    return () => {};
  }
  // Skip in development mode (same pattern as initAnalytics)
  if (import.meta.env.DEV) {
    return () => {};
  }

  isInitialized = true;
  cleanupFunctions = [];

  // Subscribe to layout store changes to track edit activity
  // This resets idle timer and increments edit count on local changes
  let storeUnsubscribe: (() => void) | null = null;
  if (layoutStoreSubscribe) {
    storeUnsubscribe = layoutStoreSubscribe((state: { lastEditSource: string | null }) => {
      // Track activity on every local edit
      // Each immer set() call triggers one subscription, so this counts each mutation
      if (state.lastEditSource === 'local') {
        markEditActivity();
        incrementEditCount();
      }
    });
    if (storeUnsubscribe) {
      cleanupFunctions.push(storeUnsubscribe);
    }
  }

  // Flush on page hide (tab switch, close, navigation)
  // Also capture session_end snapshot
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // Capture session_end snapshot before flushing
      if (layoutStoreGetter) {
        const layout = layoutStoreGetter().layout;
        if (isSubstantialLayout(layout)) {
          trackLayoutSnapshot(layout, 'session_end');
        }
      }
      flush();
    }
  };
  window.addEventListener('visibilitychange', handleVisibilityChange);
  cleanupFunctions.push(() => window.removeEventListener('visibilitychange', handleVisibilityChange));

  // Flush on page unload
  window.addEventListener('pagehide', flush);
  cleanupFunctions.push(() => window.removeEventListener('pagehide', flush));

  // Also try beforeunload as fallback
  window.addEventListener('beforeunload', flush);
  cleanupFunctions.push(() => window.removeEventListener('beforeunload', flush));

  // Start idle detection
  const idleIntervalId = setInterval(() => {
    if (!isEnabled()) return;

    const timeSinceEdit = Date.now() - lastEditTime;
    if (timeSinceEdit >= IDLE_THRESHOLD_MS && !hasTrackedIdleForCurrentState) {
      hasTrackedIdleForCurrentState = true;
      if (layoutStoreGetter) {
        const layout = layoutStoreGetter().layout;
        if (isSubstantialLayout(layout)) {
          trackLayoutSnapshot(layout, 'idle');
        }
      }
    }
  }, IDLE_CHECK_INTERVAL_MS);
  cleanupFunctions.push(() => clearInterval(idleIntervalId));

  return () => cleanupMLTelemetry();
}

/**
 * Cleanup ML telemetry listeners.
 * Call in tests or when module is unloaded.
 */
export function cleanupMLTelemetry(): void {
  for (const cleanup of cleanupFunctions) {
    try {
      cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }
  cleanupFunctions = [];
  isInitialized = false;
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
 * Uses stratified sampling to reduce telemetry volume while maintaining
 * data quality. This approach is chosen over random sampling because:
 *
 * 1. **Reproducibility**: Same input produces same sample, making debugging easier
 * 2. **Spatial coverage**: Evenly-spaced samples capture bins across the fill area
 * 3. **Performance**: No need for random number generation
 * 4. **Acceptable bias**: For fill operations, bins are typically uniform in size,
 *    so regular sampling captures representative data. The key metric we care
 *    about (bin sizes in fill operations) isn't affected by position sampling.
 *
 * For fill operations specifically, all bins are usually the same size, so any
 * 5 bins provide equivalent information. For heterogeneous batches (e.g.,
 * paste operations), stratified sampling ensures we get bins from different
 * parts of the selection rather than clustering at the start.
 *
 * @param bins - Array of bins that were placed
 * @param layout - Current layout state
 * @param method - How the bins were placed (usually 'fill' or 'duplicate')
 */
export function trackBulkPlacement(
  bins: Bin[],
  layout: Layout,
  method: PlacementMethod
): void {
  if (!isEnabled()) return;
  if (bins.length === 0) return;

  // Sample up to 5 bins, evenly distributed across the array
  // This captures spatial diversity without flooding telemetry
  const sampleSize = Math.min(bins.length, 5);
  const stride = Math.max(1, Math.floor(bins.length / sampleSize));
  const sampledBins = bins.filter((_, i) => i % stride === 0).slice(0, sampleSize);

  for (const bin of sampledBins) {
    trackBinPlacement(bin, layout, method);
  }
}

// ============================================
// LAYOUT SNAPSHOT TRACKING
// ============================================

/**
 * Compute a hash of the layout for deduplication.
 * Uses bin composition, not positions (order-independent).
 */
function computeLayoutHash(layout: Layout): string {
  const bins = layout.bins.filter(b => b.layerId !== STAGING_ID);

  // Create a deterministic representation of bin composition
  const binSignatures = bins
    .map(b => `${b.width}x${b.depth}x${b.height}:${b.category || 'none'}`)
    .sort()
    .join('|');

  const signature = `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}:${bins.length}:${binSignatures}`;

  // Simple hash (djb2)
  let hash = 5381;
  for (let i = 0; i < signature.length; i++) {
    hash = ((hash << 5) + hash) + signature.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Compute size distribution from bins.
 */
function computeSizeDistribution(bins: Bin[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const bin of bins) {
    if (bin.layerId === STAGING_ID) continue;
    const size = `${bin.width}x${bin.depth}x${bin.height}`;
    distribution[size] = (distribution[size] || 0) + 1;
  }
  return distribution;
}

/**
 * Compute category distribution from bins.
 */
function computeCategoryDistribution(bins: Bin[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const bin of bins) {
    if (bin.layerId === STAGING_ID) continue;
    const category = bin.category || 'uncategorized';
    distribution[category] = (distribution[category] || 0) + 1;
  }
  return distribution;
}

/**
 * Compute domain distribution from bins (based on label vocabulary).
 */
function computeDomainDistribution(bins: Bin[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const bin of bins) {
    if (bin.layerId === STAGING_ID) continue;
    if (!bin.label?.trim()) continue;

    const labelData = processLabel(bin.label);
    const domain = labelData.domain || 'unknown';
    distribution[domain] = (distribution[domain] || 0) + 1;
  }
  return distribution;
}

/**
 * Get top N most common label hashes from bins.
 */
function computeTopLabelHashes(bins: Bin[], n: number): string[] {
  const hashCounts: Record<string, number> = {};

  for (const bin of bins) {
    if (bin.layerId === STAGING_ID) continue;
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
function computeFillPercentage(layout: Layout): number {
  const bins = layout.bins.filter(b => b.layerId !== STAGING_ID);
  const totalArea = layout.drawer.width * layout.drawer.depth;
  if (totalArea === 0) return 0;

  const filledArea = bins.reduce((sum, bin) => sum + (bin.width * bin.depth), 0);
  return Math.round((filledArea / totalArea) * 100);
}

/**
 * Compute percentage of bins that have labels.
 */
function computeLabeledPercentage(bins: Bin[]): number {
  const gridBins = bins.filter(b => b.layerId !== STAGING_ID);
  if (gridBins.length === 0) return 0;

  const labeledCount = gridBins.filter(b => b.label?.trim()).length;
  return Math.round((labeledCount / gridBins.length) * 100);
}

/**
 * Track a layout snapshot at a commit point.
 *
 * @param layout - Current layout state
 * @param trigger - What action triggered the snapshot
 */
export function trackLayoutSnapshot(
  layout: Layout,
  trigger: LayoutSnapshotTrigger
): void {
  if (!isEnabled()) return;

  const layoutHash = computeLayoutHash(layout);
  const now = Date.now();

  // Rate limit: don't send snapshots for same layout within 60s
  // Exception: 'share' and 'print' always go through (high signal)
  if (trigger !== 'share' && trigger !== 'print') {
    const lastTime = layoutSession.lastSnapshotTime.get(layoutHash);
    if (lastTime && now - lastTime < MIN_SNAPSHOT_INTERVAL_MS) {
      return;
    }
  }

  // Update tracking state
  layoutSession.lastSnapshotTime.set(layoutHash, now);
  const snapshotIndex = (layoutSession.snapshotCounts.get(layoutHash) || 0) + 1;
  layoutSession.snapshotCounts.set(layoutHash, snapshotIndex);

  const bins = layout.bins.filter(b => b.layerId !== STAGING_ID);

  // Compute temporal fields
  const temporal = computeTemporalFields();

  const event: LayoutSnapshotEvent = {
    type: 'layout_snapshot',
    trigger,
    layout_hash: layoutHash,
    snapshot_index: snapshotIndex,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    layer_count: layout.layers.length,
    purpose: layout.purpose || null,
    bin_count: bins.length,
    size_distribution: computeSizeDistribution(layout.bins),
    category_distribution: computeCategoryDistribution(layout.bins),
    domain_distribution: computeDomainDistribution(layout.bins),
    top_label_hashes: computeTopLabelHashes(layout.bins, 10),
    fill_percentage: computeFillPercentage(layout),
    labeled_percentage: computeLabeledPercentage(layout.bins),
    session_duration_ms: layoutSession.editCount > 0 ? Date.now() - layoutSession.startTime : 0,
    edit_count: layoutSession.editCount,
    quality_tier: assessLayoutQuality(layout),
    archetype: detectArchetype(layout),
    spatial_patterns: detectSpatialPatterns(layout),
    uniformity_score: computeUniformityScore(bins),
    edge_usage: computeEdgeUsage(bins, layout.drawer),
    hour_of_day: temporal.hour_of_day,
    day_of_week: temporal.day_of_week,
    is_weekend: temporal.is_weekend,
    structure_hash: computeStructureHash(layout),
    vocab_version: VOCAB_VERSION,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// QUALITY SIGNAL TRACKING
// ============================================

/**
 * Track a quality signal for a layout.
 *
 * @param layout - Current layout state
 * @param signal - Type of quality signal
 * @param createdAt - When the layout was created (Date or timestamp)
 */
export function trackQualitySignal(
  layout: Layout,
  signal: QualitySignal,
  createdAt?: Date | number
): void {
  if (!isEnabled()) return;

  const layoutHash = computeLayoutHash(layout);

  // Calculate days since creation (default to 0 if not provided)
  let daysSinceCreation = 0;
  if (createdAt) {
    const createdTime = typeof createdAt === 'number' ? createdAt : createdAt.getTime();
    daysSinceCreation = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
  }

  const event: LayoutQualityEvent = {
    type: 'layout_quality',
    layout_hash: layoutHash,
    signal,
    days_since_creation: daysSinceCreation,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// DRAWER PURPOSE TRACKING
// ============================================

/**
 * Track when user sets drawer purpose.
 *
 * @param layout - Current layout state
 * @param purpose - Selected or entered purpose
 * @param isCustom - True if user entered custom text
 */
export function trackDrawerPurpose(
  layout: Layout,
  purpose: string,
  isCustom: boolean = false
): void {
  if (!isEnabled()) return;

  const layoutHash = computeLayoutHash(layout);

  const event: DrawerPurposeEvent = {
    type: 'drawer_purpose',
    layout_hash: layoutHash,
    purpose: purpose.toLowerCase().trim(),
    is_custom: isCustom,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// CATEGORY CHANGE TRACKING
// ============================================

/**
 * Default category names that we skip tracking (color-based, not meaningful).
 */
const DEFAULT_CATEGORY_NAMES = new Set([
  'coral', 'sky', 'green', 'cloud', 'charcoal',
  'new category', // Default name when creating
]);

/**
 * Check if a category name is a default/color-based name.
 */
function isDefaultCategoryName(name: string): boolean {
  return DEFAULT_CATEGORY_NAMES.has(name.toLowerCase().trim());
}

/**
 * Simple hash for category names (same algorithm as label hashing).
 */
function hashCategoryName(name: string): string {
  const normalized = name.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Track a category change event.
 *
 * Only tracks changes to custom categories (user-created names).
 * Default color-based categories (Coral, Sky, Green, etc.) are skipped.
 *
 * @param bin - The bin being updated
 * @param categoryName - Name of the NEW category (for hashing)
 * @param batchSize - Number of bins changed in this batch (default 1)
 */
export function trackCategoryChange(
  bin: Bin,
  categoryName: string,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  // Skip default/color-based category names - not useful signal
  if (isDefaultCategoryName(categoryName)) return;

  // Process label for correlation learning
  let labelHash: string | null = null;
  let labelDomain: string | null = null;
  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelHash = labelData.hash;
    labelDomain = labelData.domain;
  }

  const event: CategoryChangeEvent = {
    type: 'category_changed',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    category_name_hash: hashCategoryName(categoryName),
    batch_size: batchSize,
    label_hash: labelHash,
    label_domain: labelDomain,
    vocab_version: VOCAB_VERSION,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// BIN RESIZE TRACKING
// ============================================

/**
 * Track a bin resize event.
 *
 * @param oldRect - Original dimensions { width, depth }
 * @param newRect - New dimensions { width, depth }
 * @param height - Bin height (unchanged during resize)
 * @param layout - Current layout state (for fill percentage)
 * @param batchSize - Number of bins resized together (default 1)
 */
export function trackBinResize(
  oldRect: { width: number; depth: number },
  newRect: { width: number; depth: number },
  height: number,
  layout: Layout,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  // Skip if dimensions didn't actually change
  if (oldRect.width === newRect.width && oldRect.depth === newRect.depth) return;

  const dimensionsChanged: ('width' | 'depth')[] = [];
  if (oldRect.width !== newRect.width) dimensionsChanged.push('width');
  if (oldRect.depth !== newRect.depth) dimensionsChanged.push('depth');

  const event: BinResizeEvent = {
    type: 'bin_resized',
    old_size: `${oldRect.width}x${oldRect.depth}x${height}`,
    new_size: `${newRect.width}x${newRect.depth}x${height}`,
    dimensions_changed: dimensionsChanged,
    batch_size: batchSize,
    fill_pct: computeFillPercentage(layout),
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// BIN DELETION TRACKING
// ============================================

/**
 * Track a bin deletion event.
 *
 * Deletion is an important negative signal - it indicates bins that
 * users found unsuitable, wrongly placed, or no longer needed.
 *
 * @param bin - The bin being deleted (capture BEFORE deletion)
 * @param layout - Current layout state (for layer index and fill percentage)
 * @param method - How the bin was deleted
 * @param batchSize - Number of bins deleted together (default 1)
 */
export function trackBinDeletion(
  bin: Bin,
  layout: Layout,
  method: DeleteMethod,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  // Find layer index
  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  // Process label domain for correlation
  let labelDomain: string | null = null;
  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelDomain = labelData.domain;
  }

  // Calculate fill percentage AFTER deletion (approximate by subtracting this bin)
  // Note: computeFillPercentage already excludes STAGING_ID bins, so don't double-subtract
  const currentFill = computeFillPercentage(layout);
  const totalArea = layout.drawer.width * layout.drawer.depth;
  const binArea = bin.width * bin.depth;
  const subtractsFromFill = bin.layerId !== STAGING_ID;
  const fillAfter = totalArea > 0
    ? subtractsFromFill
      ? Math.max(0, currentFill - Math.round((binArea / totalArea) * 100))
      : currentFill
    : 0;

  const event: BinDeletedEvent = {
    type: 'bin_deleted',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    position: `${bin.x},${bin.y}`,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    had_label: Boolean(bin.label?.trim()),
    label_domain: labelDomain,
    age_ms: null, // We don't track bin creation time currently
    batch_size: batchSize,
    fill_pct: fillAfter,
    method,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// BIN MOVE TRACKING
// ============================================

/**
 * Track a bin move event.
 *
 * Move tracking helps understand position adjustment patterns -
 * whether users commonly reposition bins after initial placement.
 *
 * @param bin - The bin after being moved
 * @param oldPosition - Original position { x, y }
 * @param layout - Current layout state
 * @param method - How the bin was moved (drag or nudge)
 * @param batchSize - Number of bins moved together (default 1)
 */
export function trackBinMove(
  bin: Bin,
  oldPosition: { x: number; y: number },
  layout: Layout,
  method: MoveMethod,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  // Skip if position didn't actually change
  if (oldPosition.x === bin.x && oldPosition.y === bin.y) return;

  // Find layer index
  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  // Calculate Manhattan distance
  const distance = Math.abs(bin.x - oldPosition.x) + Math.abs(bin.y - oldPosition.y);

  const event: BinMovedEvent = {
    type: 'bin_moved',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    old_position: `${oldPosition.x},${oldPosition.y}`,
    new_position: `${bin.x},${bin.y}`,
    distance,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    batch_size: batchSize,
    method,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// DRAWER RESIZE TRACKING
// ============================================

/**
 * Track a drawer resize event.
 *
 * @param oldDrawer - Original drawer dimensions
 * @param newDrawer - New drawer dimensions
 * @param layout - Current layout state (after resize)
 * @param binsStaged - Number of bins moved to staging due to resize
 */
export function trackDrawerResize(
  oldDrawer: { width: number; depth: number; height: number },
  newDrawer: { width: number; depth: number; height: number },
  layout: Layout,
  binsStaged: number = 0
): void {
  if (!isEnabled()) return;

  // Skip if dimensions didn't actually change
  if (
    oldDrawer.width === newDrawer.width &&
    oldDrawer.depth === newDrawer.depth &&
    oldDrawer.height === newDrawer.height
  ) return;

  const dimensionsChanged: ('width' | 'depth' | 'height')[] = [];
  if (oldDrawer.width !== newDrawer.width) dimensionsChanged.push('width');
  if (oldDrawer.depth !== newDrawer.depth) dimensionsChanged.push('depth');
  if (oldDrawer.height !== newDrawer.height) dimensionsChanged.push('height');

  const event: DrawerResizedEvent = {
    type: 'drawer_resized',
    old_size: `${oldDrawer.width}x${oldDrawer.depth}x${oldDrawer.height}`,
    new_size: `${newDrawer.width}x${newDrawer.depth}x${newDrawer.height}`,
    dimensions_changed: dimensionsChanged,
    bins_staged: binsStaged,
    fill_pct: computeFillPercentage(layout),
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// FILL OPERATION TRACKING
// ============================================

/**
 * Track a fill operation.
 *
 * @param method - 'uniform' for fillAllWithSize, 'gaps' for fillGaps
 * @param binsCreated - Number of bins created by the fill
 * @param layerId - Layer where fill was applied
 * @param layout - Current layout state (after fill)
 * @param fillSize - Bin dimensions used for uniform fill (null for gap fill)
 */
export function trackFillOperation(
  method: FillMethod,
  binsCreated: number,
  layerId: string,
  layout: Layout,
  fillSize?: { width: number; depth: number }
): void {
  if (!isEnabled()) return;

  // Skip if no bins were created
  if (binsCreated === 0) return;

  const layerIndex = layout.layers.findIndex((l) => l.id === layerId);

  const event: FillOperationEvent = {
    type: 'fill_operation',
    method,
    fill_size: fillSize ? `${fillSize.width}x${fillSize.depth}` : null,
    bins_created: binsCreated,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    fill_pct: computeFillPercentage(layout),
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// LAYER MOVEMENT TRACKING
// ============================================

/**
 * Track bins moving between layers.
 *
 * @param bin - Representative bin that was moved
 * @param fromLayerId - Original layer ID (or STAGING_ID)
 * @param toLayerId - New layer ID (or STAGING_ID)
 * @param layout - Current layout state
 * @param method - How the move was initiated
 * @param batchSize - Number of bins moved together
 */
export function trackLayerMove(
  bin: Bin,
  fromLayerId: string,
  toLayerId: string,
  layout: Layout,
  method: LayerMoveMethod,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  // Skip if layer didn't change
  if (fromLayerId === toLayerId) return;

  // Convert layer IDs to indices (-1 for staging)
  const fromIndex = fromLayerId === STAGING_ID
    ? -1
    : layout.layers.findIndex((l) => l.id === fromLayerId);
  const toIndex = toLayerId === STAGING_ID
    ? -1
    : layout.layers.findIndex((l) => l.id === toLayerId);

  const event: LayerMoveEvent = {
    type: 'layer_move',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    from_layer_index: fromIndex >= 0 ? fromIndex : (fromLayerId === STAGING_ID ? -1 : 0),
    to_layer_index: toIndex >= 0 ? toIndex : (toLayerId === STAGING_ID ? -1 : 0),
    batch_size: batchSize,
    method,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// BIN ROTATION TRACKING
// ============================================

/**
 * Track a bin rotation event.
 *
 * @param bin - The bin before rotation
 * @param batchSize - Number of bins rotated together
 */
export function trackBinRotation(
  bin: Bin,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  const event: BinRotatedEvent = {
    type: 'bin_rotated',
    old_size: `${bin.width}x${bin.depth}x${bin.height}`,
    new_size: `${bin.depth}x${bin.width}x${bin.height}`, // Rotated: width/depth swapped
    batch_size: batchSize,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ============================================
// NEGATIVE SIGNAL TRACKING
// ============================================

/**
 * Track a placement rejection (cancelled draw/paint).
 *
 * @param reason - Why the placement was rejected
 * @param mode - 'draw' or 'paint'
 * @param interaction - The interaction state at rejection time
 * @param layout - Current layout state
 * @param activeLayerId - Active layer ID
 */
export function trackPlacementRejection(
  reason: RejectionReason,
  mode: 'draw' | 'paint',
  interaction: { start: { x: number; y: number }; current: { x: number; y: number } } | null,
  layout: Layout,
  activeLayerId: string
): void {
  if (!isEnabled()) return;

  // Calculate intended size/position if we have interaction data
  let intendedSize: string | null = null;
  let intendedPosition: string | null = null;

  if (interaction) {
    const x1 = Math.min(interaction.start.x, interaction.current.x);
    const y1 = Math.min(interaction.start.y, interaction.current.y);
    const x2 = Math.max(interaction.start.x, interaction.current.x);
    const y2 = Math.max(interaction.start.y, interaction.current.y);

    const width = x2 - x1 + 1; // Assuming minimum size of 1
    const depth = y2 - y1 + 1;

    // Only track if there was meaningful intent (rectangle > 0)
    if (width > 0 && depth > 0) {
      intendedSize = `${width}x${depth}`;
      intendedPosition = `${x1},${y1}`;
    }
  }

  // Skip if no intent captured (immediate cancel with no movement)
  if (!intendedSize && reason !== 'cancelled') return;

  const layerIndex = layout.layers.findIndex((l) => l.id === activeLayerId);

  const event: PlacementRejectedEvent = {
    type: 'placement_rejected',
    rejection_reason: reason,
    intended_size: intendedSize,
    intended_position: intendedPosition,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    fill_pct: computeFillPercentage(layout),
    mode,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Track an undo operation.
 *
 * @param previousLayout - Layout state before undo
 * @param currentLayout - Layout state after undo
 */
export function trackUndo(
  previousLayout: Layout,
  currentLayout: Layout
): void {
  if (!isEnabled()) return;

  // Determine what type of action was undone by comparing layouts
  const prevBins = previousLayout.bins.filter(b => b.layerId !== STAGING_ID);
  const currBins = currentLayout.bins.filter(b => b.layerId !== STAGING_ID);

  const prevBinIds = new Set(prevBins.map(b => b.id));
  const currBinIds = new Set(currBins.map(b => b.id));

  // Count differences
  const addedBins = currBins.filter(b => !prevBinIds.has(b.id));
  const removedBins = prevBins.filter(b => !currBinIds.has(b.id));

  // Determine action type
  let actionUndone: UndoActionType = 'other';
  let binsAffected = 0;

  if (removedBins.length > 0 && addedBins.length === 0) {
    // Bins were removed = undoing a placement
    actionUndone = 'placement';
    binsAffected = removedBins.length;
  } else if (addedBins.length > 0 && removedBins.length === 0) {
    // Bins were restored = undoing a deletion
    actionUndone = 'deletion';
    binsAffected = addedBins.length;
  } else if (addedBins.length === 0 && removedBins.length === 0) {
    // Same bins, check for position/size changes
    const changedBins = currBins.filter(currBin => {
      const prevBin = prevBins.find(b => b.id === currBin.id);
      if (!prevBin) return false;
      return prevBin.x !== currBin.x ||
             prevBin.y !== currBin.y ||
             prevBin.width !== currBin.width ||
             prevBin.depth !== currBin.depth ||
             prevBin.layerId !== currBin.layerId;
    });

    if (changedBins.length > 0) {
      const prevBin = prevBins.find(b => b.id === changedBins[0].id);
      const currBin = changedBins[0];
      if (prevBin) {
        if (prevBin.width !== currBin.width || prevBin.depth !== currBin.depth) {
          actionUndone = 'resize';
        } else if (prevBin.layerId !== currBin.layerId) {
          actionUndone = 'layer_change';
        } else {
          actionUndone = 'move';
        }
      }
      binsAffected = changedBins.length;
    }
  } else {
    // Mixed changes
    actionUndone = 'other';
    binsAffected = Math.max(addedBins.length, removedBins.length);
  }

  // Check for drawer resize
  if (
    previousLayout.drawer.width !== currentLayout.drawer.width ||
    previousLayout.drawer.depth !== currentLayout.drawer.depth ||
    previousLayout.drawer.height !== currentLayout.drawer.height
  ) {
    actionUndone = 'drawer_resize';
  }

  // Check for fill (large number of placements undone)
  if (actionUndone === 'placement' && binsAffected >= 3) {
    actionUndone = 'fill';
  }

  const event: UndoEvent = {
    type: 'undo',
    action_undone: actionUndone,
    bins_affected: binsAffected,
    time_since_action_ms: getTimeSinceLastAction(),
    drawer_size: `${currentLayout.drawer.width}x${currentLayout.drawer.depth}x${currentLayout.drawer.height}`,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Track a quick correction (delete/resize shortly after placement).
 *
 * @param correctionType - Type of correction
 * @param binId - ID of the bin being corrected
 * @param bin - Current bin state
 * @param layout - Current layout state
 * @param newSize - New size for resize (null for delete)
 */
export function trackQuickCorrection(
  correctionType: 'delete' | 'resize' | 'move',
  binId: string,
  bin: Bin,
  layout: Layout,
  newSize?: { width: number; depth: number; height: number }
): void {
  if (!isEnabled()) return;

  // Get creation record
  const record = correctionType === 'delete'
    ? removeBinCreationRecord(binId)
    : getBinCreationRecord(binId);

  if (!record) return; // Not a recent placement

  const timeSincePlacement = Date.now() - record.createdAt;

  // Only track if within threshold
  if (timeSincePlacement > QUICK_CORRECTION_THRESHOLD_MS) return;

  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  const event: QuickCorrectionEvent = {
    type: 'quick_correction',
    correction_type: correctionType,
    original_size: record.originalSize,
    new_size: newSize ? `${newSize.width}x${newSize.depth}x${newSize.height}` : null,
    placement_method: record.method,
    time_to_correction_ms: timeSincePlacement,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
  };

  eventBuffer.push(event);

  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
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
