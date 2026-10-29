import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAchievements, saveAchievement } from './achievements';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('achievements storage', () => {
  it('keeps what was earned', () => {
    saveAchievement('poked10');
    saveAchievement('satThrough');
    expect([...readAchievements()].sort()).toEqual(['poked10', 'satThrough']);
  });

  it('ignores anything but its own keys and values', () => {
    localStorage.setItem('gridfinity-supporters-achievement-hacker', '1');
    localStorage.setItem('gridfinity-supporters-achievement-poked10', 'yes');
    expect(readAchievements().size).toBe(0);
  });

  it('treats blocked storage as nothing earned', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(readAchievements().size).toBe(0);
    expect(() => saveAchievement('poked10')).not.toThrow();
  });
});
