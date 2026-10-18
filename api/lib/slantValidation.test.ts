import { describe, expect, it } from 'vitest';

import { sanitizeSlant, withSanitizedSlant } from './slantValidation.js';

describe('sanitizeSlant', () => {
  it('keeps a well-formed slant exactly', () => {
    expect(sanitizeSlant({ angleDeg: 45, side: 'back', endSupport: true })).toEqual({
      angleDeg: 45,
      side: 'back',
      endSupport: true,
    });
    expect(sanitizeSlant({ angleDeg: 12.5, side: 'left' })).toEqual({
      angleDeg: 12.5,
      side: 'left',
    });
  });

  it.each([
    ['upright', { angleDeg: 0, side: 'back' }],
    ['past the ceiling', { angleDeg: 61, side: 'back' }],
    ['negative', { angleDeg: -10, side: 'back' }],
    ['not finite', { angleDeg: Number.NaN, side: 'back' }],
    ['an unknown side', { angleDeg: 30, side: 'up' }],
    ['a non-boolean support', { angleDeg: 30, side: 'back', endSupport: 'yes' }],
    ['an unknown key', { angleDeg: 30, side: 'back', extra: 1 }],
    ['not an object', 'back'],
  ])('drops a slant that is %s', (_label, value) => {
    expect(sanitizeSlant(value)).toBeNull();
  });
});

describe('withSanitizedSlant', () => {
  it('drops only the malformed slant', () => {
    expect(withSanitizedSlant({ width: 2, slant: { angleDeg: 90, side: 'back' } })).toEqual({
      width: 2,
    });
  });

  it('leaves params without a slant unchanged', () => {
    expect(withSanitizedSlant({ width: 2 })).toEqual({ width: 2 });
  });
});
