import { describe, it, expect } from 'vitest';
import { generateFileName } from '../utils/fileNaming';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('generateFileName', () => {
  describe('compact style', () => {
    it('should generate compact name for default params', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'compact');
      expect(name).toBe('gf_2x2x3.stl');
    });

    it('should handle half-unit dimensions', () => {
      const name = generateFileName(makeParams({ width: 1.5, depth: 2.5 }), 'stl', 'compact');
      expect(name).toBe('gf_1.5x2.5x3.stl');
    });

    it('should handle different formats', () => {
      expect(generateFileName(DEFAULT_BIN_PARAMS, 'step', 'compact')).toBe('gf_2x2x3.step');
      expect(generateFileName(DEFAULT_BIN_PARAMS, '3mf', 'compact')).toBe('gf_2x2x3.3mf');
    });

    it('should lowercase the format extension', () => {
      expect(generateFileName(DEFAULT_BIN_PARAMS, 'STL', 'compact')).toBe('gf_2x2x3.stl');
    });
  });

  describe('descriptive style', () => {
    it('should generate base name with no features', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'descriptive');
      expect(name).toBe('gridfinity_2x2x3.stl');
    });

    it('should include dividers', () => {
      const name = generateFileName(
        makeParams({ dividers: { x: 2, y: 1, thickness: 1.2 } }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_dividers.stl');
    });

    it('should include scoop', () => {
      const name = generateFileName(makeParams({ scoop: { enabled: true, radius: 'auto', allRows: false } }), 'stl', 'descriptive');
      expect(name).toBe('gridfinity_2x2x3_scoop.stl');
    });

    it('should include label', () => {
      const name = generateFileName(
        makeParams({ label: { enabled: true, text: 'Test', fontSize: 'auto' } }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_label.stl');
    });

    it('should include magnet base style', () => {
      const name = generateFileName(
        makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_magnets.stl');
    });

    it('should include screw base style', () => {
      const name = generateFileName(
        makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw' } }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_screws.stl');
    });

    it('should include non-standard bin style', () => {
      const name = generateFileName(makeParams({ style: 'lite' }), 'stl', 'descriptive');
      expect(name).toBe('gridfinity_2x2x3_lite.stl');
    });

    it('should combine multiple features', () => {
      const name = generateFileName(
        makeParams({
          style: 'solid',
          dividers: { x: 1, y: 2, thickness: 1.2 },
          scoop: { enabled: true, radius: 'auto', allRows: false },
          label: { enabled: true, text: 'Tools', fontSize: 'auto' },
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
        }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_solid_dividers_scoop_label_magnets.stl');
    });

    it('should include magnets+screws for magnet_and_screw base style', () => {
      const name = generateFileName(
        makeParams({
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' },
        }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_magnets+screws.stl');
    });

    it('should default to descriptive style', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl');
      expect(name).toBe('gridfinity_2x2x3.stl');
    });
  });
});
