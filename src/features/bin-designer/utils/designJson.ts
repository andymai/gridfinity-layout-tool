/**
 * Bin Design JSON export, import, and validation utilities.
 *
 * Provides functions for serializing bin designs to JSON format,
 * downloading designs as files, and parsing/validating imported JSON.
 */

import type { BinParams } from '../types';
import { migrateParams } from '../constants/defaults';
import { sanitizeFileName } from './fileNaming';

/**
 * Design JSON export schema.
 */
interface DesignExportData {
  readonly type: 'gridfinity-bin-design';
  readonly version: string;
  readonly name: string;
  readonly params: BinParams;
  readonly _meta: {
    readonly exportedFrom: string;
    readonly exportedAt: string;
  };
}

/**
 * Export bin design as JSON string.
 * Adds metadata for user reference (source URL, export time).
 *
 * @param name - Design name
 * @param params - Complete bin parameters
 * @returns JSON string with pretty formatting
 *
 * @example
 * ```ts
 * const json = exportDesignJSON('My Bin', params);
 * // {
 * //   "type": "gridfinity-bin-design",
 * //   "version": "1.0",
 * //   "name": "My Bin",
 * //   "params": { ... },
 * //   "_meta": { ... }
 * // }
 * ```
 */
export function exportDesignJSON(name: string, params: BinParams): string {
  const exportData: DesignExportData = {
    type: 'gridfinity-bin-design',
    version: '1.0',
    name,
    params,
    _meta: {
      exportedFrom: 'https://gridfinitylayouttool.com',
      exportedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Download bin design as JSON file.
 * Creates a blob and triggers browser download.
 *
 * @param name - Design name (used for filename)
 * @param params - Complete bin parameters
 *
 * @example
 * ```ts
 * downloadDesignAsFile('My Bin', params);
 * // Downloads: my-bin.json
 * ```
 */
export function downloadDesignAsFile(name: string, params: BinParams): void {
  const json = exportDesignJSON(name, params);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Sanitize filename
  const sanitized = sanitizeFileName(name);
  const filename = !sanitized || /^_+$/.test(sanitized) ? 'gridfinity-bin' : sanitized;
  a.download = `${filename}.json`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Result of design JSON parsing.
 */
export interface ParseDesignResult {
  readonly design: { name: string; params: BinParams } | null;
  readonly errors: string[];
}

/**
 * Parse and validate bin design JSON.
 * Validates schema structure and bin parameters, then applies migration for backward compatibility.
 *
 * @param json - JSON string to parse
 * @returns Parsed design with name and params, or null with error messages
 *
 * @example
 * ```ts
 * const result = parseDesignJSON(jsonString);
 * if (result.design) {
 *   loadDesign(result.design.name, result.design.params);
 * } else {
 *   showErrors(result.errors);
 * }
 * ```
 */
export function parseDesignJSON(json: string): ParseDesignResult {
  const errors: string[] = [];

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      design: null,
      errors: [`Invalid JSON: ${(e as Error).message}`],
    };
  }

  // Validate top-level structure
  if (!parsed || typeof parsed !== 'object') {
    return {
      design: null,
      errors: ['Invalid design file: root must be an object'],
    };
  }

  const data = parsed as Record<string, unknown>;

  // Validate type field
  if (data.type !== 'gridfinity-bin-design') {
    errors.push(
      `Invalid design type: expected "gridfinity-bin-design", got "${String(data.type)}"`
    );
  }

  // Validate version field
  if (!data.version || typeof data.version !== 'string') {
    errors.push('Missing or invalid version field');
  }

  // Validate name field
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Missing or invalid name field');
  }

  // Validate params field
  if (!data.params || typeof data.params !== 'object') {
    errors.push('Missing or invalid params field');
  } else {
    const paramsValidation = validateBinParams(data.params);
    if (!paramsValidation.valid) {
      errors.push(...paramsValidation.errors);
    }
  }

  // Return errors if validation failed
  if (errors.length > 0) {
    return { design: null, errors };
  }

  // Apply migration for backward compatibility
  const migratedParams = migrateParams(data.params as Partial<BinParams>);

  return {
    design: {
      name: data.name as string,
      params: migratedParams,
    },
    errors: [],
  };
}

/**
 * Result of bin params validation.
 */
export interface ValidateBinParamsResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Validate bin parameters object structure.
 * Checks required fields and basic type constraints.
 * Does not perform exhaustive validation - migrateParams handles missing fields.
 *
 * @param params - Unknown value to validate as BinParams
 * @returns Validation result with success flag and error messages
 *
 * @example
 * ```ts
 * const result = validateBinParams(unknownData);
 * if (result.valid) {
 *   const params = migrateParams(unknownData as Partial<BinParams>);
 * }
 * ```
 */
export function validateBinParams(params: unknown): ValidateBinParamsResult {
  const errors: string[] = [];

  if (!params || typeof params !== 'object') {
    return {
      valid: false,
      errors: ['params must be an object'],
    };
  }

  const p = params as Record<string, unknown>;

  // Validate dimensions
  if (typeof p.width !== 'number' || !Number.isFinite(p.width) || p.width <= 0) {
    errors.push('width must be a positive finite number');
  }
  if (typeof p.depth !== 'number' || !Number.isFinite(p.depth) || p.depth <= 0) {
    errors.push('depth must be a positive finite number');
  }
  if (typeof p.height !== 'number' || !Number.isFinite(p.height) || p.height <= 0) {
    errors.push('height must be a positive finite number');
  }

  // Validate grid/height units
  if (typeof p.gridUnitMm !== 'number' || !Number.isFinite(p.gridUnitMm) || p.gridUnitMm <= 0) {
    errors.push('gridUnitMm must be a positive finite number');
  }
  if (
    typeof p.heightUnitMm !== 'number' ||
    !Number.isFinite(p.heightUnitMm) ||
    p.heightUnitMm <= 0
  ) {
    errors.push('heightUnitMm must be a positive finite number');
  }

  // Validate base config
  if (!p.base || typeof p.base !== 'object') {
    errors.push('base must be an object');
  } else {
    const base = p.base as Record<string, unknown>;
    if (typeof base.style !== 'string') {
      errors.push('base.style must be a string');
    }
  }

  // Validate style
  if (typeof p.style !== 'string' || !['standard', 'slotted'].includes(p.style as string)) {
    errors.push('style must be one of: standard, slotted');
  }

  // Validate compartments config
  if (!p.compartments || typeof p.compartments !== 'object') {
    errors.push('compartments must be an object');
  } else {
    const comp = p.compartments as Record<string, unknown>;

    if (
      typeof comp.cols !== 'number' ||
      !Number.isInteger(comp.cols) ||
      comp.cols < 1 ||
      comp.cols > 8
    ) {
      errors.push('compartments.cols must be an integer between 1 and 8');
    }
    if (
      typeof comp.rows !== 'number' ||
      !Number.isInteger(comp.rows) ||
      comp.rows < 1 ||
      comp.rows > 8
    ) {
      errors.push('compartments.rows must be an integer between 1 and 8');
    }
    if (!Array.isArray(comp.cells)) {
      errors.push('compartments.cells must be an array');
    } else {
      const expectedLength =
        typeof comp.cols === 'number' && typeof comp.rows === 'number' ? comp.cols * comp.rows : 0;
      if (comp.cells.length !== expectedLength) {
        errors.push(
          `compartments.cells length must equal cols × rows (expected ${expectedLength}, got ${comp.cells.length})`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
