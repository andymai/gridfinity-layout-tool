import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAchievements, saveAchievements } from './achievements';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('achievements storage', () => {
  it('keeps what was earned', () => {
    saveAchievements(new Set(['poked10', 'satThrough']));
    expect([...readAchievements()].sort()).toEqual(['poked10', 'satThrough']);
  });

  it('drops anything it does not recognise', () => {
    localStorage.setItem('gridfinity-supporters-achievements', '["poked10","hacker",3]');
    expect([...readAchievements()]).toEqual(['poked10']);
  });

  it('treats garbled or blocked storage as nothing earned', () => {
    localStorage.setItem('gridfinity-supporters-achievements', '{not json');
    expect(readAchievements().size).toBe(0);
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(readAchievements().size).toBe(0);
    expect(() => saveAchievements(new Set(['poked10']))).not.toThrow();
  });
});
