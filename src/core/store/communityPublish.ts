import { create } from 'zustand';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesignLineage, CommunityPublishDraft } from '@/shared/types/community';

/**
 * Composition seam between the bin designer and the community slice (which
 * must not import each other): the designer opens the publish dialog through
 * this core store, mirroring binExampleGallery's shape. The shell-mounted
 * dialog in features/community reads it. Handlers point back into the
 * designer so the dialog can persist publish state and request re-captures
 * without a cross-feature import.
 */

export interface CommunityPublishCaptures {
  /** WebP data URLs or raw base64, preset-angle order. */
  thumbnails: string[];
  /** Raw base64 GLB exported from the live preview mesh. */
  glb: string;
}

export interface CommunityPublishDesignContext {
  designId: string;
  designName: string;
  params: BinParams;
  paramsHash: string;
  /** Set when the local design is already published; drives update mode. */
  publishedId: string | null;
  lineage: CommunityDesignLineage | null;
  /** Form fields restored after an OAuth round trip; null on a fresh open. */
  draft: CommunityPublishDraft | null;
}

export interface CommunityPublishHandlers {
  /** Resolves false when the publish link could not be recorded locally. */
  onPublished: (publishedId: string) => Promise<boolean>;
  onUnpublished: () => void;
  requestRecapture: () => void;
}

interface CommunityPublishState {
  isOpen: boolean;
  context: CommunityPublishDesignContext | null;
  captures: CommunityPublishCaptures | null;
  /** True when a capture attempt completed without producing assets. */
  captureFailed: boolean;
  /**
   * Monotonic token bumped on every open() and beginCapture(), never reset:
   * an in-flight capture records it at start and its results are rejected if
   * a newer open/capture superseded it (close/reopen with edited params).
   */
  captureEpoch: number;
  handlers: CommunityPublishHandlers | null;
}

interface CommunityPublishActions {
  open: (
    context: CommunityPublishDesignContext,
    captures?: CommunityPublishCaptures,
    handlers?: CommunityPublishHandlers
  ) => void;
  setCaptures: (captures: CommunityPublishCaptures) => void;
  /** Returns the epoch the new capture attempt runs under. */
  beginCapture: () => number;
  setCaptureFailed: () => void;
  clearContextPublishedId: () => void;
  close: () => void;
}

export type CommunityPublishStore = CommunityPublishState & CommunityPublishActions;

export const INITIAL_COMMUNITY_PUBLISH_STATE: CommunityPublishState = {
  isOpen: false,
  context: null,
  captures: null,
  captureFailed: false,
  captureEpoch: 0,
  handlers: null,
};

export const useCommunityPublishStore = create<CommunityPublishStore>((set, get) => ({
  ...INITIAL_COMMUNITY_PUBLISH_STATE,
  open: (context, captures, handlers) => {
    set((s) => ({
      isOpen: true,
      context,
      captures: captures ?? null,
      captureFailed: false,
      captureEpoch: s.captureEpoch + 1,
      handlers: handlers ?? null,
    }));
  },
  setCaptures: (captures) => {
    set({ captures, captureFailed: false });
  },
  beginCapture: () => {
    set((s) => ({ captureFailed: false, captureEpoch: s.captureEpoch + 1 }));
    return get().captureEpoch;
  },
  setCaptureFailed: () => {
    set({ captureFailed: true });
  },
  clearContextPublishedId: () => {
    set((s) => ({
      context: s.context === null ? null : { ...s.context, publishedId: null },
    }));
  },
  close: () => {
    // captureEpoch survives the reset; rewinding it would let a stale
    // in-flight capture from the previous open pass the epoch check.
    set((s) => ({ ...INITIAL_COMMUNITY_PUBLISH_STATE, captureEpoch: s.captureEpoch }));
  },
}));
