import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSoundOn, saveSoundOn } from './soundPreference';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('soundPreference', () => {
  it('is off until turned on, and remembers either choice', () => {
    expect(readSoundOn()).toBe(false);
    saveSoundOn(true);
    expect(readSoundOn()).toBe(true);
    saveSoundOn(false);
    expect(readSoundOn()).toBe(false);
  });

  it('stays off when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(readSoundOn()).toBe(false);
    expect(() => saveSoundOn(true)).not.toThrow();
  });
});
