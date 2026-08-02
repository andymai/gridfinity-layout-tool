import type { DesignId } from '@/core/types';
import type { CommunityDesignLineage } from '@/shared/types/community';
import type { ItemEnvelope, ItemKind, ItemStructure } from '@/shared/types/item';
import type { BinParams } from './binParams';
import type { ExportFileNameConfig } from './uiState';

/** Current thumbnail version - increment when changing thumbnail size/quality/format */
export const THUMBNAIL_VERSION = 6;

/** Saved design entry in IndexedDB */
export interface SavedDesign {
  readonly id: DesignId;
  readonly name: string;
  /** Canonical for kind 'bin' + legacy designs; omitted for non-bin kinds. */
  readonly params?: BinParams;
  /** Item kind. Absent => 'bin' (back-compat). */
  readonly kind?: ItemKind;
  /** Envelope + structure — present for non-bin kinds. */
  readonly envelope?: ItemEnvelope;
  readonly structure?: ItemStructure;
  readonly thumbnail: string | null;
  /** Thumbnail format version for detecting outdated thumbnails */
  readonly thumbnailVersion?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Per-design export filename preference (null = use defaults) */
  readonly exportFileNameConfig: ExportFileNameConfig | null;
  /** User-assigned organization tags. Absent on pre-tags designs. */
  readonly tags?: readonly string[];
  /** Community publish id. `null` = explicitly unpublished; absent = never published. */
  readonly publishedId?: string | null;
  /** Remix lineage snapshot; describes where the design's content came from. */
  readonly lineage?: CommunityDesignLineage | null;
}

// Store Types
