/**
 * Tests for server-side designer share validation.
 *
 * We import the validation function directly since it's pure logic
 * with no server dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  validateDesignerShare,
  sanitizeTags,
  DESIGN_TAG_MAX_COUNT,
  DESIGN_TAG_MAX_LENGTH,
} from './designerValidation.js';
import { CONSTRAINTS } from './designerValidationConstants.js';

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
      // `spacer` is optional on the real payload (designerValidation.ts:186)
      // and several tests set it. Declared here so the fixture's inferred type
      // admits it rather than modelling only the keys this default happens to use.
      base: {
        style: 'magnet',
        magnetDiameter: 6.2,
        magnetDepth: 2.4,
        screwDiameter: 3,
        stackingLip: true,
      } as {
        style: string;
        magnetDiameter: number;
        magnetDepth: number;
        screwDiameter: number;
        stackingLip: boolean;
        spacer?: boolean;
      },
      compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
      label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'center' },
      walls: { front: 0, back: 0, left: 0, right: 0 },
      inserts: [] as Record<string, unknown>[],
    },
  };
}

// Full-width label captions (#2897) ride in `label`, not `compartments`, so they
// need their own bounds — the sub-key validator is not an allowlist.
describe('validateDesignerShare — label.span / rowTexts', () => {
  const withLabel = (over: Record<string, unknown>) => {
    const p = validPayload();
    return { ...p, params: { ...p.params, label: { ...p.params.label, enabled: true, ...over } } };
  };

  it('accepts an absent span (legacy designs)', () => {
    expect(validateDesignerShare(withLabel({}), 500).valid).toBe(true);
  });

  it('accepts a boolean span with row captions', () => {
    expect(
      validateDesignerShare(withLabel({ span: true, rowTexts: ['Cables', 'Adapters'] }), 500).valid
    ).toBe(true);
  });

  it('rejects a non-boolean span', () => {
    expect(validateDesignerShare(withLabel({ span: 'yes' }), 500).valid).toBe(false);
  });

  it('rejects rowTexts that is not an array', () => {
    expect(validateDesignerShare(withLabel({ rowTexts: 'Cables' }), 500).valid).toBe(false);
  });

  it('rejects a non-string row caption', () => {
    expect(validateDesignerShare(withLabel({ rowTexts: ['ok', 42] }), 500).valid).toBe(false);
  });

  // Bounded like compartmentTexts so a direct POST can't smuggle an unbounded
  // array or unbounded strings past the UI.
  it('rejects more rows than the grid maximum', () => {
    const many = Array.from({ length: 13 }, (_, i) => `r${i}`);
    expect(validateDesignerShare(withLabel({ rowTexts: many }), 500).valid).toBe(false);
  });

  it('rejects an over-long row caption', () => {
    expect(validateDesignerShare(withLabel({ rowTexts: ['x'.repeat(51)] }), 500).valid).toBe(false);
  });
});

describe('sanitizeTags', () => {
  it('returns [] for non-array / junk input', () => {
    expect(sanitizeTags(undefined)).toEqual([]);
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags('kitchen')).toEqual([]);
    expect(sanitizeTags([1, null, {}])).toEqual([]);
  });

  it('strips control chars, trims, and drops empties', () => {
    expect(sanitizeTags(['  kitchen  ', 'screws\u0000', '', '   '])).toEqual(['kitchen', 'screws']);
  });

  it('dedupes case-insensitively, keeping first casing', () => {
    expect(sanitizeTags(['Kitchen', 'kitchen', 'KITCHEN'])).toEqual(['Kitchen']);
  });

  it('caps tag length', () => {
    const long = 'x'.repeat(DESIGN_TAG_MAX_LENGTH + 10);
    expect(sanitizeTags([long])).toEqual(['x'.repeat(DESIGN_TAG_MAX_LENGTH)]);
  });

  it('caps total count', () => {
    const many = Array.from({ length: DESIGN_TAG_MAX_COUNT + 5 }, (_, i) => `t${i}`);
    expect(sanitizeTags(many)).toHaveLength(DESIGN_TAG_MAX_COUNT);
  });
});

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

  describe('featureColors.topAccent', () => {
    it('accepts a valid top-accent band', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).featureColors = {
        enabled: true,
        topAccent: { enabled: true, heightMm: 2, color: '#112233' },
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects an out-of-range height', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).featureColors = {
        topAccent: { enabled: true, heightMm: 5000, color: '#112233' },
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects an unknown top-accent key', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).featureColors = {
        topAccent: { enabled: true, heightMm: 2, color: '#112233', bogus: 1 },
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });
  });

  describe('textStyle.fontSizeOverride', () => {
    it('accepts a cutout label size override in range', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cutouts = [
        { id: 'c1', shape: 'rectangle', textStyle: { fontSizeOverride: 6 } },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects a cutout label size that would crash the worker', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cutouts = [
        { id: 'c1', shape: 'rectangle', textStyle: { fontSizeOverride: 1e9 } },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects an unknown key on a cutout textStyle', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cutouts = [
        { id: 'c1', shape: 'rectangle', textStyle: { bogus: 1 } },
      ];
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts a label-tab size override in range', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).label = {
        enabled: true,
        support: 'bracket',
        depth: 12,
        width: 100,
        alignment: 'center',
        textStyle: { fontSizeOverride: 8 },
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects an out-of-range label-tab size override', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).label = {
        enabled: true,
        support: 'bracket',
        depth: 12,
        width: 100,
        alignment: 'center',
        textStyle: { fontSizeOverride: 0.1 },
      };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });
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

    // #2915: the floorless riser has no cavity, so the usable-cavity minimum
    // doesn't apply to it. Mirrors `minHeightUnits` on the client.
    it('accepts a 1u height for a spacer', () => {
      const payload = validPayload();
      payload.params.height = 1;
      payload.params.base = { ...payload.params.base, style: 'standard', spacer: true };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects a 1u height when the payload only claims to be a spacer in another field', () => {
      const payload = validPayload();
      payload.params.height = 1;
      payload.params.base = { ...payload.params.base, spacer: false };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects a 1u height on a flat base even when the spacer flag is set', () => {
      // The generator makes the spacer inert on a flat base, so this payload
      // would otherwise buy the relaxed floor for an ordinary 1u bin.
      const payload = validPayload();
      payload.params.height = 1;
      payload.params.base = { ...payload.params.base, style: 'flat', spacer: true };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects height above maximum', () => {
      const payload = validPayload();
      payload.params.height = CONSTRAINTS.MAX_HEIGHT + 5;
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

  describe('exterior-wall collar validation', () => {
    it('accepts an absent collar (legacy payload)', () => {
      const payload = validPayload();
      delete (payload.params as Record<string, unknown>).extraWallHeightMm;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('accepts a collar within range and preserves it in the sanitized payload', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).extraWallHeightMm = 25;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.params.extraWallHeightMm).toBe(25);
      }
    });

    it('rejects a collar above the 100mm maximum', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).extraWallHeightMm = 250;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects a negative collar', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).extraWallHeightMm = -1;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects a non-numeric collar', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).extraWallHeightMm = 'tall';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
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
      (payload.params.label as Record<string, unknown>).depth = 60;
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

    it('accepts edges = back/front/both (#1898)', () => {
      for (const edges of ['back', 'front', 'both']) {
        const payload = validPayload();
        (payload.params.label as Record<string, unknown>).enabled = true;
        (payload.params.label as Record<string, unknown>).edges = edges;
        const result = validateDesignerShare(payload, JSON.stringify(payload).length);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects an invalid edges value', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).edges = 'sideways';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts a valid inset value', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).inset = 5;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects an inset value above the hard ceiling', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).inset = 200;
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

    it('accepts mode = text/socket (#2666)', () => {
      for (const mode of ['text', 'socket']) {
        const payload = validPayload();
        (payload.params.label as Record<string, unknown>).enabled = true;
        (payload.params.label as Record<string, unknown>).mode = mode;
        (payload.params.label as Record<string, unknown>).depth = 14;
        const result = validateDesignerShare(payload, JSON.stringify(payload).length);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects an invalid mode value', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).mode = 'dovetail';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('rejects socket mode with a depth below the socket minimum', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).mode = 'socket';
      (payload.params.label as Record<string, unknown>).depth =
        CONSTRAINTS.MIN_LABEL_SOCKET_TAB_DEPTH - 1;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts socketStyle = clickIn/slideChannel (#2666 follow-up)', () => {
      for (const socketStyle of ['clickIn', 'slideChannel']) {
        const payload = validPayload();
        (payload.params.label as Record<string, unknown>).enabled = true;
        (payload.params.label as Record<string, unknown>).mode = 'socket';
        (payload.params.label as Record<string, unknown>).depth = 14;
        (payload.params.label as Record<string, unknown>).socketStyle = socketStyle;
        const result = validateDesignerShare(payload, JSON.stringify(payload).length);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects an unknown socketStyle', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).socketStyle = 'dovetail';
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
    });

    it('accepts a plateFitOffset within bounds', () => {
      const payload = validPayload();
      (payload.params.label as Record<string, unknown>).enabled = true;
      (payload.params.label as Record<string, unknown>).plateFitOffset =
        CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MIN;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
    });

    it('rejects a plateFitOffset outside bounds', () => {
      for (const bad of [
        CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MIN - 0.1,
        CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MAX + 0.1,
        'loose',
      ]) {
        const payload = validPayload();
        (payload.params.label as Record<string, unknown>).enabled = true;
        (payload.params.label as Record<string, unknown>).plateFitOffset = bad;
        const result = validateDesignerShare(payload, JSON.stringify(payload).length);
        expect(result.valid).toBe(false);
      }
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
      // Built without `compartments` rather than deleting it: intersecting the
      // fixture type with `{ compartments?: unknown }` keeps the original
      // required member, so `delete` does not type-check.
      const base = validPayload();
      const { compartments: _dropped, ...paramsWithoutCompartments } = base.params;
      const payload = {
        ...base,
        params: { ...paramsWithoutCompartments, dividers: { x: 1, y: 1, thickness: 1.2 } },
      };
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

  describe('surfaceText validation (#2695)', () => {
    function withSurfaceText(st: unknown) {
      const payload = validPayload() as ReturnType<typeof validPayload> & {
        params: { surfaceText?: unknown };
      };
      payload.params.surfaceText = st;
      return validateDesignerShare(payload, JSON.stringify(payload).length);
    }

    it('accepts lid text with a style override', () => {
      const result = withSurfaceText({
        lidText: 'Cables',
        style: { mode: 'emboss', depth: 0.6 },
      });
      expect(result.valid).toBe(true);
    });

    it('accepts a bare lid text string', () => {
      expect(withSurfaceText({ lidText: 'Cables' }).valid).toBe(true);
    });

    it('survives the top-level allowlist (round-trips through pickAllowedParams)', () => {
      const payload = validPayload() as ReturnType<typeof validPayload> & {
        params: { surfaceText?: unknown };
      };
      payload.params.surfaceText = { lidText: 'Cables' };
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect((result.payload.params as { surfaceText?: unknown }).surfaceText).toEqual({
          lidText: 'Cables',
        });
      }
    });

    it('rejects non-object', () => {
      expect(withSurfaceText('Cables').valid).toBe(false);
    });

    it('rejects unknown keys', () => {
      const result = withSurfaceText({ lidText: 'ok', evil: 1 });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error.message).toMatch(/unknown key/);
    });

    it('rejects a non-string lidText', () => {
      expect(withSurfaceText({ lidText: 42 }).valid).toBe(false);
    });

    it('rejects lidText over 50 characters (mirrors TEXT_MAX_LENGTH)', () => {
      const result = withSurfaceText({ lidText: 'x'.repeat(51) });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error.message).toMatch(/50/);
    });

    it('rejects a style with out-of-range depth (crafted-share guard)', () => {
      expect(withSurfaceText({ lidText: 'ok', style: { depth: -1 } }).valid).toBe(false);
      expect(withSurfaceText({ lidText: 'ok', style: { depth: 99 } }).valid).toBe(false);
    });

    it('rejects a style with an unsupported mode', () => {
      expect(withSurfaceText({ lidText: 'ok', style: { mode: 'blast' } }).valid).toBe(false);
    });

    it('accepts per-wall strings with an alignment', () => {
      const result = withSurfaceText({
        walls: { front: 'Cables', back: 'Chargers' },
        wallAlign: 'top',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects unknown wall keys', () => {
      const result = withSurfaceText({ walls: { diagonal: 'nope' } });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error.message).toMatch(/unknown key/);
    });

    it('rejects non-string and overlong wall values', () => {
      expect(withSurfaceText({ walls: { front: 42 } }).valid).toBe(false);
      expect(withSurfaceText({ walls: { front: 'x'.repeat(51) } }).valid).toBe(false);
    });

    it('rejects an invalid wallAlign', () => {
      const result = withSurfaceText({ walls: { front: 'ok' }, wallAlign: 'middle' });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error.message).toMatch(/wallAlign/);
    });
  });

  describe('featureColors lip shapes', () => {
    function withLip(lip: unknown) {
      const payload = validPayload();
      payload.params = {
        ...payload.params,
        featureColors: { enabled: true, body: '#000000', lip },
      } as typeof payload.params;
      return validateDesignerShare(payload, JSON.stringify(payload).length);
    }

    it('accepts the new quadrant×band grid (guards cloud-sync 400)', () => {
      const result = withLip({
        corners: 4,
        bands: 2,
        cells: { 'lip:frontLeft:0': '#ff0000', 'lip:backRight:1': '#00ff00' },
      });
      expect(result.valid).toBe(true);
    });

    it('still accepts the legacy 4-corner object and string shapes', () => {
      expect(
        withLip({ frontLeft: '#fff', frontRight: '#fff', backRight: '#fff', backLeft: '#fff' })
          .valid
      ).toBe(true);
      expect(withLip('#abcdef').valid).toBe(true);
    });

    it('rejects an out-of-range corner count', () => {
      expect(withLip({ corners: 3, bands: 1, cells: {} }).valid).toBe(false);
    });

    it('rejects an unknown lip cell id', () => {
      expect(withLip({ corners: 1, bands: 1, cells: { 'lip:nope:0': '#fff' } }).valid).toBe(false);
    });

    it('rejects a non-hex lip cell color', () => {
      expect(withLip({ corners: 1, bands: 1, cells: { 'lip:frontLeft:0': 'red' } }).valid).toBe(
        false
      );
    });
  });

  describe('cutout color validation', () => {
    const withCutouts = (cutouts: unknown) => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cutouts = cutouts;
      return validateDesignerShare(payload, JSON.stringify(payload).length);
    };

    it('accepts a cutout with a valid hex color and scope', () => {
      expect(withCutouts([{ id: 'a', color: '#ef4444', colorScope: 'floor' }]).valid).toBe(true);
      expect(withCutouts([{ id: 'a', color: '#fff', colorScope: 'floorAndWalls' }]).valid).toBe(
        true
      );
    });

    it('accepts cutouts without color fields (existing designs)', () => {
      expect(withCutouts([{ id: 'a', x: 10, y: 10 }]).valid).toBe(true);
      expect(withCutouts([]).valid).toBe(true);
    });

    it('rejects a non-hex cutout color (incl. legacy slot ids)', () => {
      expect(withCutouts([{ id: 'a', color: 'red' }]).valid).toBe(false);
      expect(withCutouts([{ id: 'a', color: 'javascript:alert(1)' }]).valid).toBe(false);
      expect(withCutouts([{ id: 'a', color: 'slot1' }]).valid).toBe(false);
    });

    it('rejects an invalid color scope', () => {
      expect(withCutouts([{ id: 'a', color: '#ef4444', colorScope: 'walls' }]).valid).toBe(false);
    });

    it('rejects a non-array cutouts field', () => {
      expect(withCutouts({ not: 'an array' }).valid).toBe(false);
    });

    it('rejects a non-object cutout entry', () => {
      expect(withCutouts([{ id: 'a', color: '#ef4444' }, 'oops']).valid).toBe(false);
    });
  });

  describe('meshAssets validation', () => {
    function validAsset() {
      return {
        name: 'wrench',
        data: 'QUFBQQ==',
        triangleCount: 12,
        sizeMm: { x: 20, y: 10, z: 5 },
        outlines: [
          [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
          ],
        ],
      };
    }

    function withMesh(
      meshAssets: unknown,
      cutouts: unknown[] = [{ id: 'c1', shape: 'mesh', meshId: 'asset-1' }]
    ) {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).meshAssets = meshAssets;
      (payload.params as Record<string, unknown>).cutouts = cutouts;
      return validateDesignerShare(payload, 500);
    }

    it('accepts a valid mesh asset with a referencing cutout', () => {
      const result = withMesh({ 'asset-1': validAsset() });
      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payload.params.meshAssets).toBeDefined();
    });

    it('rejects a mesh cutout with no meshAssets map', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).cutouts = [
        { id: 'c1', shape: 'mesh', meshId: 'ghost' },
      ];
      expect(validateDesignerShare(payload, 500).valid).toBe(false);
    });

    it('rejects a mesh cutout referencing a missing asset', () => {
      expect(
        withMesh({ 'asset-1': validAsset() }, [{ id: 'c1', shape: 'mesh', meshId: 'other' }]).valid
      ).toBe(false);
    });

    it('rejects unknown asset keys', () => {
      expect(withMesh({ 'asset-1': { ...validAsset(), evil: 1 } }).valid).toBe(false);
    });

    it('rejects non-base64 data and oversized data', () => {
      expect(withMesh({ 'asset-1': { ...validAsset(), data: 'not base64!!' } }).valid).toBe(false);
      expect(
        withMesh({
          'asset-1': { ...validAsset(), data: 'A'.repeat(CONSTRAINTS.MAX_MESH_DATA_LENGTH + 1) },
        }).valid
      ).toBe(false);
    });

    it('rejects out-of-range triangle counts', () => {
      expect(withMesh({ 'asset-1': { ...validAsset(), triangleCount: 0 } }).valid).toBe(false);
      expect(
        withMesh({
          'asset-1': { ...validAsset(), triangleCount: CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES + 1 },
        }).valid
      ).toBe(false);
      expect(withMesh({ 'asset-1': { ...validAsset(), triangleCount: 1.5 } }).valid).toBe(false);
    });

    it('rejects invalid sizeMm and outlines', () => {
      expect(
        withMesh({ 'asset-1': { ...validAsset(), sizeMm: { x: 0, y: 10, z: 5 } } }).valid
      ).toBe(false);
      expect(withMesh({ 'asset-1': { ...validAsset(), outlines: [] } }).valid).toBe(false);
      expect(withMesh({ 'asset-1': { ...validAsset(), outlines: [[{ x: 0, y: 0 }]] } }).valid).toBe(
        false
      );
      expect(
        withMesh({
          'asset-1': {
            ...validAsset(),
            outlines: [
              [
                { x: 0, y: 0 },
                { x: NaN, y: 0 },
                { x: 1, y: 1 },
              ],
            ],
          },
        }).valid
      ).toBe(false);
    });

    it('rejects assets not referenced by any mesh cutout (payload-cap bypass)', () => {
      expect(withMesh({ 'asset-1': validAsset(), orphan: validAsset() }).valid).toBe(false);
      // No mesh cutouts at all -> any stored asset is an orphan
      expect(withMesh({ 'asset-1': validAsset() }, []).valid).toBe(false);
    });

    it('denies the raised cap to orphan-asset payloads', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).meshAssets = { 'asset-1': validAsset() };
      (payload.params as Record<string, unknown>).cutouts = [];
      // Small payload: rejected for the orphan itself
      expect(validateDesignerShare(payload, 500).valid).toBe(false);
      // Large payload: must not be accepted under the 2MB mesh budget either
      expect(validateDesignerShare(payload, 150_000).valid).toBe(false);
    });

    it('denies the raised cap to structurally invalid meshAssets values', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).meshAssets = 'not-an-object';
      expect(validateDesignerShare(payload, 150_000).valid).toBe(false);
      (payload.params as Record<string, unknown>).meshAssets = {};
      const result = validateDesignerShare(payload, 150_000);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.error.code).toBe('SIZE_EXCEEDED');
    });

    it('rejects more than the asset cap', () => {
      const assets: Record<string, unknown> = {};
      for (let i = 0; i <= CONSTRAINTS.MAX_MESH_ASSETS; i++) assets[`asset-${i}`] = validAsset();
      expect(withMesh(assets, []).valid).toBe(false);
    });

    it('keeps the 100KB cap for designs without mesh assets', () => {
      const payload = validPayload();
      expect(validateDesignerShare(payload, 150_000).valid).toBe(false);
    });

    it('raises the cap to 2MB only for mesh-bearing designs', () => {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).meshAssets = { 'asset-1': validAsset() };
      (payload.params as Record<string, unknown>).cutouts = [
        { id: 'c1', shape: 'mesh', meshId: 'asset-1' },
      ];
      expect(validateDesignerShare(payload, 150_000).valid).toBe(true);
      expect(validateDesignerShare(payload, 2_000_001).valid).toBe(false);
    });
  });

  describe('lid (#2694)', () => {
    function withLid(lid: Record<string, unknown>) {
      const payload = validPayload();
      (payload.params as Record<string, unknown>).lid = lid;
      return payload;
    }

    it('accepts a valid magnetic lid config', () => {
      const res = validateDesignerShare(
        withLid({
          enabled: true,
          attachment: 'magnetic',
          retentionMagnet: { diameter: 6, depth: 2 },
          tray: { enabled: false, depthMm: 4, wallMm: 2 },
        }),
        1000
      );
      expect(res.valid).toBe(true);
    });

    it('rejects a click-rail coverage outside 0-100', () => {
      // `railPlacements` multiplies the wall length by this, so an out-of-range
      // value builds a rail longer than the wall it sits on. The client can
      // only produce listed stops; a crafted payload is the gap.
      for (const clickRailCoverage of [-10, 101, 1e6]) {
        expect(
          validateDesignerShare(withLid({ attachment: 'clickRails', clickRailCoverage }), 1000)
            .valid
        ).toBe(false);
      }
    });

    it('accepts an off-stop coverage, which migration snaps on load', () => {
      // Deliberately a range check, not a stop-list check: a value between the
      // supported stops is legal input and `migrateClickRailCoverage` rounds it.
      expect(
        validateDesignerShare(withLid({ attachment: 'clickRails', clickRailCoverage: 73 }), 1000)
          .valid
      ).toBe(true);
    });

    it('rejects an unknown attachment mode', () => {
      const res = validateDesignerShare(withLid({ attachment: 'glue' }), 1000);
      expect(res.valid).toBe(false);
    });

    describe('grip relief (#3272)', () => {
      it('accepts a fully specified grip', () => {
        const res = validateDesignerShare(
          withLid({
            enabled: true,
            grip: {
              mode: 'scallop',
              sides: { front: true, back: true, left: false, right: false },
              coverage: 50,
              heightMm: 2.4,
              binDip: true,
            },
          }),
          1000
        );
        expect(res.valid).toBe(true);
      });

      it('accepts a null grip height, which is what auto is on the wire', () => {
        // Every design carries `null` until a user sets a height, so rejecting
        // it as a non-number would reject the common case.
        expect(
          validateDesignerShare(withLid({ grip: { mode: 'scallop', heightMm: null } }), 1000).valid
        ).toBe(true);
        expect(
          validateDesignerShare(withLid({ grip: { mode: 'scallop', heightMm: 2.4 } }), 1000).valid
        ).toBe(true);
      });

      it('rejects a grip height outside its bounds', () => {
        expect(validateDesignerShare(withLid({ grip: { heightMm: 0.4 } }), 1000).valid).toBe(false);
        expect(validateDesignerShare(withLid({ grip: { heightMm: 11 } }), 1000).valid).toBe(false);
        expect(validateDesignerShare(withLid({ grip: { heightMm: 'tall' } }), 1000).valid).toBe(
          false
        );
      });

      it('accepts a lid with no grip at all (pre-#3272 designs)', () => {
        expect(validateDesignerShare(withLid({ enabled: true }), 1000).valid).toBe(true);
      });

      it('rejects an unknown mode', () => {
        expect(validateDesignerShare(withLid({ grip: { mode: 'notch' } }), 1000).valid).toBe(false);
      });

      it('rejects coverage outside its bounds', () => {
        expect(validateDesignerShare(withLid({ grip: { coverage: 0 } }), 1000).valid).toBe(false);
        expect(validateDesignerShare(withLid({ grip: { coverage: 101 } }), 1000).valid).toBe(false);
      });

      it('rejects unknown keys on the grip and on its sides', () => {
        expect(validateDesignerShare(withLid({ grip: { depthMm: 9 } }), 1000).valid).toBe(false);
        expect(validateDesignerShare(withLid({ grip: { sides: { top: true } } }), 1000).valid).toBe(
          false
        );
      });

      it('rejects non-boolean side and binDip values', () => {
        expect(
          validateDesignerShare(withLid({ grip: { sides: { front: 'yes' } } }), 1000).valid
        ).toBe(false);
        expect(validateDesignerShare(withLid({ grip: { binDip: 1 } }), 1000).valid).toBe(false);
      });

      it('rejects a reveal on a stackable top, which has no valid geometry', () => {
        // The reveal steps the lid's outer face in; that face is what a bin
        // stacked on the lid registers against. Mirrors `lidGripModeAllowed`.
        expect(
          validateDesignerShare(withLid({ stackableTop: true, grip: { mode: 'reveal' } }), 1000)
            .valid
        ).toBe(false);
        expect(
          validateDesignerShare(
            withLid({ separateStackPlate: true, grip: { mode: 'reveal' } }),
            1000
          ).valid
        ).toBe(false);
      });

      it('allows the other modes on a stackable top', () => {
        for (const mode of ['chamfer', 'scallop']) {
          expect(
            validateDesignerShare(withLid({ stackableTop: true, grip: { mode } }), 1000).valid
          ).toBe(true);
        }
      });
    });

    it('rejects an out-of-range retention magnet diameter', () => {
      const res = validateDesignerShare(
        withLid({ retentionMagnet: { diameter: 999, depth: 2 } }),
        1000
      );
      expect(res.valid).toBe(false);
    });

    it('rejects an out-of-range tray depth', () => {
      const res = validateDesignerShare(withLid({ tray: { enabled: true, depthMm: 999 } }), 1000);
      expect(res.valid).toBe(false);
    });

    it('accepts a lid thickness inside the 0.8-5mm range (#2761)', () => {
      expect(validateDesignerShare(withLid({ topThicknessMm: 1.8 }), 1000).valid).toBe(true);
    });

    // The worker extrudes this straight into BREP, so a crafted share must not
    // be able to ask for a 500mm slab (or a negative one).
    it('rejects an out-of-range lid thickness', () => {
      expect(validateDesignerShare(withLid({ topThicknessMm: 500 }), 1000).valid).toBe(false);
      expect(validateDesignerShare(withLid({ topThicknessMm: -1 }), 1000).valid).toBe(false);
      expect(validateDesignerShare(withLid({ topThicknessMm: 'thick' }), 1000).valid).toBe(false);
    });

    // A fractional count is not merely untidy: the placement loop divides the
    // span by `count + 1`, so 2.5 emits two magnets spaced for 3.5 and lands
    // them off-centre.
    it('rejects a fractional edge-magnet count (#2844)', () => {
      const frac = validateDesignerShare(
        withLid({ retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 2.5 } }),
        1000
      );
      expect(frac.valid).toBe(false);
    });

    it('accepts whole edge-magnet counts across the range (#2844)', () => {
      for (const edgeMagnets of [0, 1, 2, 3]) {
        const res = validateDesignerShare(
          withLid({ retentionMagnet: { diameter: 6, depth: 2, edgeMagnets } }),
          1000
        );
        expect(res.valid, `edgeMagnets=${edgeMagnets}`).toBe(true);
      }
      expect(
        validateDesignerShare(
          withLid({ retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 4 } }),
          1000
        ).valid
      ).toBe(false);
    });
  });
});

describe('base.trayBottom (#3036)', () => {
  const tray = (over: Record<string, unknown> = {}) => ({
    attachment: 'clickRails',
    extraHeightMm: 0,
    clickRails: { front: true, back: true, left: true, right: true },
    clickRailCoverage: 50,
    retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 0 },
    ...over,
  });
  const withTray = (t: unknown) => {
    const payload = validPayload();
    return validateDesignerShare(
      {
        ...payload,
        params: {
          ...payload.params,
          base: { ...payload.params.base, style: 'lid', trayBottom: t },
        },
      },
      500
    );
  };

  it('accepts a well-formed tray bottom', () => {
    expect(withTray(tray()).valid).toBe(true);
  });

  it('rejects an unknown attachment', () => {
    expect(withTray(tray({ attachment: 'welded' })).valid).toBe(false);
  });

  it('rejects an out-of-range clearance', () => {
    expect(withTray(tray({ extraHeightMm: 500 })).valid).toBe(false);
  });

  it('rejects a missing click-rail side', () => {
    expect(withTray(tray({ clickRails: { front: true, back: true, left: true } })).valid).toBe(
      false
    );
  });

  it('rejects a fractional edge-magnet count', () => {
    // The placement loop divides by `count + 1`, so 2.5 spaces two magnets as
    // if there were 3.5 and lands them off-centre. The lid validator has
    // always rejected this; the tray path used to let it through.
    expect(
      withTray(tray({ retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 2.5 } })).valid
    ).toBe(false);
  });

  it('bounds the magnet exactly as the lid does', () => {
    expect(
      withTray(tray({ retentionMagnet: { diameter: 20, depth: 2, edgeMagnets: 0 } })).valid
    ).toBe(false);
    expect(
      withTray(tray({ retentionMagnet: { diameter: 6, depth: 0.5, edgeMagnets: 0 } })).valid
    ).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(withTray('nope').valid).toBe(false);
  });
});

// A spacer keeps its walls, so its body has to reach above the 5mm socket it
// subtracts. The relaxed 1u floor only clears that at the 7mm default height
// unit; below 6mm a 1u spacer asks for a zero or negative wall, which the
// generator can only build by extruding the box down into the foot.
describe('validateDesignerShare — spacer height floor tracks the height unit', () => {
  const spacer = (height: number, heightUnitMm?: number) => {
    const p = validPayload();
    return {
      ...p,
      params: {
        ...p.params,
        height,
        ...(heightUnitMm === undefined ? {} : { heightUnitMm }),
        base: { ...p.params.base, spacer: true },
      },
    };
  };

  it('still accepts a 1u spacer at the default height unit', () => {
    expect(validateDesignerShare(spacer(1), 500).valid).toBe(true);
  });

  it('rejects a 1u spacer whose height unit leaves no wall', () => {
    for (const unit of [3, 4, 5]) {
      expect(validateDesignerShare(spacer(1, unit), 500).valid).toBe(false);
    }
  });

  it('accepts the same spacer once it clears the socket', () => {
    for (const unit of [3, 4, 5]) {
      expect(validateDesignerShare(spacer(2, unit), 500).valid).toBe(true);
    }
  });

  // `heightUnitMm` is allowlisted but never range-checked here, so the floor has
  // to fall back to the default rather than divide by whatever arrives.
  it('falls back to the default unit for a nonsense height unit', () => {
    expect(validateDesignerShare(spacer(1, 0), 500).valid).toBe(true);
    expect(validateDesignerShare(spacer(1, -5), 500).valid).toBe(true);
  });

  // A tray's height is pinned to 1 by the store rather than floored, and its
  // wall is 0, so it must keep the flat relaxed floor at every height unit.
  it('leaves a base-only bin on the flat relaxed floor', () => {
    const p = validPayload();
    const tray = {
      ...p,
      params: {
        ...p.params,
        height: 1,
        heightUnitMm: 3,
        base: { ...p.params.base, tile: true },
      },
    };
    expect(validateDesignerShare(tray, 500).valid).toBe(true);
  });
});

describe('slide (sliding tray)', () => {
  const withSlide = (slide: unknown) => {
    const p = validPayload();
    return { ...p, params: { ...p.params, slide } };
  };

  it('accepts a well-formed config', () => {
    expect(
      validateDesignerShare(
        withSlide({
          enabled: true,
          railMount: 'rim',
          trayWidthUnits: 2,
          trayDepthMm: 20,
          trayWallMm: 1.2,
          railDropMm: 0,
          railProtrusionMm: 2,
          railThicknessMm: 2,
          clearanceMm: 0.45,
        }),
        500
      ).valid
    ).toBe(true);
  });

  it('accepts a partial config from an older client', () => {
    expect(validateDesignerShare(withSlide({ enabled: true }), 500).valid).toBe(true);
  });

  it('rejects an unknown rail mount', () => {
    expect(validateDesignerShare(withSlide({ railMount: 'sideways' }), 500).valid).toBe(false);
  });

  it('rejects a runaway rail protrusion', () => {
    // Every numeric field feeds BREP directly, so out-of-range values are the
    // thing a crafted share would use to drive runaway geometry.
    expect(validateDesignerShare(withSlide({ railProtrusionMm: 5000 }), 500).valid).toBe(false);
  });

  it('rejects a clearance below the floor', () => {
    expect(validateDesignerShare(withSlide({ clearanceMm: 0 }), 500).valid).toBe(false);
  });

  it('rejects a non-object slide', () => {
    expect(validateDesignerShare(withSlide('rim'), 500).valid).toBe(false);
  });

  it('keeps the key through param sanitization', () => {
    // pickAllowedParams strips unknown top-level keys, so a missing entry in
    // ALLOWED_PARAM_KEYS would silently drop the whole feature from shares.
    const result = validateDesignerShare(withSlide({ enabled: true }), 500);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.params.slide).toEqual({ enabled: true });
    }
  });
});
