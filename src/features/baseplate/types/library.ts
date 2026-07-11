import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';

/** Saved baseplate design entry in the global baseplate library (IndexedDB). */
export interface SavedBaseplateDesign {
  readonly id: BaseplateDesignId;
  readonly name: string;
  readonly params: StoredBaseplateParams;
  readonly thumbnail: string | null;
  /** Thumbnail format version for detecting outdated thumbnails */
  readonly thumbnailVersion?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
