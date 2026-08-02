import { describe, it, expect } from 'vitest';

import {
  COMMUNITY_NAME_MIN_LENGTH,
  classifyCommunityName,
  hasQualifyingCutout,
} from './communityLowEffort.js';

describe('classifyCommunityName (server mirror)', () => {
  it('accepts a descriptive name in any script', () => {
    expect(classifyCommunityName('Socket Organizer')).toBeNull();
    expect(classifyCommunityName('  Bolt tray  ')).toBeNull();
    expect(classifyCommunityName('工具盒')).toBeNull();
  });

  it('flags empty, too-short, placeholder, and gibberish names', () => {
    expect(classifyCommunityName('   ')).toBe('empty');
    expect(classifyCommunityName('ab')).toBe('too-short');
    expect(classifyCommunityName('a'.repeat(COMMUNITY_NAME_MIN_LENGTH))).not.toBe('too-short');
    expect(classifyCommunityName('Untitled Bin')).toBe('placeholder');
    expect(classifyCommunityName('UNTITLED')).toBe('placeholder');
    expect(classifyCommunityName('1234')).toBe('low-effort');
    expect(classifyCommunityName('aaaa')).toBe('low-effort');
  });
});

describe('hasQualifyingCutout (server mirror)', () => {
  it('is true only for a non-empty tool-cutout array', () => {
    expect(hasQualifyingCutout({ cutouts: [{ shape: 'circle' }] })).toBe(true);
    expect(hasQualifyingCutout({ cutouts: [] })).toBe(false);
    expect(hasQualifyingCutout({})).toBe(false);
    const wallOnly: Record<string, unknown> = { walls: { enabled: true } };
    expect(hasQualifyingCutout(wallOnly)).toBe(false);
  });
});
