import type { LayoutPreview } from './preview';
/**
 * A point-in-time snapshot of a layout, displayed in the History panel.
 * The actual layout data is stored compressed in IndexedDB — only metadata is kept in memory.
 */
export interface Snapshot {
  /** Unique ID: `${layoutId}-${timestamp}` */
  id: string;
  /** The layout this snapshot belongs to */
  layoutId: string;
  /** When the snapshot was created (Unix ms) */
  timestamp: number;
  /** Optional user annotation (labeled snapshots are exempt from rolling eviction) */
  label?: string;
  /** Cached preview metadata for UI display without decompressing */
  preview: LayoutPreview;
}

/**
 * Internal storage format — layout stored as compressed string in IndexedDB.
 */
export interface CompressedSnapshot {
  id: string;
  layoutId: string;
  timestamp: number;
  label?: string;
  preview: LayoutPreview;
  compressedLayout: string;
}
