import { describe, it, expect } from 'vitest';

import {
  COMMUNITY_NAME_MIN_LENGTH,
  classifyCommunityName,
  hasQualifyingCutout,
} from './communityLowEffort';

describe('classifyCommunityName', () => {
  it('accepts a descriptive name', () => {
    expect(classifyCommunityName('Socket Organizer')).toBeNull();
    expect(classifyCommunityName('  Bolt tray  ')).toBeNull();
    // Non-Latin scripts count as letters.
    expect(classifyCommunityName('工具盒')).toBeNull();
  });

  it('flags an empty or whitespace-only name', () => {
    expect(classifyCommunityName('')).toBe('empty');
    expect(classifyCommunityName('   ')).toBe('empty');
  });

  it('flags a name below the minimum length', () => {
    expect(classifyCommunityName('ab')).toBe('too-short');
    expect(classifyCommunityName('a'.repeat(COMMUNITY_NAME_MIN_LENGTH))).not.toBe('too-short');
  });

  it('flags the designer placeholder names case-insensitively', () => {
    expect(classifyCommunityName('Untitled Bin')).toBe('placeholder');
    expect(classifyCommunityName('untitled bin')).toBe('placeholder');
    expect(classifyCommunityName('  UNTITLED  ')).toBe('placeholder');
  });

  it('flags low-effort gibberish', () => {
    expect(classifyCommunityName('1234')).toBe('low-effort');
    expect(classifyCommunityName('-----')).toBe('low-effort');
    expect(classifyCommunityName('aaaa')).toBe('low-effort');
    expect(classifyCommunityName('!!!')).toBe('low-effort');
    // A single repeated char split by spaces is still a single distinct glyph.
    expect(classifyCommunityName('a a a')).toBe('low-effort');
  });
});

describe('hasQualifyingCutout', () => {
  it('is true only when the tool-cutout array is non-empty', () => {
    expect(hasQualifyingCutout({ cutouts: [{ shape: 'circle' }] })).toBe(true);
    expect(hasQualifyingCutout({ cutouts: [] })).toBe(false);
    expect(hasQualifyingCutout({})).toBe(false);
    expect(hasQualifyingCutout({ cutouts: undefined })).toBe(false);
  });

  it('does not count wall cutouts as qualifying', () => {
    const wallOnly: Record<string, unknown> = { walls: { enabled: true }, cutouts: [] };
    expect(hasQualifyingCutout(wallOnly)).toBe(false);
  });
});
