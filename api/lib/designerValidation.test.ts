/**
 * Tests for server-side designer share validation.
 *
 * We import the validation function directly since it's pure logic
 * with no server dependencies.
 */

import { describe, it, expect } from 'vitest';
import { validateDesignerShare } from './designerValidation.js';

function validPayload() {
  return {
    type: 'designer' as const,
    version: 1 as const,
    params: {
      width: 2,
      depth: 2,
      height: 6,
      style: 'standard',
      scoop: true,
      base: {
        style: 'magnet',
        magnetDiameter: 6.2,
        magnetDepth: 2.4,
        screwDiameter: 3,
        stackingLip: true,
      },
      compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
      label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'center' },
      walls: { front: 0, back: 0, left: 0, right: 0 },
      inserts: [] as Record<string, unknown>[],
    },
  };
}

describe('validateDesignerShare', () => {
  it('accepts valid payload', () => {
    const payload = validPayload();
    const json = JSON.stringify(payload);
    const result = validateDesignerShare(payload, json.length);
    expect(result.valid).toBe(true);
  });

  it('rejects payload exceeding size limit', () => {
    const payload = validPayload();
    const result = validateDesignerShare(payload, 200_000);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('SIZE_EXCEEDED');
    }
  });

  it('rejects non-object payload', () => {
    const result = validateDesignerShare('not an object', 20);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('INVALID_PAYLOAD');
    }
  });

  it('rejects wrong type', () => {
    const payload = { ...validPayload(), type: 'layout' };
    const result = validateDesignerShare(payload, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('INVALID_TYPE');
    }
  });

  it('rejects wrong version', () => {
    const payload = { ...validPayload(), version: 2 };
    const result = validateDesignerShare(payload, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('INVALID_VERSION');
    }
  });

  it('rejects missing params', () => {
    const payload = { type: 'designer', version: 1 };
    const result = validateDesignerShare(payload, 100);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('MISSING_PARAMS');
    }
  });

  describe('dimension validation', () => {
    it('rejects width below minimum', () => {
      const payload = validPayload();
      payload.params.width = 0.1;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects width above maximum', () => {
      const payload = validPayload();
      payload.params.width = 17;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts width at the 16 boundary (matches client MAX_DIMENSION)', () => {
      const payload = validPayload();
      payload.params.width = 16;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects height below minimum', () => {
      const payload = validPayload();
      payload.params.height = 1;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects height above maximum', () => {
      const payload = validPayload();
      payload.params.height = 25;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts boundary dimensions', () => {
      const payload = validPayload();
      payload.params.width = 0.5;
      payload.params.depth = 8;
      payload.params.height = 2;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });
  });

  describe('style validation', () => {
    it('rejects invalid bin style', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).style = 'invalid';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts all valid bin styles', () => {
      for (const style of ['standard', 'slotted', 'solid']) {
        const payload = validPayload();
        (payload.params as Record<string, unknown>).style = style;
        const result = validateDesignerShare(payload, JSON.stringify(payload).length);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('base validation', () => {
    it('rejects invalid base style', () => {
      const payload = validPayload();
      (payload.params.base as Record<string, unknown>).style = 'floating';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts all valid base styles', () => {
      for (const style of ['standard', 'magnet', 'screw', 'magnet_and_screw', 'weighted', 'flat']) {
        const payload = validPayload();
        (payload.params.base as Record<string, unknown>).style = style;
        const result = validateDesignerShare(payload, JSON.stringify(payload).length);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects non-boolean stackingLip', () => {
      const payload = validPayload();
      (payload.params.base as Record<string, unknown>).stackingLip = 'yes';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });
  });

  describe('compartments validation', () => {
    it('rejects cols exceeding max', () => {
      const payload = validPayload();
      payload.params.compartments.cols = 15;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts cols at the 12 boundary (client cap raised in #1873)', () => {
      const payload = validPayload();
      payload.params.compartments.cols = 12;
      payload.params.compartments.rows = 12;
      payload.params.compartments.cells = Array.from({ length: 144 }, (_, i) => i);
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects compartment thickness out of range', () => {
      const payload = validPayload();
      payload.params.compartments.thickness = 5;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts legacy dividers format', () => {
      const payload = validPayload();
      // Remove compartments, add legacy dividers
      delete (payload.params as Record<string, unknown>).compartments;
      (payload.params as Record<string, unknown>).dividers = { x: 0, y: 0, thickness: 1.2 };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('accepts payload with no compartments or dividers', () => {
      const payload = validPayload();
      delete (payload.params as Record<string, unknown>).compartments;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('accepts compartmentTexts with valid strings', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).compartmentTexts = ['SCREWS'];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects compartmentTexts that is not an array', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).compartmentTexts = 'oops';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects compartmentTexts entries that are not strings', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).compartmentTexts = [123];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects compartmentTexts entries over 50 characters', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).compartmentTexts = ['x'.repeat(51)];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects compartmentTexts longer than cols × rows', () => {
      // valid payload has cols=1 rows=1 → max 1 entry
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).compartmentTexts = ['A', 'B'];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts a well-formed dividerOverrides array', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).cols = 1;
      (payload.params.compartments as Record<string, unknown>).rows = 2;
      (payload.params.compartments as Record<string, unknown>).cells = [0, 1];
      (payload.params.compartments as Record<string, unknown>).dividerOverrides = [
        { compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -8 },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects unordered dividerOverrides pair', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).cols = 1;
      (payload.params.compartments as Record<string, unknown>).rows = 2;
      (payload.params.compartments as Record<string, unknown>).cells = [0, 1];
      (payload.params.compartments as Record<string, unknown>).dividerOverrides = [
        { compartmentA: 1, compartmentB: 0, offsetStart: 0, offsetEnd: 0 },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects dividerOverrides with offsets out of range', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).cols = 1;
      (payload.params.compartments as Record<string, unknown>).rows = 2;
      (payload.params.compartments as Record<string, unknown>).cells = [0, 1];
      (payload.params.compartments as Record<string, unknown>).dividerOverrides = [
        { compartmentA: 0, compartmentB: 1, offsetStart: 9999, offsetEnd: 0 },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects duplicate dividerOverrides pairs', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).cols = 1;
      (payload.params.compartments as Record<string, unknown>).rows = 2;
      (payload.params.compartments as Record<string, unknown>).cells = [0, 1];
      (payload.params.compartments as Record<string, unknown>).dividerOverrides = [
        { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 },
        { compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: 0 },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects dividerOverrides that is not an array', () => {
      const payload = validPayload();
      (payload.params.compartments as Record<string, unknown>).dividerOverrides = 'oops';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects non-integer cells (float, string, or negative)', () => {
      // Cells must be non-negative integers so dividerOverrides' knownIds
      // set is well-formed. A crafted payload could otherwise smuggle in
      // floats and silently break the adjacency check.
      const floats = validPayload();
      (floats.params.compartments as Record<string, unknown>).cells = [0.5];
      expect(validateDesignerShare(floats, JSON.stringify(floats).length).valid).toBe(false);

      const strings = validPayload();
      (strings.params.compartments as Record<string, unknown>).cells = ['0'];
      expect(validateDesignerShare(strings, JSON.stringify(strings).length).valid).toBe(false);

      const negatives = validPayload();
      (negatives.params.compartments as Record<string, unknown>).cells = [-1];
      expect(validateDesignerShare(negatives, JSON.stringify(negatives).length).valid).toBe(false);
    });
  });

  describe('label tab validation', () => {
    it('rejects label tab depth out of range', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).depth = 25;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects label tab width out of range', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).width = 101;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts valid label tab config', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).depth = 12;
      (payload.params.label as Record<string, unknown>).width = 75;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid label tab support', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).support = 'invalid';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts bracket label tab support', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).support = 'bracket';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('accepts solid label tab support', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).support = 'solid';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('accepts fillet label tab support', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).support = 'fillet';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('skips detail validation when label disabled', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = false;
      (payload.params.label as Record<string, unknown>).depth = 999;
      (payload.params.label as Record<string, unknown>).support = 'invalid';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });
  });

  describe('inserts validation', () => {
    it('accepts valid inserts', () => {
      const payload = validPayload();
      payload.params.inserts = [
        {
          id: 'ins-1',
          shape: 'rectangle',
          x: 10,
          y: 10,
          width: 20,
          depth: 15,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 2,
          label: 'Screwdriver',
        },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects too many inserts', () => {
      const payload = validPayload();
      payload.params.inserts = Array.from({ length: 25 }, (_, i) => ({
        id: `ins-${i}`,
        shape: 'circle',
        x: 0,
        y: 0,
        width: 10,
        depth: 10,
        cutDepth: 3,
        rotation: 0,
        cornerRadius: 0,
        label: '',
      }));
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid insert shape', () => {
      const payload = validPayload();
      payload.params.inserts = [
        {
          id: 'ins-1',
          shape: 'triangle',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid rotation value', () => {
      const payload = validPayload();
      payload.params.inserts = [
        {
          id: 'ins-1',
          shape: 'rectangle',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          cutDepth: 3,
          rotation: 45,
          cornerRadius: 0,
          label: '',
        },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts all valid rotations', () => {
      for (const rotation of [0, 90, 180, 270]) {
        const payload = validPayload();
        payload.params.inserts = [
          {
            id: 'ins-1',
            shape: 'rectangle',
            x: 0,
            y: 0,
            width: 10,
            depth: 10,
            cutDepth: 3,
            rotation,
            cornerRadius: 0,
            label: '',
          },
        ];
        const result = validateDesignerShare(payload, JSON.stringify(payload).length);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('cellMask validation', () => {
    it('accepts a structurally-valid mask', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cellMask = {
        cols: 4,
        rows: 4,
        cells: [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects cells whose length doesn’t match cols × rows', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cellMask = {
        cols: 4,
        rows: 4,
        cells: [1, 1, 1],
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects oversized cols / rows (DoS guard)', () => {
      // 21 exceeds MAX_MASK_DIMENSION (20).
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cellMask = {
        cols: 21,
        rows: 2,
        cells: new Array(42).fill(1),
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects non-binary cell values', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cellMask = {
        cols: 2,
        rows: 2,
        cells: [1, 1, 1, 2],
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts payloads with no cellMask (rectangular fast path)', () => {
      const payload = validPayload();
      // No cellMask key → valid.
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });
  });

  describe('top-level params allowlist (LOW-3 regression)', () => {
    it('strips unknown keys from params before storage', () => {
      const payload = validPayload() as { params: Record<string, unknown> } & Record<
        string,
        unknown
      >;
      payload.params.attackerControlled = 'evil';
      payload.params.__proto__ = { polluted: true };
      payload.params.someInternalFlag = true;

      const result = validateDesignerShare(payload, JSON.stringify(payload).length);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(Object.hasOwn(result.payload.params, 'attackerControlled')).toBe(false);
        expect(Object.hasOwn(result.payload.params, 'someInternalFlag')).toBe(false);
        // __proto__ is dropped both by JSON.parse semantics and our explicit allowlist.
        expect(Object.hasOwn(result.payload.params, '__proto__')).toBe(false);
        // Known keys survive.
        expect(result.payload.params.width).toBe(2);
        expect(result.payload.params.base).toBeDefined();
        expect(result.payload.params.compartments).toBeDefined();
      }
    });

    it('preserves optional cellMask when present', () => {
      const payload = validPayload();
      payload.params = {
        ...payload.params,
        cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 1] },
      } as typeof payload.params;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.params.cellMask).toEqual({
          cols: 2,
          rows: 2,
          cells: [1, 1, 1, 1],
        });
      }
    });

    it('preserves legacy dividers field for backwards compatibility', () => {
      const payload = validPayload() as ReturnType<typeof validPayload> & {
        params: { compartments?: unknown; dividers?: unknown };
      };
      delete payload.params.compartments;
      payload.params.dividers = { x: 1, y: 1, thickness: 1.2 };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.params.dividers).toEqual({ x: 1, y: 1, thickness: 1.2 });
      }
    });
  });

  describe('featureColors validation', () => {
    function withColors(featureColors: unknown) {
      const payload = validPayload() as ReturnType<typeof validPayload> & {
        params: { featureColors?: unknown };
      };
      payload.params.featureColors = featureColors;
      return validateDesignerShare(payload, JSON.stringify(payload).length);
    }

    it('accepts the current shape (4-corner lip)', () => {
      const result = withColors({
        body: '#3b82f6',
        lip: {
          frontLeft: '#ef4444',
          frontRight: '#22c55e',
          backRight: '#0000ff',
          backLeft: '#ffffff',
        },
        labelTab: '#3b82f6',
        base: '#3b82f6',
        scoop: '#3b82f6',
        dividers: '#3b82f6',
      });
      expect(result.valid).toBe(true);
    });

    // The client `migrateParams` backfills `featureColors.enabled` on every
    // load (see `defaults.ts:230`), so every synced design carries this key.
    // The validator must accept it or every design sync fails with 400.
    it('accepts the multi-color enabled toggle', () => {
      const result = withColors({ enabled: true, body: '#3b82f6' });
      expect(result.valid).toBe(true);
    });

    it('accepts enabled: false', () => {
      const result = withColors({ enabled: false, body: '#3b82f6' });
      expect(result.valid).toBe(true);
    });

    it('rejects non-boolean enabled', () => {
      const result = withColors({ enabled: 'yes', body: '#3b82f6' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.message).toMatch(/enabled/);
      }
    });

    it('accepts the legacy lip:string shape', () => {
      const result = withColors({ body: '#3b82f6', lip: '#ff0000' });
      expect(result.valid).toBe(true);
    });

    it('accepts legacy slot IDs (pre-v4.30)', () => {
      const result = withColors({ body: 'slot2', lip: 'slot3', labelTab: 'slot1' });
      expect(result.valid).toBe(true);
    });

    it('rejects a non-hex body color', () => {
      const result = withColors({ body: 'red' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.message).toMatch(/body/);
      }
    });

    it('rejects a non-hex lip corner', () => {
      const result = withColors({
        lip: { frontLeft: 'orange', frontRight: '#22c55e', backRight: '#0000ff', backLeft: '#fff' },
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.message).toMatch(/frontLeft/);
      }
    });

    it('rejects lip with a non-string, non-object value', () => {
      const result = withColors({ lip: 123 });
      expect(result.valid).toBe(false);
    });

    it('rejects featureColors that is not an object', () => {
      const result = withColors('not an object');
      expect(result.valid).toBe(false);
    });

    it('accepts 3-digit shorthand hex (#abc)', () => {
      const result = withColors({ body: '#abc', lip: '#0f0' });
      expect(result.valid).toBe(true);
    });

    it('rejects unknown top-level keys', () => {
      const result = withColors({ body: '#fff', evilKey: 'garbage' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.message).toMatch(/unknown key/);
      }
    });

    it('rejects unknown corner names inside the lip object', () => {
      const result = withColors({
        lip: {
          frontLeft: '#fff',
          frontRight: '#fff',
          backRight: '#fff',
          backLeft: '#fff',
          rogueCorner: '#000',
        },
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.message).toMatch(/unknown corner/);
      }
    });

    // `migrateFeatureColors` (defaults.ts) unconditionally writes a `text`
    // field. The validator must accept it or every cloud share fails 400
    // for users on the post-migration build.
    it('accepts the text zone hex (engraved-text color slot)', () => {
      const result = withColors({ body: '#3b82f6', text: '#22c55e' });
      expect(result.valid).toBe(true);
    });

    it('rejects a non-hex text zone color', () => {
      const result = withColors({ body: '#3b82f6', text: 'not-a-hex' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.message).toMatch(/text/);
      }
    });
  });

  describe('textDefaults validation', () => {
    function withTextDefaults(td: unknown) {
      const payload = validPayload() as ReturnType<typeof validPayload> & {
        params: { textDefaults?: unknown };
      };
      payload.params.textDefaults = td;
      return validateDesignerShare(payload, JSON.stringify(payload).length);
    }

    it('accepts the canonical defaults', () => {
      const result = withTextDefaults({
        font: 'atkinson',
        mode: 'engrave',
        depth: 0.4,
        margin: 1.5,
        minFontSize: 3,
        maxFontSize: 20,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects non-object', () => {
      expect(withTextDefaults('oops').valid).toBe(false);
    });

    it('rejects unknown keys', () => {
      const result = withTextDefaults({ font: 'atkinson', evil: 1 });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error.message).toMatch(/unknown key/);
    });

    it('rejects unsupported fonts', () => {
      const result = withTextDefaults({ font: 'comic-sans' });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error.message).toMatch(/font/);
    });

    it('rejects unsupported modes', () => {
      const result = withTextDefaults({ mode: 'blast' });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error.message).toMatch(/mode/);
    });

    it('rejects negative depth (crafted-share guard)', () => {
      const result = withTextDefaults({ depth: -1 });
      expect(result.valid).toBe(false);
    });

    it('rejects out-of-range maxFontSize (crafted-share guard)', () => {
      const result = withTextDefaults({ maxFontSize: 1e9 });
      expect(result.valid).toBe(false);
    });
  });
});
