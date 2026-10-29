import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSeenCredits, markCreditsSeen } from './creditsSeen';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('creditsSeen', () => {
  it('remembers that the credits were watched', () => {
    expect(hasSeenCredits()).toBe(false);
    markCreditsSeen();
    expect(hasSeenCredits()).toBe(true);
  });

  it('treats blocked storage as a first visit rather than throwing', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(() => markCreditsSeen()).not.toThrow();
    expect(hasSeenCredits()).toBe(false);
  });
});
