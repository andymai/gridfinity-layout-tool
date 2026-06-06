// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordExportAndShouldPromptSupport } from './exportSupportGate';

const KEY = 'gridfinity-export-support-v1';

describe('recordExportAndShouldPromptSupport', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not prompt on the first-ever export (too early to ask)', () => {
    expect(recordExportAndShouldPromptSupport()).toBe(false);
  });

  it('prompts on the second export (a returning maker)', () => {
    expect(recordExportAndShouldPromptSupport()).toBe(false); // 1st
    expect(recordExportAndShouldPromptSupport()).toBe(true); // 2nd
  });

  it('does not prompt again within the cooldown window', () => {
    recordExportAndShouldPromptSupport(); // 1st
    expect(recordExportAndShouldPromptSupport()).toBe(true); // 2nd — shown
    expect(recordExportAndShouldPromptSupport()).toBe(false); // 3rd — cooling down
    expect(recordExportAndShouldPromptSupport()).toBe(false); // 4th — still cooling
  });

  it('recovers from a malformed payload instead of being permanently suppressed', () => {
    localStorage.setItem(KEY, '{"exportCount":"oops"}'); // non-numeric count
    expect(recordExportAndShouldPromptSupport()).toBe(false); // counts as 1st
    expect(recordExportAndShouldPromptSupport()).toBe(true); // 2nd → shown
  });

  it('treats an unparseable lastShown timestamp as cooled down', () => {
    localStorage.setItem(KEY, JSON.stringify({ exportCount: 5, lastShown: 'not-a-date' }));
    expect(recordExportAndShouldPromptSupport()).toBe(true);
  });

  it('prompts again after the cooldown expires', () => {
    recordExportAndShouldPromptSupport(); // 1st
    expect(recordExportAndShouldPromptSupport()).toBe(true); // 2nd — shown, stamps cooldown

    // Backdate the stored lastShown beyond the 30-day cooldown.
    const state = JSON.parse(localStorage.getItem(KEY) as string);
    state.lastShown = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(KEY, JSON.stringify(state));

    expect(recordExportAndShouldPromptSupport()).toBe(true);
  });
});
