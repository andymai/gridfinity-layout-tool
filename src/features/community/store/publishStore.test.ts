import { describe, it, expect, beforeEach } from 'vitest';
import { INITIAL_PUBLISH_DIALOG_STATE, usePublishDialogStore } from './publishStore';
import type { OpenPublishDialogPayload } from './publishStore';
import { loadDisplayName, saveDisplayName } from '../utils/displayName';

function openPayload(overrides: Partial<OpenPublishDialogPayload> = {}): OpenPublishDialogPayload {
  return {
    mode: 'create',
    signedIn: true,
    ...overrides,
  };
}

describe('publishStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePublishDialogStore.setState(INITIAL_PUBLISH_DIALOG_STATE);
  });

  it('starts closed', () => {
    expect(usePublishDialogStore.getState().phase).toBe('closed');
  });

  describe('open', () => {
    it('goes to signin when signed out', () => {
      usePublishDialogStore.getState().open(openPayload({ signedIn: false }));
      expect(usePublishDialogStore.getState().phase).toBe('signin');
    });

    it('goes to identity when signed in without a stored display name', () => {
      usePublishDialogStore.getState().open(openPayload());
      expect(usePublishDialogStore.getState().phase).toBe('identity');
    });

    it('goes straight to form when signed in with a stored display name', () => {
      saveDisplayName('Andy');
      usePublishDialogStore.getState().open(openPayload());
      const state = usePublishDialogStore.getState();
      expect(state.phase).toBe('form');
      expect(state.displayName).toBe('Andy');
    });

    it('stores the mode', () => {
      usePublishDialogStore.getState().open(openPayload({ mode: 'update' }));
      expect(usePublishDialogStore.getState().mode).toBe('update');
    });

    it('clears stale success and error from a previous session', () => {
      usePublishDialogStore.setState({
        success: { id: 'AbCdEf123456', url: 'https://x/community/AbCdEf123456' },
        error: { kind: 'server' },
      });
      usePublishDialogStore.getState().open(openPayload());
      const state = usePublishDialogStore.getState();
      expect(state.success).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('completeSignIn', () => {
    it('advances signin to identity when no display name is stored', () => {
      usePublishDialogStore.getState().open(openPayload({ signedIn: false }));
      usePublishDialogStore.getState().completeSignIn();
      expect(usePublishDialogStore.getState().phase).toBe('identity');
    });

    it('advances signin to form when a display name is stored', () => {
      saveDisplayName('Andy');
      usePublishDialogStore.getState().open(openPayload({ signedIn: false }));
      usePublishDialogStore.getState().completeSignIn();
      expect(usePublishDialogStore.getState().phase).toBe('form');
    });

    it('is ignored outside signin', () => {
      usePublishDialogStore.getState().open(openPayload());
      usePublishDialogStore.getState().completeSignIn();
      expect(usePublishDialogStore.getState().phase).toBe('identity');
    });
  });

  describe('confirmIdentity', () => {
    it('persists the name and advances to form', () => {
      usePublishDialogStore.getState().open(openPayload());
      usePublishDialogStore.getState().confirmIdentity('  Andy  ');
      const state = usePublishDialogStore.getState();
      expect(state.phase).toBe('form');
      expect(state.displayName).toBe('Andy');
      expect(loadDisplayName()).toBe('Andy');
    });

    it('ignores an empty name', () => {
      usePublishDialogStore.getState().open(openPayload());
      usePublishDialogStore.getState().confirmIdentity('   ');
      expect(usePublishDialogStore.getState().phase).toBe('identity');
    });

    it('is ignored outside identity', () => {
      saveDisplayName('Andy');
      usePublishDialogStore.getState().open(openPayload());
      usePublishDialogStore.getState().confirmIdentity('Someone Else');
      expect(usePublishDialogStore.getState().displayName).toBe('Andy');
    });
  });

  describe('publish lifecycle', () => {
    function openToForm(): void {
      saveDisplayName('Andy');
      usePublishDialogStore.getState().open(openPayload());
    }

    it('form -> publishing -> success', () => {
      openToForm();
      usePublishDialogStore.getState().beginPublishing();
      expect(usePublishDialogStore.getState().phase).toBe('publishing');
      const result = { id: 'AbCdEf123456', url: 'https://x/community/AbCdEf123456' };
      usePublishDialogStore.getState().succeed(result);
      const state = usePublishDialogStore.getState();
      expect(state.phase).toBe('success');
      expect(state.success).toEqual(result);
    });

    it('form -> publishing -> error -> backToForm', () => {
      openToForm();
      usePublishDialogStore.getState().beginPublishing();
      usePublishDialogStore.getState().fail({ kind: 'quotaExceeded', message: 'limit' });
      let state = usePublishDialogStore.getState();
      expect(state.phase).toBe('error');
      expect(state.error).toEqual({ kind: 'quotaExceeded', message: 'limit' });
      usePublishDialogStore.getState().backToForm();
      state = usePublishDialogStore.getState();
      expect(state.phase).toBe('form');
      expect(state.error).toBeNull();
    });

    it('beginPublishing is ignored outside form', () => {
      usePublishDialogStore.getState().open(openPayload({ signedIn: false }));
      usePublishDialogStore.getState().beginPublishing();
      expect(usePublishDialogStore.getState().phase).toBe('signin');
    });

    it('succeed and fail are ignored outside publishing', () => {
      openToForm();
      usePublishDialogStore
        .getState()
        .succeed({ id: 'AbCdEf123456', url: 'https://x/community/AbCdEf123456' });
      expect(usePublishDialogStore.getState().phase).toBe('form');
      usePublishDialogStore.getState().fail({ kind: 'server' });
      expect(usePublishDialogStore.getState().phase).toBe('form');
    });

    it('backToForm is ignored outside error', () => {
      openToForm();
      usePublishDialogStore.getState().backToForm();
      expect(usePublishDialogStore.getState().phase).toBe('form');
    });
  });

  it('reset returns to the initial state', () => {
    saveDisplayName('Andy');
    usePublishDialogStore.getState().open(openPayload());
    usePublishDialogStore.getState().beginPublishing();
    usePublishDialogStore.getState().reset();
    const state = usePublishDialogStore.getState();
    expect(state.phase).toBe('closed');
    expect(state.success).toBeNull();
    expect(state.error).toBeNull();
  });
});
