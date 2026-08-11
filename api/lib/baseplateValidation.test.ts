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

  describe('screwHoles (#3425)', () => {
    const screwHoles = {
      enabled: true,
      diameter: 3.4,
      headStyle: 'countersink',
      headDiameter: 8,
      counterboreDepth: 3,
      screwsPerPiece: 4,
    };

    it('accepts a fully specified object and preserves it through the allowlist', () => {
      const result = validate({ ...validParams, screwHoles });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.payload.params.screwHoles).toEqual(screwHoles);
    });

    it('accepts an object carrying only the required fields', () => {
      const result = validate({
        ...validParams,
        screwHoles: { enabled: false, diameter: 3.4, headStyle: 'counterbore' },
      });
      expect(result.valid).toBe(true);
    });

    // Plates saved before the field existed must keep syncing untouched.
    it('accepts a payload with no screwHoles at all', () => {
      const result = validate(validParams);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.payload.params).not.toHaveProperty('screwHoles');
    });

    it('rejects a non-object', () => {
      expect(validate({ ...validParams, screwHoles: 'yes please' }).valid).toBe(false);
      expect(validate({ ...validParams, screwHoles: [screwHoles] }).valid).toBe(false);
    });

    // The nested object is closed, so an attacker cannot smuggle bulk through it.
    it('rejects an unknown nested key', () => {
      expect(validate({ ...validParams, screwHoles: { ...screwHoles, evil: 1 } }).valid).toBe(
        false
      );
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, padding: 'x'.repeat(1000) } }).valid
      ).toBe(false);
    });

    it('rejects a missing or mistyped enabled flag', () => {
      const { enabled: _enabled, ...withoutEnabled } = screwHoles;
      expect(validate({ ...validParams, screwHoles: withoutEnabled }).valid).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, enabled: 'true' } }).valid
      ).toBe(false);
    });

    it('rejects a missing, mistyped or out-of-range diameter', () => {
      const { diameter: _diameter, ...withoutDiameter } = screwHoles;
      expect(validate({ ...validParams, screwHoles: withoutDiameter }).valid).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, diameter: '3.4' } }).valid
      ).toBe(false);
      expect(validate({ ...validParams, screwHoles: { ...screwHoles, diameter: 1.9 } }).valid).toBe(
        false
      );
      expect(validate({ ...validParams, screwHoles: { ...screwHoles, diameter: 8.1 } }).valid).toBe(
        false
      );
    });

    it('rejects a missing or unrecognized head style', () => {
      const { headStyle: _headStyle, ...withoutHeadStyle } = screwHoles;
      expect(validate({ ...validParams, screwHoles: withoutHeadStyle }).valid).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, headStyle: 'plain' } }).valid
      ).toBe(false);
      expect(validate({ ...validParams, screwHoles: { ...screwHoles, headStyle: 1 } }).valid).toBe(
        false
      );
    });

    it('rejects a mistyped or out-of-range head diameter', () => {
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, headDiameter: '8' } }).valid
      ).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, headDiameter: 2.9 } }).valid
      ).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, headDiameter: 16.1 } }).valid
      ).toBe(false);
    });

    // The recess sets the pad the plate grows under a floor-sited screw, so an
    // unbounded depth is an unbounded printed plate, not just bad data.
    it('rejects a mistyped or out-of-range counterbore depth', () => {
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, counterboreDepth: '3' } }).valid
      ).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, counterboreDepth: -0.1 } }).valid
      ).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, counterboreDepth: 1e6 } }).valid
      ).toBe(false);
    });

    // Each screw is a boolean cut on every split piece, so the count is a
    // resource bound rather than a preference.
    it('rejects a fractional or out-of-range screw count', () => {
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, screwsPerPiece: 2.5 } }).valid
      ).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, screwsPerPiece: 0 } }).valid
      ).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, screwsPerPiece: 9 } }).valid
      ).toBe(false);
      expect(
        validate({ ...validParams, screwHoles: { ...screwHoles, screwsPerPiece: '4' } }).valid
      ).toBe(false);
    });
  });
});
