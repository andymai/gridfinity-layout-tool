import { describe, expect, it } from 'vitest';
import { paramsEqual } from './paramsEqual';

describe('paramsEqual', () => {
  it('matches objects with the same keys in any order', () => {
    expect(paramsEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
  });

  it('tells apart a changed value, a missing key and an extra key', () => {
    expect(paramsEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(paramsEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(paramsEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
});
