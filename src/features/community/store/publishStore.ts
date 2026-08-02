import { create } from 'zustand';
import type { CommunityCategory } from '@/shared/types/community';
import type { CommunityClientError, CommunityPublishResult } from '../api/client';
import { loadDisplayName, saveDisplayName } from '../utils/displayName';

export type PublishDialogPhase =
  'closed' | 'signin' | 'identity' | 'form' | 'publishing' | 'success' | 'error';

export type PublishDialogMode = 'create' | 'update';

export interface PublishPrefill {
  name: string;
  description: string;
  category: CommunityCategory | null;
}

export interface OpenPublishDialogPayload {
  mode: PublishDialogMode;
  signedIn: boolean;
}

// Captures and prefill deliberately live elsewhere (core communityPublish
// store and the dialog's local state); duplicating them here invited drift.
interface PublishDialogState {
  phase: PublishDialogPhase;
  mode: PublishDialogMode;
  displayName: string;
  success: CommunityPublishResult | null;
  error: CommunityClientError | null;
}

interface PublishDialogActions {
  open: (payload: OpenPublishDialogPayload) => void;
  completeSignIn: () => void;
  confirmIdentity: (name: string) => void;
  beginPublishing: () => void;
  succeed: (result: CommunityPublishResult) => void;
  fail: (error: CommunityClientError) => void;
  backToForm: () => void;
  switchToCreate: () => void;
  reset: () => void;
}

export type PublishDialogStore = PublishDialogState & PublishDialogActions;

export const INITIAL_PUBLISH_DIALOG_STATE: PublishDialogState = {
  phase: 'closed',
  mode: 'create',
  displayName: '',
  success: null,
  error: null,
};

function phaseAfterAuth(displayName: string): PublishDialogPhase {
  return displayName === '' ? 'identity' : 'form';
}

export const usePublishDialogStore = create<PublishDialogStore>((set, get) => ({
  ...INITIAL_PUBLISH_DIALOG_STATE,
  open: ({ mode, signedIn }) => {
    const displayName = loadDisplayName();
    set({
      phase: signedIn ? phaseAfterAuth(displayName) : 'signin',
      mode,
      displayName,
      success: null,
      error: null,
    });
  },
  completeSignIn: () => {
    if (get().phase !== 'signin') return;
    const displayName = loadDisplayName();
    set({ phase: phaseAfterAuth(displayName), displayName });
  },
  confirmIdentity: (name) => {
    if (get().phase !== 'identity') return;
    const trimmed = name.trim();
    if (trimmed === '') return;
    saveDisplayName(trimmed);
    set({ phase: 'form', displayName: loadDisplayName() });
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
    set({ phase: 'error', error });
  },
  backToForm: () => {
    if (get().phase !== 'error') return;
    set({ phase: 'form', error: null });
  },
  switchToCreate: () => {
    if (get().phase === 'closed') return;
    set({ mode: 'create' });
  },
  reset: () => {
    set(INITIAL_PUBLISH_DIALOG_STATE);
  },
}));
