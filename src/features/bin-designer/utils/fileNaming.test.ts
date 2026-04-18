import { describe, it, expect } from 'vitest';
import { generateFileName, sanitizeFileName, DEFAULT_EXPORT_FILE_NAME_CONFIG } from './fileNaming';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams, ExportFileNameConfig } from '../types';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

function makeConfig(overrides: Partial<ExportFileNameConfig> = {}): ExportFileNameConfig {
  return { ...DEFAULT_EXPORT_FILE_NAME_CONFIG, ...overrides };
}

describe('generateFileName', () => {
  describe('compact style (legacy string API)', () => {
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

  describe('descriptive style (legacy string API)', () => {
    it('should generate base name with no features', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'descriptive');
      expect(name).toBe('gridfinity_2x2x3.stl');
    });

    it('should include compartment count', () => {
      const name = generateFileName(
        makeParams({
          compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
        }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_6comp.stl');
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
      const name = generateFileName(makeParams({ style: 'slotted' }), 'stl', 'descriptive');
      expect(name).toBe('gridfinity_2x2x3_slotted.stl');
    });

    it('should combine multiple features', () => {
      const name = generateFileName(
        makeParams({
          style: 'slotted',
          compartments: { cols: 2, rows: 3, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
          label: { enabled: true, text: 'Tools', fontSize: 'auto' },
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
        }),
        'stl',
        'descriptive'
      );
      expect(name).toBe('gridfinity_2x2x3_slotted_6comp_label_magnets.stl');
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

  describe('config object API', () => {
    it('should work with ExportFileNameConfig for descriptive', () => {
      const name = generateFileName(
        DEFAULT_BIN_PARAMS,
        'stl',
        makeConfig({ style: 'descriptive' })
      );
      expect(name).toBe('gridfinity_2x2x3.stl');
    });

    it('should work with ExportFileNameConfig for compact', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', makeConfig({ style: 'compact' }));
      expect(name).toBe('gf_2x2x3.stl');
    });
  });

  describe('design name prefix', () => {
    it('should use design name as prefix in descriptive mode', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'descriptive', 'Screwdriver Bin');
      expect(name).toBe('Screwdriver Bin_2x2x3.stl');
    });

    it('should use design name as prefix in compact mode', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'compact', 'My Tools');
      expect(name).toBe('My Tools_2x2x3.stl');
    });

    it('should include features with design name in descriptive mode', () => {
      const name = generateFileName(
        makeParams({ label: { enabled: true, text: 'Test', fontSize: 'auto' } }),
        'stl',
        'descriptive',
        'Screwdriver Bin'
      );
      expect(name).toBe('Screwdriver Bin_2x2x3_label.stl');
    });

    it('should fall back to gridfinity prefix when design name is Untitled Bin', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'descriptive', 'Untitled Bin');
      expect(name).toBe('gridfinity_2x2x3.stl');
    });

    it('should fall back to gf prefix when design name is Untitled Bin in compact mode', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'compact', 'Untitled Bin');
      expect(name).toBe('gf_2x2x3.stl');
    });

    it('should fall back when design name is empty', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'descriptive', '');
      expect(name).toBe('gridfinity_2x2x3.stl');
    });

    it('should fall back when design name is whitespace only', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'descriptive', '   ');
      expect(name).toBe('gridfinity_2x2x3.stl');
    });

    it('should sanitize unsafe characters in design name', () => {
      const name = generateFileName(DEFAULT_BIN_PARAMS, 'stl', 'descriptive', 'My/Bin<test>');
      expect(name).toBe('My_Bin_test__2x2x3.stl');
    });
  });

  describe('custom mode', () => {
    it('should use custom name with extension', () => {
      const name = generateFileName(
        DEFAULT_BIN_PARAMS,
        'stl',
        makeConfig({ style: 'custom', customName: 'my-special-bin' })
      );
      expect(name).toBe('my-special-bin.stl');
    });

    it('should fallback to gridfinity-bin when custom name is empty', () => {
      const name = generateFileName(
        DEFAULT_BIN_PARAMS,
        'stl',
        makeConfig({ style: 'custom', customName: '' })
      );
      expect(name).toBe('gridfinity-bin.stl');
    });

    it('should sanitize custom name', () => {
      const name = generateFileName(
        DEFAULT_BIN_PARAMS,
        'stl',
        makeConfig({ style: 'custom', customName: 'my<bin>test' })
      );
      expect(name).toBe('my_bin_test.stl');
    });

    it('should fallback when custom name is only unsafe characters', () => {
      const name = generateFileName(
        DEFAULT_BIN_PARAMS,
        'stl',
        makeConfig({ style: 'custom', customName: '<<<>>>' })
      );
      expect(name).toBe('gridfinity-bin.stl');
    });

    it('should ignore design name in custom mode', () => {
      const name = generateFileName(
        DEFAULT_BIN_PARAMS,
        'stl',
        makeConfig({ style: 'custom', customName: 'custom-file' }),
        'Some Design Name'
      );
      expect(name).toBe('custom-file.stl');
    });

    it('should work with 3mf format', () => {
      const name = generateFileName(
        DEFAULT_BIN_PARAMS,
        '3mf',
        makeConfig({ style: 'custom', customName: 'my-bin' })
      );
      expect(name).toBe('my-bin.3mf');
    });
  });
});

describe('sanitizeFileName', () => {
  it('should replace angle brackets', () => {
    expect(sanitizeFileName('foo<bar>')).toBe('foo_bar_');
  });

  it('should replace colons and slashes', () => {
    expect(sanitizeFileName('C:\\path/to:file')).toBe('C__path_to_file');
  });

  it('should replace quotes and pipes', () => {
    expect(sanitizeFileName('file"name|test')).toBe('file_name_test');
  });

  it('should trim whitespace', () => {
    expect(sanitizeFileName('  hello  ')).toBe('hello');
  });

  it('should leave safe characters untouched', () => {
    expect(sanitizeFileName('my-bin_v2 (copy).txt')).toBe('my-bin_v2 (copy).txt');
  });
});

describe('DEFAULT_EXPORT_FILE_NAME_CONFIG', () => {
  it('should have descriptive style by default', () => {
    expect(DEFAULT_EXPORT_FILE_NAME_CONFIG.style).toBe('descriptive');
  });

  it('should have empty custom name by default', () => {
    expect(DEFAULT_EXPORT_FILE_NAME_CONFIG.customName).toBe('');
  });

  it('should have stl format by default', () => {
    expect(DEFAULT_EXPORT_FILE_NAME_CONFIG.format).toBe('stl');
  });
});
