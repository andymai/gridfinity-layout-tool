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
      payload.params.width = 10;
      const result = validateDesignerShare(payload, JSON.stringify(payload).length);
      expect(result.valid).toBe(false);
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
      for (const style of ['standard', 'slotted']) {
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
});
