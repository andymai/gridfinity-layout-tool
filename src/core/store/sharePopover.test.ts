import { describe, it, expect, beforeEach } from 'vitest';
import { useSharePopoverStore, INITIAL_SHARE_POPOVER_STATE } from './sharePopover';

describe('useSharePopoverStore', () => {
  beforeEach(() => {
    useSharePopoverStore.setState(INITIAL_SHARE_POPOVER_STATE);
  });

  it('starts closed', () => {
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
  });

  it('open() flips isOpen to true', () => {
    useSharePopoverStore.getState().open();
    expect(useSharePopoverStore.getState().isOpen).toBe(true);
  });

  it('close() flips isOpen to false', () => {
    useSharePopoverStore.getState().open();
    useSharePopoverStore.getState().close();
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
  });

  it('toggle() inverts the current state', () => {
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
    useSharePopoverStore.getState().toggle();
    expect(useSharePopoverStore.getState().isOpen).toBe(true);
    useSharePopoverStore.getState().toggle();
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
  });

  it('open() is idempotent', () => {
    useSharePopoverStore.getState().open();
    useSharePopoverStore.getState().open();
    expect(useSharePopoverStore.getState().isOpen).toBe(true);
  });

  it('close() is idempotent', () => {
    useSharePopoverStore.getState().close();
    expect(useSharePopoverStore.getState().isOpen).toBe(false);
  });
});
