import type { IndexEntry, SyncItemKind } from '../../../api/lib/userIndex.js';

export type Kind = SyncItemKind;

export interface BlobRow {
  uid: string;
  kind: Kind;
  id: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface IndexRow {
  uid: string;
  kind: Kind;
  id: string;
  entry: IndexEntry;
  tombstone: boolean;
}

export interface Inventory {
  blobs: BlobRow[];
  blobMap: Map<string, BlobRow>;
  indexRows: IndexRow[];
  indexMap: Map<string, IndexRow>;
  blobUsers: Set<string>;
  redisUsers: Set<string>;
}

export type FindingKind =
  | 'orphan_blob'
  | 'tombstone_with_blob'
  | 'missing_blob'
  | 'malformed_index_entry'
  | 'modifiedAt_mismatch'
  | 'envelope_invalid'
  | 'payload_invalid'
  | 'sanitization_drift'
  | 'index_size_undercount'
  | 'listing_size_mismatch'
  | 'fetch_timeout'
  | 'stale_tombstone';

export interface Finding {
  kind: FindingKind;
  uid: string;
  itemKind?: Kind;
  id?: string;
  severity: 'error' | 'warn' | 'info';
  detail: string;
  data?: Record<string, unknown>;
}
