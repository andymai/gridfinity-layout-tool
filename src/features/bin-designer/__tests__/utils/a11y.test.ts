import { describe, it, expect } from 'vitest';
import { describeBin, getStatusAnnouncement } from '../../utils/a11y';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';
import type { BinParams } from '../../types';

describe('a11y utilities', () => {
  describe('describeBin', () => {
    it('describes a default bin with just dimensions', () => {
      const result = describeBin(DEFAULT_BIN_PARAMS);
      expect(result).toContain('3D preview of a');
      expect(result).toContain(`${DEFAULT_BIN_PARAMS.width}×${DEFAULT_BIN_PARAMS.depth}×${DEFAULT_BIN_PARAMS.height}`);
      expect(result).toContain('Gridfinity bin');
    });

    it('includes base style when non-standard', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
      };
      expect(describeBin(params)).toContain('magnet base');
    });

    it('includes stacking lip when enabled', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      };
      expect(describeBin(params)).toContain('stacking lip');
    });

    it('includes bin style when non-standard', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        style: 'rugged',
      };
      expect(describeBin(params)).toContain('rugged walls');
    });

    it('describes dividers as compartments', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        dividers: { ...DEFAULT_BIN_PARAMS.dividers, x: 1, y: 2 },
      };
      // 1 divider x = 2 compartments, 2 dividers y = 3 compartments
      expect(describeBin(params)).toContain('2×3 compartments');
    });

    it('includes label when enabled', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      };
      expect(describeBin(params)).toContain('label tab');
    });

    it('includes scoop when enabled', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        scoop: true,
      };
      expect(describeBin(params)).toContain('front scoop');
    });

    it('includes wall cutouts with side names', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        walls: { front: 50, back: 0, left: 30, right: 0 },
      };
      expect(describeBin(params)).toContain('front/left wall cutouts');
    });

    it('includes insert count', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        inserts: [
          { id: '1', type: 'cylinder', x: 10, y: 10, width: 5, depth: 5, height: 5, rotation: 0 },
          { id: '2', type: 'cylinder', x: 20, y: 20, width: 5, depth: 5, height: 5, rotation: 0 },
        ],
      };
      expect(describeBin(params)).toContain('2 inserts');
    });

    it('uses singular insert for count of 1', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        inserts: [
          { id: '1', type: 'cylinder', x: 10, y: 10, width: 5, depth: 5, height: 5, rotation: 0 },
        ],
      };
      expect(describeBin(params)).toContain('1 insert');
      expect(describeBin(params)).not.toContain('1 inserts');
    });

    it('combines multiple features with commas', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        scoop: true,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      };
      const result = describeBin(params);
      expect(result).toContain('stacking lip');
      expect(result).toContain('label tab');
      expect(result).toContain('front scoop');
    });

    it('returns simple description when no features enabled', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: false },
        style: 'standard',
        dividers: { x: 0, y: 0, thickness: 1.2 },
        label: { enabled: false, text: '', fontSize: 'auto' },
        scoop: false,
        walls: { front: 0, back: 0, left: 0, right: 0 },
        inserts: [],
      };
      const result = describeBin(params);
      expect(result).not.toContain('with');
    });
  });

  describe('getStatusAnnouncement', () => {
    it('announces WASM loading', () => {
      expect(getStatusAnnouncement('loading', 'idle', false)).toBe('Loading 3D engine');
    });

    it('announces WASM error', () => {
      expect(getStatusAnnouncement('error', 'idle', false)).toBe('Error: 3D engine failed to load');
    });

    it('announces mesh generation in progress', () => {
      expect(getStatusAnnouncement('ready', 'generating', true)).toBe('Generating bin mesh');
    });

    it('announces generation error', () => {
      expect(getStatusAnnouncement('ready', 'error', false)).toBe('Error: mesh generation failed');
    });

    it('announces completion when mesh is available', () => {
      expect(getStatusAnnouncement('ready', 'complete', true)).toBe('Bin preview updated');
    });

    it('returns null for idle state', () => {
      expect(getStatusAnnouncement('ready', 'idle', false)).toBeNull();
    });

    it('returns null for unloaded WASM', () => {
      expect(getStatusAnnouncement('unloaded', 'idle', false)).toBeNull();
    });
  });
});
