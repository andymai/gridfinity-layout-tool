import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '@/core/constants';
import { formatShortcutKeys } from './shortcutKeys';

describe('formatShortcutKeys', () => {
  it('prints letters in uppercase, as key caps show them', () => {
    expect(formatShortcutKeys(SHORTCUTS.UNDO)).toBe('Z');
    expect(formatShortcutKeys(SHORTCUTS.REDO)).toBe('Y');
  });

  it('leaves named keys and symbols alone', () => {
    expect(formatShortcutKeys(SHORTCUTS.DELETE)).toBe('Delete / Backspace');
    expect(formatShortcutKeys(SHORTCUTS.HELP)).toBe('? / /');
    expect(formatShortcutKeys(SHORTCUTS.CATEGORY_PREV)).toBe('[');
    expect(formatShortcutKeys(SHORTCUTS.PREVIEW_EXPAND)).toBe('Space');
  });
});
