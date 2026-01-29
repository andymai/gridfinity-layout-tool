import { describe, it, expect } from 'vitest';
import { describeBin, getStatusAnnouncement } from './a11y';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

describe('a11y utilities', () => {
  describe('describeBin', () => {
    it('describes a default bin with just dimensions', () => {
      const result = describeBin(DEFAULT_BIN_PARAMS);
      expect(result).toContain('3D preview of a');
      expect(result).toContain(
        `${DEFAULT_BIN_PARAMS.width}×${DEFAULT_BIN_PARAMS.depth}×${DEFAULT_BIN_PARAMS.height}`
      );
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
        style: 'solid',
      };
      expect(describeBin(params)).toContain('solid walls');
    });

    it('describes compartments count', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        compartments: { cols: 2, rows: 3, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
      };
      // 2 cols × 3 rows = 6 compartments
      expect(describeBin(params)).toContain('6 compartments');
    });

    it('includes label when enabled', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      };
      expect(describeBin(params)).toContain('label tab');
    });

    it('includes insert count', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        inserts: [
          {
            id: '1',
            templateId: null,
            shape: 'circle' as const,
            x: 10,
            y: 10,
            width: 5,
            depth: 5,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
          },
          {
            id: '2',
            templateId: null,
            shape: 'circle' as const,
            x: 20,
            y: 20,
            width: 5,
            depth: 5,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
          },
        ],
      };
      expect(describeBin(params)).toContain('2 inserts');
    });

    it('uses singular insert for count of 1', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        inserts: [
          {
            id: '1',
            templateId: null,
            shape: 'circle' as const,
            x: 10,
            y: 10,
            width: 5,
            depth: 5,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
          },
        ],
      };
      expect(describeBin(params)).toContain('1 insert');
      expect(describeBin(params)).not.toContain('1 inserts');
    });

    it('combines multiple features with commas', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      };
      const result = describeBin(params);
      expect(result).toContain('stacking lip');
      expect(result).toContain('label tab');
    });

    it('returns simple description when no features enabled', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: false },
        style: 'standard',
        compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
        label: { enabled: false, text: '', fontSize: 'auto' },
        scoop: { enabled: false, radius: 'auto', allRows: false },
        walls: {
          front: { width: 0, depth: 0 },
          back: { width: 0, depth: 0 },
          left: { width: 0, depth: 0 },
          right: { width: 0, depth: 0 },
          interior: { width: 0, depth: 0 },
        },
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
