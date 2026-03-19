import { describe, expect, it } from 'vitest';
import {
  quantize,
  stableSerialize,
  compactKey,
  buildCacheKey,
  KEY_HASH_THRESHOLD,
} from './cacheKeyUtils';

describe('quantize', () => {
  it('eliminates IEEE 754 drift (0.1 + 0.2)', () => {
    expect(quantize(0.1 + 0.2)).toBe(0.3);
  });

  it('rounds to 2 decimal places', () => {
    // Math.round(1.005 * 100) / 100 === 1 due to float representation
    // 1.005 * 100 === 100.49999999999999, so Math.round gives 100
    expect(quantize(1.005)).toBe(1);
  });

  it('leaves integers unchanged', () => {
    expect(quantize(42)).toBe(42);
    expect(quantize(0)).toBe(0);
    expect(quantize(100)).toBe(100);
  });

  it('handles negative numbers', () => {
    expect(quantize(-0.1 - 0.2)).toBe(-0.3);
    expect(quantize(-3.456)).toBe(-3.46);
  });

  it('handles zero', () => {
    expect(quantize(0)).toBe(0);
    // -0 stays -0 through Math.round, but String(-0) === "0" so cache keys are unaffected
    expect(Object.is(quantize(-0), -0)).toBe(true);
  });

  it('handles values with exactly 2 decimal places', () => {
    expect(quantize(1.23)).toBe(1.23);
    expect(quantize(99.99)).toBe(99.99);
  });
});

describe('stableSerialize', () => {
  it('produces identical output regardless of property order', () => {
    const a = stableSerialize({ b: 2, a: 1 });
    const b = stableSerialize({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('formats objects as sorted key:value pairs', () => {
    expect(stableSerialize({ z: 1, a: 2 })).toBe('a:2,z:1');
  });

  it('handles nested objects', () => {
    const result = stableSerialize({ outer: { b: 2, a: 1 } });
    expect(result).toBe('outer:a:1,b:2');
  });

  it('handles arrays', () => {
    expect(stableSerialize([1, 2, 3])).toBe('[1,2,3]');
  });

  it('handles arrays with mixed types', () => {
    expect(stableSerialize([1, 'hello', true, null])).toBe('[1,hello,true,null]');
  });

  it('handles nested arrays', () => {
    expect(
      stableSerialize([
        [1, 2],
        [3, 4],
      ])
    ).toBe('[[1,2],[3,4]]');
  });

  it('quantizes numbers at all nesting levels', () => {
    const result = stableSerialize({ val: 0.1 + 0.2, arr: [0.1 + 0.2] });
    expect(result).toBe('arr:[0.3],val:0.3');
  });

  it('handles null', () => {
    expect(stableSerialize(null)).toBe('null');
  });

  it('handles undefined', () => {
    expect(stableSerialize(undefined)).toBe('undefined');
  });

  it('handles booleans', () => {
    expect(stableSerialize(true)).toBe('true');
    expect(stableSerialize(false)).toBe('false');
  });

  it('handles strings', () => {
    expect(stableSerialize('hello')).toBe('hello');
  });

  it('handles numbers', () => {
    expect(stableSerialize(42)).toBe('42');
    expect(stableSerialize(3.14)).toBe('3.14');
  });

  it('handles empty objects and arrays', () => {
    expect(stableSerialize({})).toBe('');
    expect(stableSerialize([])).toBe('[]');
  });

  it('handles deeply nested mixed structures', () => {
    const value = { config: { sizes: [1, 2], enabled: true }, name: 'test' };
    const result = stableSerialize(value);
    expect(result).toBe('config:enabled:true,sizes:[1,2],name:test');
  });
});

describe('compactKey', () => {
  it('passes through short keys unchanged', () => {
    const key = 'v1|socket|2|3|true';
    expect(compactKey(key)).toBe(key);
  });

  it('passes through keys at exactly the threshold length', () => {
    const key = 'x'.repeat(KEY_HASH_THRESHOLD);
    expect(key.length).toBe(KEY_HASH_THRESHOLD);
    expect(compactKey(key)).toBe(key);
  });

  it('hashes keys exceeding the threshold', () => {
    const key = 'x'.repeat(KEY_HASH_THRESHOLD + 1);
    const result = compactKey(key);
    expect(result.startsWith('#')).toBe(true);
    expect(result.length).toBeLessThan(key.length);
  });

  it('produces deterministic hashes (same input → same output)', () => {
    const key = 'a'.repeat(KEY_HASH_THRESHOLD + 50);
    expect(compactKey(key)).toBe(compactKey(key));
  });

  it('produces different hashes for different long keys', () => {
    const key1 = 'a'.repeat(KEY_HASH_THRESHOLD + 1);
    const key2 = 'b'.repeat(KEY_HASH_THRESHOLD + 1);
    expect(compactKey(key1)).not.toBe(compactKey(key2));
  });

  it('returns a hex string after the # prefix', () => {
    const key = 'test'.repeat(100);
    const result = compactKey(key);
    const hex = result.slice(1);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });
});

describe('buildCacheKey', () => {
  it('prefixes with version', () => {
    const key = buildCacheKey('v1', 'socket');
    expect(key.startsWith('v1|')).toBe(true);
  });

  it('joins segments with pipe delimiter', () => {
    expect(buildCacheKey('v1', 'a', 'b', 'c')).toBe('v1|a|b|c');
  });

  it('quantizes number segments', () => {
    expect(buildCacheKey('v1', 0.1 + 0.2)).toBe('v1|0.3');
  });

  it('handles boolean segments', () => {
    expect(buildCacheKey('v1', true, false)).toBe('v1|true|false');
  });

  it('handles mixed segment types', () => {
    expect(buildCacheKey('v2', 'socket', 3, 4.5, true)).toBe('v2|socket|3|4.5|true');
  });

  it('handles version-only key with no segments', () => {
    expect(buildCacheKey('v1')).toBe('v1');
  });

  it('preserves integer precision', () => {
    expect(buildCacheKey('v1', 42, 100)).toBe('v1|42|100');
  });
});
