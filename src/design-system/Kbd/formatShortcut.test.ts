import { describe, it, expect } from 'vitest';
import { formatShortcut } from './formatShortcut';

describe('formatShortcut', () => {
  it('renders Mod as the command symbol on mac, joined without separators', () => {
    expect(formatShortcut(['Mod', 'Z'], 'mac')).toBe('⌘Z');
    expect(formatShortcut(['Mod', 'Shift', 'Z'], 'mac')).toBe('⌘⇧Z');
    expect(formatShortcut(['Ctrl', 'K'], 'mac')).toBe('⌃K');
    expect(formatShortcut(['Alt', 'A'], 'mac')).toBe('⌥A');
  });

  it('renders Mod as Ctrl elsewhere, joined with plus', () => {
    expect(formatShortcut(['Mod', 'Z'], 'other')).toBe('Ctrl+Z');
    expect(formatShortcut(['Mod', 'Shift', 'Z'], 'other')).toBe('Ctrl+Shift+Z');
    expect(formatShortcut(['Alt', 'A'], 'other')).toBe('Alt+A');
  });

  it('passes named keys through untouched', () => {
    expect(formatShortcut(['Escape'], 'other')).toBe('Escape');
    expect(formatShortcut(['Shift', 'Enter'], 'other')).toBe('Shift+Enter');
  });
});
