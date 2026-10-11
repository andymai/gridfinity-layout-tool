import { describe, it, expect } from 'vitest';
import { describeErrorCauses } from './errorCauses';

describe('describeErrorCauses', () => {
  it('flattens an export retry chain down to the kernel exception', () => {
    const kernel = new Error('getBoundingBox: shape has no geometry');
    const brepError = {
      kind: 'IO',
      code: 'STL_EXPORT_UNSERIALIZABLE',
      message: 'STL export aborted',
      cause: kernel,
    };
    const first = new Error('STL export aborted (STL_EXPORT_UNSERIALIZABLE)', { cause: brepError });
    const retry = Object.assign(
      new Error('STL export aborted (STL_EXPORT_UNSERIALIZABLE)', { cause: first }),
      {
        meshFallbackCause: new Error(
          'Indexed STL: indices length 0 must be > 0 and divisible by 3'
        ),
      }
    );

    expect(describeErrorCauses(retry)).toEqual([
      'mesh fallback: Indexed STL: indices length 0 must be > 0 and divisible by 3',
      'STL export aborted (STL_EXPORT_UNSERIALIZABLE)',
      'STL export aborted',
      'getBoundingBox: shape has no geometry',
    ]);
  });

  it('returns nothing for an error without causes or a non-error', () => {
    expect(describeErrorCauses(new Error('plain'))).toEqual([]);
    expect(describeErrorCauses('a string')).toEqual([]);
    expect(describeErrorCauses(null)).toEqual([]);
  });

  it('stops on a cycle', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    (a as Error & { cause: unknown }).cause = b;
    expect(describeErrorCauses(a)).toEqual(['b', 'a']);
  });

  it('truncates long messages', () => {
    const e = new Error('outer', { cause: new Error('x'.repeat(1000)) });
    expect(describeErrorCauses(e)[0]).toHaveLength(300);
  });
});
