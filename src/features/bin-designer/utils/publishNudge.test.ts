// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { hasSeenPublishNudge, markPublishNudgeSeen } from './publishNudge';

describe('publishNudge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is unseen until it is marked', () => {
    expect(hasSeenPublishNudge()).toBe(false);
    markPublishNudgeSeen();
    expect(hasSeenPublishNudge()).toBe(true);
  });

  it('stays seen across reloads', () => {
    markPublishNudgeSeen();
    expect(hasSeenPublishNudge()).toBe(true);
    // A second export in the same browser must not re-offer.
    expect(hasSeenPublishNudge()).toBe(true);
  });

  it('reads as seen when storage is unavailable', () => {
    // Without storage a dismissal cannot be remembered, so the offer must
    // fail closed rather than reappear after every export.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(hasSeenPublishNudge()).toBe(true);
  });

  it('does not throw when the write is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => markPublishNudgeSeen()).not.toThrow();
  });
});
