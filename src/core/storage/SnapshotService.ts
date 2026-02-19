/**
 * SnapshotService — Manages periodic layout snapshots stored in IndexedDB.
 *
 * Snapshots provide a version history for each layout, with:
 * - Automatic rolling window (max 10 unlabeled snapshots per layout)
 * - Labeled snapshots exempt from eviction
 * - Compressed storage to minimize IndexedDB usage
 *
 * All functions are async since they interact with IndexedDB.
 */

import {
  saveSnapshot as saveSnapshotToDB,
  getSnapshotsByLayoutId,
  getSnapshot,
  deleteSnapshot as deleteSnapshotFromDB,
  deleteSnapshotsByLayoutId,
  updateSnapshot,
} from './backends/indexedDB';
import { compressLayout, decompressLayout } from '@/shared/utils';
import { computePreview } from './LayoutManager';
import type { Layout, Snapshot, CompressedSnapshot } from '@/core/types';

/** Maximum number of unlabeled (auto-created) snapshots per layout */
export const MAX_UNLABELED_SNAPSHOTS = 10;

/**
 * Strip compressed layout data from a CompressedSnapshot to produce a Snapshot.
 * Used to avoid holding full layout data in memory for the history panel.
 */
function toSnapshot(compressed: CompressedSnapshot): Snapshot {
  return {
    id: compressed.id,
    layoutId: compressed.layoutId,
    timestamp: compressed.timestamp,
    label: compressed.label,
    preview: compressed.preview,
  };
}

/**
 * Create a snapshot of the current layout state.
 *
 * Compresses the layout, computes preview metadata, enforces the rolling
 * window (evicts oldest unlabeled snapshots beyond MAX_UNLABELED_SNAPSHOTS),
 * and saves to IndexedDB.
 */
export async function createSnapshot(
  layoutId: string,
  layout: Layout,
  label?: string
): Promise<Snapshot> {
  const timestamp = Date.now();
  const id = `${layoutId}-${timestamp}`;
  const preview = computePreview(layout);
  const compressedLayout = compressLayout(layout);

  const compressed: CompressedSnapshot = {
    id,
    layoutId,
    timestamp,
    label,
    preview,
    compressedLayout,
  };

  // Enforce rolling window: evict oldest unlabeled if at capacity
  const existing = await getSnapshotsByLayoutId(layoutId);
  const unlabeled = existing.filter((s) => !s.label).sort((a, b) => a.timestamp - b.timestamp);

  if (unlabeled.length >= MAX_UNLABELED_SNAPSHOTS) {
    const toEvict = unlabeled.slice(0, unlabeled.length - MAX_UNLABELED_SNAPSHOTS + 1);
    for (const s of toEvict) {
      await deleteSnapshotFromDB(s.id);
    }
  }

  await saveSnapshotToDB(compressed);

  return toSnapshot(compressed);
}

/**
 * Load all snapshots for a layout (metadata only, no decompressed layouts).
 * Returns sorted newest-first.
 */
export async function loadSnapshots(layoutId: string): Promise<Snapshot[]> {
  const compressed = await getSnapshotsByLayoutId(layoutId);
  return compressed.map(toSnapshot);
}

/**
 * Load and decompress a single snapshot's layout data.
 * Returns null if the snapshot doesn't exist or decompression fails.
 */
export async function restoreSnapshot(snapshotId: string): Promise<Layout | null> {
  const compressed = await getSnapshot(snapshotId);
  if (!compressed) {
    return null;
  }
  return decompressLayout(compressed.compressedLayout);
}

/**
 * Delete a single snapshot.
 */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
  await deleteSnapshotFromDB(snapshotId);
}

/**
 * Delete all snapshots for a layout (called when layout is deleted).
 */
export async function deleteSnapshotsForLayout(layoutId: string): Promise<void> {
  await deleteSnapshotsByLayoutId(layoutId);
}

/**
 * Update the label on an existing snapshot.
 */
export async function updateSnapshotLabel(snapshotId: string, label: string): Promise<void> {
  const existing = await getSnapshot(snapshotId);
  if (!existing) {
    throw new Error('Snapshot not found');
  }
  await updateSnapshot({ ...existing, label });
}
