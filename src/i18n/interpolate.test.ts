import { describe, it, expect } from 'vitest';
import { interpolate } from './interpolate';

describe('interpolate', () => {
  it.each(['$&', '$$', "$'", '$`', '$1', '$<name>'])(
    'inserts %s in a value literally',
    (pattern) => {
      expect(interpolate('[{name}]', { name: `a${pattern}b` })).toBe(`[a${pattern}b]`);
    }
  );

  it('leaves a placeholder that a value contains as text', () => {
    expect(interpolate('{name}: {count}', { name: '{count}', count: 2 })).toBe('{count}: 2');
  });

  it('fills every occurrence and keeps a placeholder that has no value', () => {
    expect(interpolate('{a} {a} {b}', { a: 1 })).toBe('1 1 {b}');
  });

  it('ignores names the vars object only inherits', () => {
    expect(interpolate('{toString}', {})).toBe('{toString}');
  });

  it('returns the template unchanged without vars', () => {
    expect(interpolate('{name}')).toBe('{name}');
  });
});
