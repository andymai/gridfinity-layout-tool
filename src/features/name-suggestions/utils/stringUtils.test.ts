import { describe, it, expect } from 'vitest';
import { hashName, editDistance } from './stringUtils';

describe('hashName', () => {
  it('returns an 8-character hex string', () => {
    const result = hashName('screws');
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is case-insensitive', () => {
    expect(hashName('Screws')).toBe(hashName('screws'));
    expect(hashName('SCREWS')).toBe(hashName('screws'));
  });

  it('trims whitespace', () => {
    expect(hashName('  screws  ')).toBe(hashName('screws'));
  });

  it('produces different hashes for different names', () => {
    expect(hashName('screws')).not.toBe(hashName('bolts'));
  });

  it('returns deterministic results', () => {
    const first = hashName('drawer organizer');
    const second = hashName('drawer organizer');
    expect(first).toBe(second);
  });

  it('handles empty string', () => {
    const result = hashName('');
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles single character', () => {
    const result = hashName('a');
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('editDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(editDistance('kitten', 'kitten')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(editDistance('Kitten', 'kitten')).toBe(0);
    expect(editDistance('HELLO', 'hello')).toBe(0);
  });

  it('returns length of b when a is empty', () => {
    expect(editDistance('', 'hello')).toBe(5);
  });

  it('returns length of a when b is empty', () => {
    expect(editDistance('hello', '')).toBe(5);
  });

  it('returns 0 for two empty strings', () => {
    expect(editDistance('', '')).toBe(0);
  });

  it('computes single substitution', () => {
    expect(editDistance('cat', 'car')).toBe(1);
  });

  it('computes single insertion', () => {
    expect(editDistance('cat', 'cats')).toBe(1);
  });

  it('computes single deletion', () => {
    expect(editDistance('cats', 'cat')).toBe(1);
  });

  it('computes classic kitten→sitting distance', () => {
    // kitten → sitten (substitution) → sittin (substitution) → sitting (insertion) = 3
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });

  it('computes completely different strings', () => {
    expect(editDistance('abc', 'xyz')).toBe(3);
  });

  it('is symmetric', () => {
    expect(editDistance('saturday', 'sunday')).toBe(editDistance('sunday', 'saturday'));
  });
});
