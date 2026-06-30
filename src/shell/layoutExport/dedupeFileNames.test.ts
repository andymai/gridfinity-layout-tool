import { describe, it, expect } from 'vitest';
import { dedupeFileNames } from './dedupeFileNames';

describe('dedupeFileNames', () => {
  it('leaves already-unique names unchanged', () => {
    expect(dedupeFileNames(['a.stl', 'b.stl', 'c.stl'])).toEqual(['a.stl', 'b.stl', 'c.stl']);
  });

  it('suffixes collisions before the extension', () => {
    expect(dedupeFileNames(['box.stl', 'box.stl', 'box.stl'])).toEqual([
      'box.stl',
      'box-2.stl',
      'box-3.stl',
    ]);
  });

  it('does not re-collide a generated suffix with an existing name', () => {
    expect(dedupeFileNames(['box.stl', 'box-2.stl', 'box.stl'])).toEqual([
      'box.stl',
      'box-2.stl',
      'box-3.stl',
    ]);
  });

  it('handles names without an extension', () => {
    expect(dedupeFileNames(['part', 'part'])).toEqual(['part', 'part-2']);
  });

  it('preserves order and is stable for an empty list', () => {
    expect(dedupeFileNames([])).toEqual([]);
  });
});
