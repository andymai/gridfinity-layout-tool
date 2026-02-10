import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  exportDesignJSON,
  downloadDesignAsFile,
  parseDesignJSON,
  validateBinParams,
} from './designJson';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('exportDesignJSON', () => {
  it('should export valid JSON with correct schema', () => {
    const json = exportDesignJSON('Test Bin', DEFAULT_BIN_PARAMS);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe('gridfinity-bin-design');
    expect(parsed.version).toBe('1.0');
    expect(parsed.name).toBe('Test Bin');
    expect(parsed.params).toEqual(DEFAULT_BIN_PARAMS);
    expect(parsed._meta.exportedFrom).toBe('https://gridfinitylayouttool.com');
    expect(parsed._meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should format JSON with indentation', () => {
    const json = exportDesignJSON('Test', DEFAULT_BIN_PARAMS);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });

  it('should handle custom parameters', () => {
    const customParams = makeParams({
      width: 3,
      depth: 4,
      height: 5,
      style: 'slotted',
    });
    const json = exportDesignJSON('Custom Bin', customParams);
    const parsed = JSON.parse(json);

    expect(parsed.params.width).toBe(3);
    expect(parsed.params.depth).toBe(4);
    expect(parsed.params.height).toBe(5);
    expect(parsed.params.style).toBe('slotted');
  });
});

describe('downloadDesignAsFile', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let anchorElement: HTMLAnchorElement;

  beforeEach(() => {
    anchorElement = document.createElement('a');
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchorElement);
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(anchorElement, 'click').mockImplementation(() => {});
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchorElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchorElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create and download file with sanitized name', () => {
    downloadDesignAsFile('Test Bin', DEFAULT_BIN_PARAMS);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchorElement.download).toBe('Test Bin.json');
    expect(anchorElement.click).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should sanitize filename with unsafe characters', () => {
    downloadDesignAsFile('My/Bin<test>', DEFAULT_BIN_PARAMS);
    expect(anchorElement.download).toBe('My_Bin_test_.json');
  });

  it('should use fallback name for empty design name', () => {
    downloadDesignAsFile('', DEFAULT_BIN_PARAMS);
    expect(anchorElement.download).toBe('gridfinity-bin.json');
  });

  it('should use fallback name for only unsafe characters', () => {
    downloadDesignAsFile('<<<>>>', DEFAULT_BIN_PARAMS);
    expect(anchorElement.download).toBe('gridfinity-bin.json');
  });

  it('should create blob with correct content type', () => {
    const blobSpy = vi.spyOn(global, 'Blob');
    downloadDesignAsFile('Test', DEFAULT_BIN_PARAMS);

    expect(blobSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ type: 'application/json' })
    );
  });
});

describe('parseDesignJSON', () => {
  it('should parse valid design JSON', () => {
    const json = exportDesignJSON('Test Bin', DEFAULT_BIN_PARAMS);
    const result = parseDesignJSON(json);

    expect(result.design).not.toBeNull();
    expect(result.design?.name).toBe('Test Bin');
    expect(result.design?.params).toEqual(DEFAULT_BIN_PARAMS);
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for invalid JSON', () => {
    const result = parseDesignJSON('invalid json');

    expect(result.design).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('should return errors for non-object root', () => {
    const result = parseDesignJSON('"string"');

    expect(result.design).toBeNull();
    expect(result.errors).toContain('Invalid design file: root must be an object');
  });

  it('should validate type field', () => {
    const data = {
      type: 'wrong-type',
      version: '1.0',
      name: 'Test',
      params: DEFAULT_BIN_PARAMS,
    };
    const result = parseDesignJSON(JSON.stringify(data));

    expect(result.design).toBeNull();
    expect(result.errors.some((e) => e.includes('Invalid design type'))).toBe(true);
  });

  it('should validate version field', () => {
    const data = {
      type: 'gridfinity-bin-design',
      name: 'Test',
      params: DEFAULT_BIN_PARAMS,
    };
    const result = parseDesignJSON(JSON.stringify(data));

    expect(result.design).toBeNull();
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('should validate name field', () => {
    const data = {
      type: 'gridfinity-bin-design',
      version: '1.0',
      params: DEFAULT_BIN_PARAMS,
    };
    const result = parseDesignJSON(JSON.stringify(data));

    expect(result.design).toBeNull();
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('should validate params field', () => {
    const data = {
      type: 'gridfinity-bin-design',
      version: '1.0',
      name: 'Test',
      params: 'not-an-object',
    };
    const result = parseDesignJSON(JSON.stringify(data));

    expect(result.design).toBeNull();
    expect(result.errors.some((e) => e.includes('params'))).toBe(true);
  });

  it('should apply migration for backward compatibility', () => {
    const data = {
      type: 'gridfinity-bin-design',
      version: '1.0',
      name: 'Test',
      params: {
        ...DEFAULT_BIN_PARAMS,
        // Legacy boolean scoop format
        scoop: true,
      },
    };
    const result = parseDesignJSON(JSON.stringify(data));

    expect(result.design).not.toBeNull();
    expect(result.design?.params.scoop).toEqual({
      enabled: true,
      radius: 'auto',
    });
    expect(result.errors).toHaveLength(0);
  });

  it('should handle missing metadata gracefully', () => {
    const data = {
      type: 'gridfinity-bin-design',
      version: '1.0',
      name: 'Test',
      params: DEFAULT_BIN_PARAMS,
      // No _meta field
    };
    const result = parseDesignJSON(JSON.stringify(data));

    expect(result.design).not.toBeNull();
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateBinParams', () => {
  it('should validate valid params', () => {
    const result = validateBinParams(DEFAULT_BIN_PARAMS);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object params', () => {
    const result = validateBinParams('not an object');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('params must be an object');
  });

  it('should reject null params', () => {
    const result = validateBinParams(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('params must be an object');
  });

  it('should validate width', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, width: -1 });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('width'))).toBe(true);
  });

  it('should reject non-finite width', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, width: NaN });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('width'))).toBe(true);
  });

  it('should validate depth', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, depth: 0 });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('depth'))).toBe(true);
  });

  it('should validate height', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, height: -5 });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('height'))).toBe(true);
  });

  it('should validate gridUnitMm', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, gridUnitMm: 0 });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('gridUnitMm'))).toBe(true);
  });

  it('should validate heightUnitMm', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, heightUnitMm: -1 });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('heightUnitMm'))).toBe(true);
  });

  it('should validate base structure', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, base: 'not an object' });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('base'))).toBe(true);
  });

  it('should validate base.style', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, base: { style: 123 } });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('base.style'))).toBe(true);
  });

  it('should validate style enum', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, style: 'invalid' });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('style'))).toBe(true);
  });

  it('should accept valid style values', () => {
    expect(validateBinParams({ ...DEFAULT_BIN_PARAMS, style: 'standard' }).valid).toBe(true);
    expect(validateBinParams({ ...DEFAULT_BIN_PARAMS, style: 'slotted' }).valid).toBe(true);
  });

  it('should validate compartments structure', () => {
    const result = validateBinParams({ ...DEFAULT_BIN_PARAMS, compartments: 'not an object' });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('compartments'))).toBe(true);
  });

  it('should validate compartments.cols range', () => {
    const result = validateBinParams({
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 0, rows: 1, thickness: 1.2, cells: [] },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('compartments.cols'))).toBe(true);
  });

  it('should validate compartments.rows range', () => {
    const result = validateBinParams({
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 1, rows: 10, thickness: 1.2, cells: [] },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('compartments.rows'))).toBe(true);
  });

  it('should validate compartments.cells is array', () => {
    const result = validateBinParams({
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 1, rows: 1, thickness: 1.2, cells: 'not an array' },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('compartments.cells'))).toBe(true);
  });

  it('should validate compartments.cells length matches cols × rows', () => {
    const result = validateBinParams({
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1] },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('compartments.cells length'))).toBe(true);
  });

  it('should accept valid compartments', () => {
    const result = validateBinParams({
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    });

    expect(result.valid).toBe(true);
  });

  it('should accept half-unit dimensions', () => {
    const result = validateBinParams(makeParams({ width: 1.5, depth: 2.5 }));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect multiple validation errors', () => {
    const result = validateBinParams({
      ...DEFAULT_BIN_PARAMS,
      width: -1,
      depth: 0,
      height: NaN,
      style: 'invalid',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
