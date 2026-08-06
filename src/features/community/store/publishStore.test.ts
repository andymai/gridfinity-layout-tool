import { beforeEach, describe, expect, it } from 'vitest';
import type { CommunityCapabilities } from '../api/client';
import { INITIAL_PUBLISH_DIALOG_STATE, usePublishDialogStore } from './publishStore';
import { loadDisplayName, saveDisplayName } from '../utils/displayName';

const ENABLED: CommunityCapabilities = {
  publishEnabled: true,
  printsEnabled: true,
  requireDescription: true,
};

function open(mode: 'create' | 'update' = 'create') {
  usePublishDialogStore.getState().open({ mode });
}

describe('publishStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePublishDialogStore.setState(INITIAL_PUBLISH_DIALOG_STATE);
  });

  it('starts closed', () => {
    expect(usePublishDialogStore.getState().phase).toBe('closed');
  });

  it('opens into the capability probe rather than straight to a form', () => {
    open();
    expect(usePublishDialogStore.getState().phase).toBe('loading');
  });

  it('reaches the form when the server reports publishing enabled', () => {
    open();
    usePublishDialogStore.getState().ready(ENABLED);
    expect(usePublishDialogStore.getState().phase).toBe('form');
    expect(usePublishDialogStore.getState().capabilities).toEqual(ENABLED);
  });

  it('stops at an explicit unavailable state when publishing is switched off', () => {
    open();
    usePublishDialogStore.getState().ready({ ...ENABLED, publishEnabled: false });
    expect(usePublishDialogStore.getState().phase).toBe('unavailable');
  });

  it('falls through to the form when the probe itself fails', () => {
    // An unreachable probe says nothing about the switch, so it must not
    // claim the feature is off.
    open();
    usePublishDialogStore.getState().failProbe({ kind: 'network' });
    const state = usePublishDialogStore.getState();
    expect(state.phase).toBe('form');
    expect(state.probeError).toEqual({ kind: 'network' });
  });

  it('loads a previously saved display name on open', () => {
    saveDisplayName('andy');
    open();
    expect(usePublishDialogStore.getState().displayName).toBe('andy');
  });

  it('persists a trimmed display name and ignores an empty one', () => {
    open();
    usePublishDialogStore.getState().setDisplayName('  ada  ');
    expect(usePublishDialogStore.getState().displayName).toBe('ada');
    expect(loadDisplayName()).toBe('ada');
    usePublishDialogStore.getState().setDisplayName('   ');
    expect(usePublishDialogStore.getState().displayName).toBe('ada');
  });

  it('returns a failed publish to the form with the error attached', () => {
    open();
    usePublishDialogStore.getState().ready(ENABLED);
    usePublishDialogStore.getState().beginPublishing();
    usePublishDialogStore.getState().fail({ kind: 'server' });
    const state = usePublishDialogStore.getState();
    // The form must survive the failure; losing it was the whole bug.
    expect(state.phase).toBe('form');
    expect(state.error).toEqual({ kind: 'server' });
  });

  it('clears the error when a new publish starts', () => {
    open();
    usePublishDialogStore.getState().ready(ENABLED);
    usePublishDialogStore.getState().beginPublishing();
    usePublishDialogStore.getState().fail({ kind: 'server' });
    usePublishDialogStore.getState().beginPublishing();
    expect(usePublishDialogStore.getState().error).toBeNull();
  });

  it('dismisses an error without leaving the form', () => {
    open();
    usePublishDialogStore.getState().ready(ENABLED);
    usePublishDialogStore.getState().beginPublishing();
    usePublishDialogStore.getState().fail({ kind: 'network' });
    usePublishDialogStore.getState().dismissError();
    const state = usePublishDialogStore.getState();
    expect(state.error).toBeNull();
    expect(state.phase).toBe('form');
  });

  it('succeeds only from the publishing phase', () => {
    open();
    usePublishDialogStore.getState().ready(ENABLED);
    usePublishDialogStore.getState().succeed({ id: 'a', url: 'https://x/a' });
    expect(usePublishDialogStore.getState().phase).toBe('form');
    usePublishDialogStore.getState().beginPublishing();
    usePublishDialogStore.getState().succeed({ id: 'a', url: 'https://x/a' });
    expect(usePublishDialogStore.getState().phase).toBe('success');
  });

  it('does not begin publishing from outside the form phase', () => {
    open();
    usePublishDialogStore.getState().beginPublishing();
    expect(usePublishDialogStore.getState().phase).toBe('loading');
  });

  it('ignores a probe result once the dialog moved on', () => {
    open();
    usePublishDialogStore.getState().ready(ENABLED);
    usePublishDialogStore.getState().beginPublishing();
    usePublishDialogStore.getState().ready({ ...ENABLED, publishEnabled: false });
    expect(usePublishDialogStore.getState().phase).toBe('publishing');
  });

  it('switches an update to create without closing', () => {
    open('update');
    usePublishDialogStore.getState().ready(ENABLED);
    usePublishDialogStore.getState().switchToCreate();
    const state = usePublishDialogStore.getState();
    expect(state.mode).toBe('create');
    expect(state.phase).toBe('form');
  });

  it('resets back to closed', () => {
    open();
    usePublishDialogStore.getState().ready(ENABLED);
    usePublishDialogStore.getState().reset();
    expect(usePublishDialogStore.getState()).toMatchObject(INITIAL_PUBLISH_DIALOG_STATE);
  });
});
