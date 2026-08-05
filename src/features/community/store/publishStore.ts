import { create } from 'zustand';
import type { CommunityCategory } from '@/shared/types/community';
import type {
  CommunityCapabilities,
  CommunityClientError,
  CommunityPublishResult,
} from '../api/client';
import { loadDisplayName, saveDisplayName } from '../utils/displayName';

/**
 * `error` is deliberately not a phase. A failed publish used to unmount the
 * whole form, so a server complaint about the name ("too short", "low effort",
 * "duplicate") became a full-screen dead end that discarded the user's view of
 * what they had typed. Failures now return to `form` and surface as a banner
 * plus an inline error on the offending field.
 */
export type PublishDialogPhase =
  'closed' | 'loading' | 'unavailable' | 'form' | 'publishing' | 'success';

export type PublishDialogMode = 'create' | 'update';

export interface PublishPrefill {
  name: string;
  description: string;
  category: CommunityCategory | null;
}

export interface OpenPublishDialogPayload {
  mode: PublishDialogMode;
}

// Captures and prefill deliberately live elsewhere (core communityPublish
// store and the dialog's local state); duplicating them here invited drift.
interface PublishDialogState {
  phase: PublishDialogPhase;
  mode: PublishDialogMode;
  displayName: string;
  /** Null until the capability probe resolves; the probe gates `form`. */
  capabilities: CommunityCapabilities | null;
  /** Set when the probe itself failed, so the dialog can offer a retry. */
  probeError: CommunityClientError | null;
  success: CommunityPublishResult | null;
  /** Last publish failure, shown against the still-mounted form. */
  error: CommunityClientError | null;
}

interface PublishDialogActions {
  open: (payload: OpenPublishDialogPayload) => void;
  /** Resolves the capability probe: a disabled deployment never reaches `form`. */
  ready: (capabilities: CommunityCapabilities) => void;
  failProbe: (error: CommunityClientError) => void;
  setDisplayName: (name: string) => void;
  beginPublishing: () => void;
  succeed: (result: CommunityPublishResult) => void;
  fail: (error: CommunityClientError) => void;
  dismissError: () => void;
  switchToCreate: () => void;
  reset: () => void;
}

export type PublishDialogStore = PublishDialogState & PublishDialogActions;

export const INITIAL_PUBLISH_DIALOG_STATE: PublishDialogState = {
  phase: 'closed',
  mode: 'create',
  displayName: '',
  capabilities: null,
  probeError: null,
  success: null,
  error: null,
};

export const usePublishDialogStore = create<PublishDialogStore>((set, get) => ({
  ...INITIAL_PUBLISH_DIALOG_STATE,
  open: ({ mode }) => {
    set({
      ...INITIAL_PUBLISH_DIALOG_STATE,
      phase: 'loading',
      mode,
      displayName: loadDisplayName(),
    });
  },
  ready: (capabilities) => {
    if (get().phase !== 'loading') return;
    set({
      capabilities,
      probeError: null,
      phase: capabilities.publishEnabled ? 'form' : 'unavailable',
    });
  },
  failProbe: (error) => {
    if (get().phase !== 'loading') return;
    // A probe that cannot reach the server says nothing about whether
    // publishing is on, so fall through to the form rather than claiming the
    // feature is off. The publish attempt itself remains the real gate.
    set({ probeError: error, phase: 'form' });
  },
  setDisplayName: (name) => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    saveDisplayName(trimmed);
    set({ displayName: loadDisplayName() });
  },
  beginPublishing: () => {
    if (get().phase !== 'form') return;
    set({ phase: 'publishing', error: null });
  },
  succeed: (result) => {
    if (get().phase !== 'publishing') return;
    set({ phase: 'success', success: result });
  },
  fail: (error) => {
    if (get().phase !== 'publishing') return;
    set({ phase: 'form', error });
  },
  dismissError: () => {
    set({ error: null });
  },
  switchToCreate: () => {
    if (get().phase === 'closed') return;
    set({ mode: 'create' });
  },
  reset: () => {
    set(INITIAL_PUBLISH_DIALOG_STATE);
  },
}));
