/**
 * Bin Design JSON export, import, and validation utilities.
 *
 * Provides functions for serializing bin designs to JSON format,
 * downloading designs as files, and parsing/validating imported JSON.
 */

import type { BinParams } from '../types';
import type { TFunction } from '@/i18n';
import { BIN_STYLES } from '../types';
import { DESIGNER_CONSTRAINTS } from '../constants/gridfinity';
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
 * @param t - Translation function for localized error messages
 * @returns Parsed design with name and params, or null with error messages
 *
 * @example
 * ```ts
 * const result = parseDesignJSON(jsonString, t);
 * if (result.design) {
 *   loadDesign(result.design.name, result.design.params);
 * } else {
 *   showErrors(result.errors);
 * }
 * ```
 */
export function parseDesignJSON(json: string, t: TFunction): ParseDesignResult {
  const errors: string[] = [];

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      design: null,
      errors: [t('binDesigner.designJson.error.invalidJson', { message: (e as Error).message })],
    };
  }

  // Validate top-level structure
  if (!parsed || typeof parsed !== 'object') {
    return {
      design: null,
      errors: [t('binDesigner.designJson.error.rootNotObject')],
    };
  }

  const data = parsed as Record<string, unknown>;

  // Validate type field
  if (data.type !== 'gridfinity-bin-design') {
    errors.push(t('binDesigner.designJson.error.invalidType', { got: String(data.type) }));
  }

  // Validate version field
  if (!data.version || typeof data.version !== 'string') {
    errors.push(t('binDesigner.designJson.error.missingVersion'));
  }

  // Validate name field
  if (!data.name || typeof data.name !== 'string') {
    errors.push(t('binDesigner.designJson.error.missingName'));
  }

  // Validate params field
  if (!data.params || typeof data.params !== 'object') {
    errors.push(t('binDesigner.designJson.error.missingParams'));
  } else {
    const paramsCheck = validateImportedBinParams(data.params, t);
    if (!paramsCheck.valid) {
      errors.push(...paramsCheck.errors);
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
 * @param t - Translation function for localized error messages
 * @returns Validation result with success flag and error messages
 *
 * @example
 * ```ts
 * const result = validateImportedBinParams(unknownData, t);
 * if (result.valid) {
 *   const params = migrateParams(unknownData as Partial<BinParams>);
 * }
 * ```
 */
export function validateImportedBinParams(params: unknown, t: TFunction): ValidateBinParamsResult {
  const errors: string[] = [];

  if (!params || typeof params !== 'object') {
    return {
      valid: false,
      errors: [t('binDesigner.designJson.error.paramsNotObject')],
    };
  }

  const p = params as Record<string, unknown>;

  // Validate dimensions
  if (typeof p.width !== 'number' || !Number.isFinite(p.width) || p.width <= 0) {
    errors.push(t('binDesigner.designJson.error.widthInvalid'));
  }
  if (typeof p.depth !== 'number' || !Number.isFinite(p.depth) || p.depth <= 0) {
    errors.push(t('binDesigner.designJson.error.depthInvalid'));
  }
  if (typeof p.height !== 'number' || !Number.isFinite(p.height) || p.height <= 0) {
    errors.push(t('binDesigner.designJson.error.heightInvalid'));
  }

  // Validate grid/height units
  if (typeof p.gridUnitMm !== 'number' || !Number.isFinite(p.gridUnitMm) || p.gridUnitMm <= 0) {
    errors.push(t('binDesigner.designJson.error.gridUnitMmInvalid'));
  }
  if (
    typeof p.heightUnitMm !== 'number' ||
    !Number.isFinite(p.heightUnitMm) ||
    p.heightUnitMm <= 0
  ) {
    errors.push(t('binDesigner.designJson.error.heightUnitMmInvalid'));
  }

  // Validate base config
  if (!p.base || typeof p.base !== 'object') {
    errors.push(t('binDesigner.designJson.error.baseNotObject'));
  } else {
    const base = p.base as Record<string, unknown>;
    if (typeof base.style !== 'string') {
      errors.push(t('binDesigner.designJson.error.baseStyleNotString'));
    }
  }

  // Validate style
  if (typeof p.style !== 'string' || !(BIN_STYLES as readonly string[]).includes(p.style)) {
    errors.push(t('binDesigner.designJson.error.styleInvalid', { styles: BIN_STYLES.join(', ') }));
  }

  // Validate compartments config
  if (!p.compartments || typeof p.compartments !== 'object') {
    errors.push(t('binDesigner.designJson.error.compartmentsNotObject'));
  } else {
    const comp = p.compartments as Record<string, unknown>;

    const { MIN_COMPARTMENT_GRID, MAX_COMPARTMENT_GRID } = DESIGNER_CONSTRAINTS;
    if (
      typeof comp.cols !== 'number' ||
      !Number.isInteger(comp.cols) ||
      comp.cols < MIN_COMPARTMENT_GRID ||
      comp.cols > MAX_COMPARTMENT_GRID
    ) {
      errors.push(
        t('binDesigner.designJson.error.compartmentsColsRange', {
          min: MIN_COMPARTMENT_GRID,
          max: MAX_COMPARTMENT_GRID,
        })
      );
    }
    if (
      typeof comp.rows !== 'number' ||
      !Number.isInteger(comp.rows) ||
      comp.rows < MIN_COMPARTMENT_GRID ||
      comp.rows > MAX_COMPARTMENT_GRID
    ) {
      errors.push(
        t('binDesigner.designJson.error.compartmentsRowsRange', {
          min: MIN_COMPARTMENT_GRID,
          max: MAX_COMPARTMENT_GRID,
        })
      );
    }
    if (!Array.isArray(comp.cells)) {
      errors.push(t('binDesigner.designJson.error.compartmentsCellsNotArray'));
    } else {
      const expectedLength =
        typeof comp.cols === 'number' && typeof comp.rows === 'number' ? comp.cols * comp.rows : 0;
      if (comp.cells.length !== expectedLength) {
        errors.push(
          t('binDesigner.designJson.error.compartmentsCellsLength', {
            expected: expectedLength,
            got: comp.cells.length,
          })
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
