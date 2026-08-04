import { describe, it, expect } from 'vitest';
import { validateBaseplateShare } from './baseplateValidation.js';

const validParams = {
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
};

function validate(params: Record<string, unknown>) {
  return validateBaseplateShare({ type: 'baseplate', version: 1, params }, 1000);
}

describe('validateBaseplateShare', () => {
  it('accepts a minimal valid payload', () => {
    const result = validate(validParams);
    expect(result.valid).toBe(true);
  });

  it('drops keys outside the allowlist', () => {
    const result = validate({ ...validParams, __proto__: {}, evil: 1 });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.payload.params).not.toHaveProperty('evil');
  });

  describe('splitOverride (#3115)', () => {
    it('accepts a well-formed plan and preserves it through the allowlist', () => {
      const result = validate({ ...validParams, splitOverride: { cols: [6, 4], rows: [8] } });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.params.splitOverride).toEqual({ cols: [6, 4], rows: [8] });
      }
    });

    it('rejects a non-object plan', () => {
      const result = validate({ ...validParams, splitOverride: 'all of it' });
      expect(result.valid).toBe(false);
    });

    it('rejects an axis that is not an array', () => {
      const result = validate({ ...validParams, splitOverride: { cols: 6, rows: [8] } });
      expect(result.valid).toBe(false);
    });

    it('rejects an empty axis', () => {
      const result = validate({ ...validParams, splitOverride: { cols: [], rows: [8] } });
      expect(result.valid).toBe(false);
    });

    // The array length drives how many pieces the BREP worker is asked to build,
    // so an unbounded plan is a resource exhaustion vector, not just bad data.
    it('rejects a plan with more chunks than any legal plate could have', () => {
      const result = validate({
        ...validParams,
        splitOverride: { cols: new Array<number>(101).fill(1), rows: [8] },
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a non-numeric or out-of-range chunk size', () => {
      expect(validate({ ...validParams, splitOverride: { cols: ['6'], rows: [8] } }).valid).toBe(
        false
      );
      expect(validate({ ...validParams, splitOverride: { cols: [0], rows: [8] } }).valid).toBe(
        false
      );
      expect(validate({ ...validParams, splitOverride: { cols: [999], rows: [8] } }).valid).toBe(
        false
      );
    });

    // The server has no reliable view of the plate's dimensions, so summing is
    // deliberately the client's job (`normalizeSplitOverride`) — a plan that
    // doesn't fit is dropped at resolve time rather than rejected on sync,
    // which would fail the whole save over a recoverable mismatch.
    it('accepts a plan whose sizes do not match any particular plate', () => {
      const result = validate({ ...validParams, splitOverride: { cols: [1, 1], rows: [1] } });
      expect(result.valid).toBe(true);
    });
  });
});
