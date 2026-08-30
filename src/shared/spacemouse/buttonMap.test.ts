import { describe, expect, it } from 'vitest';
import { DEFAULT_BUTTON_MAP, isGlobalCommand, resolveButtonCommand } from './buttonMap';

describe('resolveButtonCommand', () => {
  it('maps the two universal buttons to fit and reset', () => {
    expect(resolveButtonCommand(0)).toBe('fit');
    expect(resolveButtonCommand(1)).toBe('reset');
  });

  it('maps higher indices to presets and history', () => {
    expect(resolveButtonCommand(5)).toBe('view-iso');
    expect(resolveButtonCommand(6)).toBe('undo');
    expect(resolveButtonCommand(7)).toBe('redo');
  });

  it('returns null for an unmapped index', () => {
    expect(resolveButtonCommand(99)).toBeNull();
    expect(resolveButtonCommand(-1)).toBeNull();
    expect(resolveButtonCommand(DEFAULT_BUTTON_MAP.length)).toBeNull();
  });
});

describe('isGlobalCommand', () => {
  it('treats undo/redo as global and camera commands as local', () => {
    expect(isGlobalCommand('undo')).toBe(true);
    expect(isGlobalCommand('redo')).toBe(true);
    expect(isGlobalCommand('fit')).toBe(false);
    expect(isGlobalCommand('view-top')).toBe(false);
  });
});
