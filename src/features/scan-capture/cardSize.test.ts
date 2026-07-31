import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DEFAULT_CARD_SIZE,
  MAX_CARD_MM,
  MIN_CARD_MM,
  isDefaultCardSize,
  isValidCardMm,
  loadCardSize,
  parseCardMm,
  saveCardSize,
} from './cardSize';

const CUSTOM = { longMm: 85.72, shortMm: 54.03 };

describe('isValidCardMm', () => {
  it('accepts sizes inside the plausible card range', () => {
    expect(isValidCardMm(MIN_CARD_MM)).toBe(true);
    expect(isValidCardMm(85.6)).toBe(true);
    expect(isValidCardMm(MAX_CARD_MM)).toBe(true);
  });

  it('rejects a misplaced decimal in either direction', () => {
    expect(isValidCardMm(8.56)).toBe(false);
    expect(isValidCardMm(856)).toBe(false);
  });

  it('rejects non-finite and non-positive values', () => {
    expect(isValidCardMm(Number.NaN)).toBe(false);
    expect(isValidCardMm(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidCardMm(0)).toBe(false);
    expect(isValidCardMm(-85.6)).toBe(false);
  });
});

describe('parseCardMm', () => {
  it('parses a typed measurement', () => {
    expect(parseCardMm('85.6')).toBe(85.6);
    expect(parseCardMm('  54 ')).toBe(54);
  });

  it('accepts a comma decimal separator', () => {
    expect(parseCardMm('53,98')).toBe(53.98);
  });

  it('returns null while the field is empty or out of range', () => {
    expect(parseCardMm('')).toBeNull();
    expect(parseCardMm('   ')).toBeNull();
    expect(parseCardMm('8')).toBeNull();
    expect(parseCardMm('abc')).toBeNull();
  });
});

describe('card size persistence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('defaults to the nominal ID-1 card', () => {
    expect(loadCardSize()).toEqual(DEFAULT_CARD_SIZE);
    expect(isDefaultCardSize(DEFAULT_CARD_SIZE)).toBe(true);
  });

  it('round-trips a measured card', () => {
    saveCardSize(CUSTOM);
    expect(loadCardSize()).toEqual(CUSTOM);
    expect(isDefaultCardSize(CUSTOM)).toBe(false);
  });

  it('clears the stored size when the user reverts to a standard card', () => {
    saveCardSize(CUSTOM);
    saveCardSize(DEFAULT_CARD_SIZE);
    expect(loadCardSize()).toEqual(DEFAULT_CARD_SIZE);
  });

  it('falls back to the default rather than trusting corrupt storage', () => {
    localStorage.setItem('gridfinity-scan-card-size-v1', 'not json');
    expect(loadCardSize()).toEqual(DEFAULT_CARD_SIZE);

    localStorage.setItem('gridfinity-scan-card-size-v1', JSON.stringify({ longMm: '85.6' }));
    expect(loadCardSize()).toEqual(DEFAULT_CARD_SIZE);

    localStorage.setItem(
      'gridfinity-scan-card-size-v1',
      JSON.stringify({ longMm: 8560, shortMm: 54 })
    );
    expect(loadCardSize()).toEqual(DEFAULT_CARD_SIZE);
  });

  it('keeps the size for the session when storage is unavailable', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveCardSize(CUSTOM)).not.toThrow();
  });
});
