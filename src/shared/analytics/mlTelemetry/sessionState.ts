import type { PlacementMethod } from './types';

// ============================================
// SESSION STATE
// ============================================

export interface SessionState {
  /** Last bin size placed this session */
  prevBinSize: string | null;
  /** Number of bins placed this session */
  sessionIndex: number;
  /** Full sequence of bin sizes placed this session */
  sizeSequence: string[];
  /** Timestamp of first bin placement, or null if none */
  firstBinTime: number | null;
}

export let sessionState: SessionState = {
  prevBinSize: null,
  sessionIndex: 0,
  sizeSequence: [],
  firstBinTime: null,
};

/**
 * Layout session state for snapshot tracking.
 */
export interface LayoutSessionState {
  /** When the current layout session started */
  startTime: number;
  /** Number of edits in this session */
  editCount: number;
  /** Snapshot counts by layout hash (for deduplication) */
  snapshotCounts: Map<string, number>;
  /** Last snapshot timestamp by layout hash (for rate limiting) */
  lastSnapshotTime: Map<string, number>;
  /** Number of undo operations this session */
  undoCount: number;
  /** Number of bins deleted this session */
  deletedCount: number;
  /** Number of resize operations this session */
  resizeCount: number;
  /** Number of move operations this session */
  moveCount: number;
  /** Timestamp of last edit action (placement, resize, move, delete) */
  lastEditTime: number;
  /** Rolling window of recent placements for sequence learning (max 5) */
  recentPlacements: Array<{
    size: string;
    labelHash: string | null;
    position: string;
    timestamp: number;
  }>;
}

export let layoutSession: LayoutSessionState = {
  startTime: Date.now(),
  editCount: 0,
  snapshotCounts: new Map(),
  lastSnapshotTime: new Map(),
  undoCount: 0,
  deletedCount: 0,
  resizeCount: 0,
  moveCount: 0,
  lastEditTime: Date.now(),
  recentPlacements: [],
};

// Minimum time between snapshots for same layout (60 seconds)
export const MIN_SNAPSHOT_INTERVAL_MS = 60_000;

// ============================================
// BIN TIMESTAMP TRACKING (for quick-correction detection)
// ============================================

/**
 * Tracks when bins were created and how they were placed.
 * Used to detect quick corrections (delete/resize shortly after placement).
 */
export interface BinCreationRecord {
  createdAt: number;
  method: PlacementMethod;
  originalSize: string;
}

/** Map of bin ID to creation record */
const binCreationRecords: Map<string, BinCreationRecord> = new Map();

/** Threshold for "quick" corrections (30 seconds) */
export const QUICK_CORRECTION_THRESHOLD_MS = 30_000;

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
    sizeSequence: [],
    firstBinTime: null,
  };
  layoutSession = {
    startTime: Date.now(),
    editCount: 0,
    snapshotCounts: new Map(),
    lastSnapshotTime: new Map(),
    undoCount: 0,
    deletedCount: 0,
    resizeCount: 0,
    moveCount: 0,
    lastEditTime: Date.now(),
    recentPlacements: [],
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
// IDLE / EDIT ACTIVITY TRACKING
// ============================================

/** Tracks last edit time for idle detection */
let lastEditTime = Date.now();
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
 * Get time since last edit (for idle detection).
 */
export function getTimeSinceLastEdit(): number {
  return Date.now() - lastEditTime;
}

/**
 * Check and set idle tracking flag.
 * Returns true if idle has NOT been tracked yet for current state.
 */
export function checkAndSetIdleTracked(): boolean {
  if (hasTrackedIdleForCurrentState) return false;
  hasTrackedIdleForCurrentState = true;
  return true;
}
