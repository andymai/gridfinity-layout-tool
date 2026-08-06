import { describe, it, expect } from 'vitest';

import {
  COMMUNITY_DESCRIPTION_MIN_LENGTH,
  COMMUNITY_NAME_MIN_LENGTH,
  classifyCommunityDescription,
  classifyCommunityName,
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

describe('classifyCommunityDescription (server mirror)', () => {
  it('accepts a description that says what the design is for', () => {
    expect(classifyCommunityDescription('Holds 14 AA cells upright')).toBeNull();
    expect(classifyCommunityDescription('  For AA cells  ')).toBeNull();
  });

  it('accepts a short description in a dense script', () => {
    expect(classifyCommunityDescription('M3ネジ用の仕切り付きビン')).toBeNull();
    expect(classifyCommunityDescription('드라이버 여섯 개를 담는 통')).toBeNull();
  });

  it('flags empty, too-short, and keysmash descriptions', () => {
    expect(classifyCommunityDescription('   ')).toBe('empty');
    expect(classifyCommunityDescription('Bit holder')).toBe('too-short');
    expect(classifyCommunityDescription('a'.repeat(COMMUNITY_DESCRIPTION_MIN_LENGTH))).toBe(
      'low-effort'
    );
    expect(classifyCommunityDescription('abababababab')).toBe('low-effort');
    expect(classifyCommunityDescription('1234567890123')).toBe('low-effort');
  });
});
