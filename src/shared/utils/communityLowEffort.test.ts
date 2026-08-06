import { describe, it, expect } from 'vitest';

import {
  COMMUNITY_DESCRIPTION_MIN_LENGTH,
  COMMUNITY_NAME_MIN_LENGTH,
  classifyCommunityDescription,
  classifyCommunityName,
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

describe('classifyCommunityDescription', () => {
  it('accepts a description that says what the design is for', () => {
    expect(classifyCommunityDescription('Holds 14 AA cells upright')).toBeNull();
    expect(classifyCommunityDescription('  For AA cells  ')).toBeNull();
  });

  it('flags empty and too-short descriptions', () => {
    expect(classifyCommunityDescription('')).toBe('empty');
    expect(classifyCommunityDescription('   ')).toBe('empty');
    expect(classifyCommunityDescription('Bit holder')).toBe('too-short');
    expect(classifyCommunityDescription('x'.repeat(COMMUNITY_DESCRIPTION_MIN_LENGTH - 1))).toBe(
      'too-short'
    );
  });

  it('flags text that clears the length floor without saying anything', () => {
    expect(classifyCommunityDescription('a'.repeat(COMMUNITY_DESCRIPTION_MIN_LENGTH))).toBe(
      'low-effort'
    );
    expect(classifyCommunityDescription('abababababab')).toBe('low-effort');
    expect(classifyCommunityDescription('1234567890123')).toBe('low-effort');
    expect(classifyCommunityDescription('..............')).toBe('low-effort');
  });

  it('accepts a short description in a script that does not space its words', () => {
    expect(classifyCommunityDescription('M3ネジ用の仕切り付きビン')).toBeNull();
    expect(classifyCommunityDescription('드라이버 여섯 개를 담는 통')).toBeNull();
  });

  it('measures the floor in code points, not UTF-16 code units', () => {
    // Both are 12 code units and under 12 characters.
    expect(classifyCommunityDescription('ab😀😃😄😁😆')).toBe('too-short');
    expect(classifyCommunityDescription('𠮷𡈁𡉏野家で使う仕')).toBe('too-short');
    // Long enough either way: the stricter count must not reject real text.
    expect(classifyCommunityDescription('工具箱の仕切り😀 M3ネジ用')).toBeNull();
  });

  it('does not let padding whitespace inflate the distinct count', () => {
    expect(classifyCommunityDescription('a '.repeat(COMMUNITY_DESCRIPTION_MIN_LENGTH))).toBe(
      'low-effort'
    );
    expect(classifyCommunityDescription('a b c d e f g')).toBeNull();
  });
});
