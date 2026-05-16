import { describe, it, expect } from 'vitest';
import { canonicalPayloadHash, compareForTiebreaker } from './lwwTiebreaker';

describe('canonicalPayloadHash', () => {
  it('produces identical hashes for object key orderings that differ', () => {
    const a = { name: 'Alpha', x: 1, y: 2 };
    const b = { y: 2, x: 1, name: 'Alpha' };
    expect(canonicalPayloadHash(a)).toBe(canonicalPayloadHash(b));
  });

  it('produces identical hashes for nested objects with reordered keys', () => {
    const a = { meta: { author: 'a', updated: 1 }, body: 'x' };
    const b = { body: 'x', meta: { updated: 1, author: 'a' } };
    expect(canonicalPayloadHash(a)).toBe(canonicalPayloadHash(b));
  });

  it('produces different hashes for different array orderings', () => {
    expect(canonicalPayloadHash([1, 2, 3])).not.toBe(canonicalPayloadHash([3, 2, 1]));
  });

  it('coerces NaN / Infinity to null (matches JSON.stringify behavior)', () => {
    expect(canonicalPayloadHash(NaN)).toBe(canonicalPayloadHash(null));
    expect(canonicalPayloadHash(Infinity)).toBe(canonicalPayloadHash(null));
  });
});

describe('compareForTiebreaker', () => {
  it('returns 0 when payloads are equal (no unnecessary write)', () => {
    const candidate = { layout: { name: 'A' } };
    const incumbent = { layout: { name: 'A' } };
    expect(compareForTiebreaker(candidate, incumbent)).toBe(0);
  });

  it('deterministically picks the same winner regardless of caller order', () => {
    const a = { layout: { name: 'A' } };
    const b = { layout: { name: 'B' } };
    const ab = compareForTiebreaker(a, b);
    const ba = compareForTiebreaker(b, a);
    expect(ab).not.toBe(0);
    expect(ab).toBe(-ba as -1 | 0 | 1);
  });

  it('picks the same winner across machines (deterministic on content alone)', () => {
    // Same content, different memory addresses — must hash the same.
    const x1 = { layout: { name: 'A' } };
    const x2 = { layout: { name: 'A' } };
    expect(canonicalPayloadHash(x1)).toBe(canonicalPayloadHash(x2));
  });
});
