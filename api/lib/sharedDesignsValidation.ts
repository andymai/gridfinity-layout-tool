/** Validation of the linked bin designs a shared layout carries: ids, names, params and assembly envelopes. */

import { sanitizeString } from './sanitize.js';
import type { ValidationError } from './shareConstraints.js';
import { isObject, validationError } from './validationUtils.js';
import { validateDesignerShare } from './designerValidation.js';
import { validateAssemblyEnvelope, validateAssemblyStructure } from './assemblyValidation.js';

/** Design ids are generated as `design_{timestamp}_{suffix}`; 64 leaves room to spare. */
export const DESIGN_ID_MAX_LENGTH = 64;

/**
 * Budget for the `linkedDesigns` payload that rides alongside a shared layout.
 * Separate from the layout's own cap so a design-heavy share can't crowd out
 * the layout itself. A plain design serializes to ~3KB and a cutout-heavy one
 * to ~7KB, so this holds well over a hundred; imported-mesh designs (which
 * carry base64 geometry in `params.meshAssets`) are the only realistic way to
 * reach it, and those are skipped individually rather than failing the share.
 */
const MAX_LINKED_DESIGNS = 250;

const MAX_LINKED_DESIGNS_BYTES = 512 * 1024;

// Per-assembly cap, matching the sync endpoint's design payload budget.
const MAX_ASSEMBLY_DESIGN_BYTES = 100 * 1024;

const DESIGN_NAME_MAX_LENGTH = 64;

/** Reserved keys that cannot be used as custom property names */
export const RESERVED_PROPERTY_KEYS = [
  'id',
  'layerId',
  'x',
  'y',
  'width',
  'depth',
  'height',
  'clearanceHeight',
  'category',
  'label',
  'notes',
  'customProperties',
  // Prevent prototype pollution
  '__proto__',
  'constructor',
  'prototype',
];

/** A design travelling with a shared layout, keyed by the id its bins carry.
 *  Bin designs carry `params`; Workshop assemblies carry envelope + structure. */
export interface SharedDesignShape {
  id: string;
  name: string;
  params?: Record<string, unknown>;
  kind?: 'assembly';
  envelope?: Record<string, unknown>;
  structure?: Record<string, unknown>;
}

export type SharedDesignsResult =
  { valid: true; designs: SharedDesignShape[] } | { valid: false; error: ValidationError };

/**
 * Validate the `linkedDesigns` payload accompanying a shared layout.
 *
 * Each design's params go through the same deep validator the single-design
 * designer share uses, so a layout share can't become a side door around the
 * stricter checks (mesh-asset cross-referencing in particular).
 *
 * Absent/empty is valid — layouts with no linked designs and older clients
 * both land here.
 */
export function validateSharedDesigns(data: unknown): SharedDesignsResult {
  if (data === undefined || data === null) return { valid: true, designs: [] };
  if (!Array.isArray(data)) {
    return validationError('VALIDATION_ERROR', 'linkedDesigns must be an array');
  }
  if (data.length > MAX_LINKED_DESIGNS) {
    return validationError(
      'VALIDATION_ERROR',
      `Too many linked designs (max ${MAX_LINKED_DESIGNS})`
    );
  }

  const designs: SharedDesignShape[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const entry of data) {
    if (!isObject(entry)) {
      return validationError('VALIDATION_ERROR', 'Invalid linked design entry');
    }
    const { id, name, params } = entry;
    if (typeof id !== 'string' || id.length === 0 || id.length > DESIGN_ID_MAX_LENGTH) {
      return validationError('VALIDATION_ERROR', 'Invalid linked design id');
    }
    if (typeof name !== 'string') {
      return validationError('VALIDATION_ERROR', 'Invalid linked design name');
    }
    // Bins share designs freely, so the client can emit the same id twice.
    if (seen.has(id)) continue;

    if (entry.kind === 'assembly') {
      // Assemblies ride the same deep validators the sync endpoint uses, so a
      // layout share can't become a side door around them.
      const envelopeResult = validateAssemblyEnvelope(entry.envelope);
      if (!envelopeResult.valid) {
        return validationError(
          'VALIDATION_ERROR',
          `Invalid linked design envelope: ${envelopeResult.error.message}`
        );
      }
      const structureResult = validateAssemblyStructure(entry.structure);
      if (!structureResult.valid) {
        return validationError(
          'VALIDATION_ERROR',
          `Invalid linked design structure: ${structureResult.error.message}`
        );
      }
      const assemblyBytes = JSON.stringify({
        envelope: entry.envelope,
        structure: entry.structure,
      }).length;
      if (assemblyBytes > MAX_ASSEMBLY_DESIGN_BYTES) {
        return validationError(
          'SIZE_LIMIT',
          `Linked assembly exceeds maximum size of ${MAX_ASSEMBLY_DESIGN_BYTES / 1024}KB`
        );
      }
      totalBytes += assemblyBytes;
      if (totalBytes > MAX_LINKED_DESIGNS_BYTES) {
        return validationError(
          'SIZE_LIMIT',
          `Linked designs exceed maximum size of ${MAX_LINKED_DESIGNS_BYTES / 1024}KB`
        );
      }
      seen.add(id);
      designs.push({
        id: sanitizeString(id, DESIGN_ID_MAX_LENGTH),
        name: sanitizeString(name, DESIGN_NAME_MAX_LENGTH),
        kind: 'assembly',
        envelope: entry.envelope as Record<string, unknown>,
        structure: entry.structure as Record<string, unknown>,
      });
      continue;
    }

    const paramsBytes = JSON.stringify(params ?? null).length;
    const result = validateDesignerShare({ type: 'designer', version: 1, params }, paramsBytes);
    if (!result.valid) {
      return validationError('VALIDATION_ERROR', `Invalid linked design: ${result.error.message}`);
    }

    totalBytes += paramsBytes;
    if (totalBytes > MAX_LINKED_DESIGNS_BYTES) {
      return validationError(
        'SIZE_LIMIT',
        `Linked designs exceed maximum size of ${MAX_LINKED_DESIGNS_BYTES / 1024}KB`
      );
    }

    seen.add(id);
    designs.push({
      id: sanitizeString(id, DESIGN_ID_MAX_LENGTH),
      name: sanitizeString(name, DESIGN_NAME_MAX_LENGTH),
      params: result.payload.params,
    });
  }

  return { valid: true, designs };
}

/**
 * Narrow a {@link SharedDesignsResult} to its failure case.
 */
export function isSharedDesignsError(
  result: SharedDesignsResult
): result is { valid: false; error: ValidationError } {
  return !result.valid;
}
