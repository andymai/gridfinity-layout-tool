import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DISPLAY_NAME_MAX_LENGTH,
  clearDisplayName,
  loadDisplayName,
  saveDisplayName,
} from './displayName';

describe('displayName', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty string when nothing is stored', () => {
    expect(loadDisplayName()).toBe('');
  });

  it('round-trips a saved name', () => {
    saveDisplayName('Andy');
    expect(loadDisplayName()).toBe('Andy');
  });

  it('trims whitespace on save', () => {
    saveDisplayName('  Andy  ');
    expect(loadDisplayName()).toBe('Andy');
  });

  it('caps the name at the shared max length', () => {
    saveDisplayName('x'.repeat(DISPLAY_NAME_MAX_LENGTH + 10));
    expect(loadDisplayName()).toBe('x'.repeat(DISPLAY_NAME_MAX_LENGTH));
  });

  it('caps an over-long stored value on load', () => {
    localStorage.setItem(
      'gridfinity-community-display-name-v1',
      'y'.repeat(DISPLAY_NAME_MAX_LENGTH + 5)
    );
    expect(loadDisplayName()).toBe('y'.repeat(DISPLAY_NAME_MAX_LENGTH));
  });

  it('saving an empty name clears the stored value', () => {
    saveDisplayName('Andy');
    saveDisplayName('   ');
    expect(loadDisplayName()).toBe('');
  });

  it('clearDisplayName removes the stored value', () => {
    saveDisplayName('Andy');
    clearDisplayName();
    expect(loadDisplayName()).toBe('');
  });

  it('falls back to empty string when localStorage throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadDisplayName()).toBe('');
  });

  it('save is a no-op when localStorage throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveDisplayName('Andy')).not.toThrow();
  });
});
