/**
 * File naming utilities for bin and divider exports.
 *
 * Generates descriptive, compact, or custom file names from bin parameters
 * and optional design name.
 */

import type { BinParams, FileNameStyle, ExportFileNameConfig } from '../types';
import { GRIDFINITY } from '../constants/gridfinity';
import {
  calculateDividerHeight,
  calculateDividerLength,
  getEffectiveSlotDimensions,
} from '@/shared/utils/slotMath';

/** Default export filename config */
export const DEFAULT_EXPORT_FILE_NAME_CONFIG: ExportFileNameConfig = {
  style: 'descriptive',
  customName: '',
  format: '3mf',
};

/** Characters not allowed in filenames (replaced with underscore) */
// eslint-disable-next-line no-control-regex -- Intentionally matching control chars for filename sanitization
const UNSAFE_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Sanitizes a string for use in a filename.
 * Replaces unsafe characters and trims whitespace.
 */
export function sanitizeFileName(name: string): string {
  return name.replace(UNSAFE_CHARS, '_').trim();
}

/**
 * Determines the effective design name prefix.
 * Returns null if the design name is the default "Untitled Bin" or empty.
 */
function getEffectiveDesignName(designName: string | undefined): string | null {
  if (!designName || designName === 'Untitled Bin' || designName.trim() === '') {
    return null;
  }
  return sanitizeFileName(designName);
}

export type { FileNameStyle };

/**
 * Generates a file name from bin parameters, export format, and naming config.
 *
 * @example
 * // Descriptive (no design name): "gridfinity_2x3x6_magnets.stl"
 * generateFileName(params, 'stl', { style: 'descriptive', customName: '' })
 *
 * // Descriptive (with design name): "Screwdriver Bin_2x3x6_magnets.stl"
 * generateFileName(params, 'stl', { style: 'descriptive', customName: '' }, 'Screwdriver Bin')
 *
 * // Compact (no design name): "gf_2x3x6.stl"
 * generateFileName(params, 'stl', { style: 'compact', customName: '' })
 *
 * // Compact (with design name): "Screwdriver Bin_2x3x6.stl"
 * generateFileName(params, 'stl', { style: 'compact', customName: '' }, 'Screwdriver Bin')
 *
 * // Custom: "my-special-bin.stl"
 * generateFileName(params, 'stl', { style: 'custom', customName: 'my-special-bin' })
 */
export function generateFileName(
  params: BinParams,
  format: string,
  config: FileNameStyle | ExportFileNameConfig = 'descriptive',
  designName?: string
): string {
  const ext = format.toLowerCase();

  // Normalize legacy string-based style to config object
  const resolved =
    typeof config === 'string'
      ? { style: (config === 'custom' ? 'descriptive' : config) as FileNameStyle, customName: '' }
      : config;

  if (resolved.style === 'custom') {
    const sanitized = sanitizeFileName(resolved.customName);
    const name = !sanitized || /^_+$/.test(sanitized) ? 'gridfinity-bin' : sanitized;
    return `${name}.${ext}`;
  }

  const dims = formatDimensions(params);
  const effectiveName = getEffectiveDesignName(designName);

  if (resolved.style === 'compact') {
    const prefix = effectiveName ?? 'gf';
    return `${prefix}_${dims}.${ext}`;
  }

  // Descriptive style
  const prefix = effectiveName ?? 'gridfinity';
  const features = collectFeatures(params);
  const featureSuffix = features.length > 0 ? `_${features.join('_')}` : '';

  return `${prefix}_${dims}${featureSuffix}.${ext}`;
}

/**
 * Formats dimensions as WxDxH string.
 * Uses integers when possible, otherwise one decimal place.
 */
function formatDimensions(params: BinParams): string {
  const w = formatNumber(params.width);
  const d = formatNumber(params.depth);
  const h = formatNumber(params.height);
  return `${w}x${d}x${h}`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Collects active feature names for the descriptive filename.
 */
function collectFeatures(params: BinParams): string[] {
  const features: string[] = [];

  if (params.style !== 'standard') {
    features.push(params.style);
  }
  if (params.compartments.cols > 1 || params.compartments.rows > 1) {
    const count = new Set(params.compartments.cells).size;
    features.push(`${count}comp`);
  }
  if (params.label.enabled) {
    features.push('label');
  }
  if (params.base.style === 'magnet_and_screw') {
    features.push('magnets+screws');
  } else if (params.base.style === 'magnet') {
    features.push('magnets');
  } else if (params.base.style === 'screw') {
    features.push('screws');
  }

  return features;
}

/**
 * Generates a descriptive filename for divider piece STL exports.
 *
 * Includes bin dimensions, divider direction, and actual piece dimensions
 * so the user can identify pieces when they have multiple divider files
 * in their slicer folder.
 *
 * @example
 * // No design name, vertical only: "gridfinity_2x3x6_divider-vertical_78x30mm.stl"
 * // With design name, horizontal: "Screwdriver Bin_2x3x6_divider-horizontal_36x30mm.stl"
 * // Both axes: "gridfinity_2x3x6_dividers_78x30+36x30mm.stl"
 * // Custom naming: "my-bin_dividers.stl"
 */
export function generateDividerFileName(
  params: BinParams,
  config: FileNameStyle | ExportFileNameConfig = 'descriptive',
  designName?: string
): string {
  const resolved =
    typeof config === 'string'
      ? { style: (config === 'custom' ? 'descriptive' : config) as FileNameStyle, customName: '' }
      : config;

  if (resolved.style === 'custom') {
    const sanitized = sanitizeFileName(resolved.customName);
    const name = !sanitized || /^_+$/.test(sanitized) ? 'gridfinity-dividers' : sanitized;
    return `${name}_dividers.stl`;
  }

  const dims = formatDimensions(params);
  const effectiveName = getEffectiveDesignName(designName);

  // Compute actual divider piece dimensions
  const { slotConfig, dividerPieces, wallThickness } = params;
  const totalH = params.height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = totalH - GRIDFINITY.SOCKET_HEIGHT;
  const hasLip = params.base.stackingLip;
  const dividerHeight = calculateDividerHeight(dividerPieces, wallHeight, hasLip);
  const { slotDepth } = getEffectiveSlotDimensions(
    wallThickness,
    dividerPieces.thickness,
    dividerPieces.clearance
  );

  const outerW = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  const xEnabled = slotConfig.x.enabled;
  const yEnabled = slotConfig.y.enabled;

  // Build piece dimension strings (length×height in mm, 1 decimal)
  const fmtMm = (n: number) => (Math.round(n * 10) / 10).toString();
  const pieceDims: string[] = [];
  if (xEnabled) {
    const len = calculateDividerLength(innerW, slotDepth, dividerPieces.clearance);
    pieceDims.push(`${fmtMm(len)}x${fmtMm(dividerHeight)}`);
  }
  if (yEnabled) {
    const len = calculateDividerLength(innerD, slotDepth, dividerPieces.clearance);
    pieceDims.push(`${fmtMm(len)}x${fmtMm(dividerHeight)}`);
  }

  // Direction label
  const bothAxes = xEnabled && yEnabled;
  const direction = bothAxes ? '' : xEnabled ? '-horizontal' : '-vertical';
  const dividerLabel = bothAxes ? 'dividers' : `divider${direction}`;

  if (resolved.style === 'compact') {
    const prefix = effectiveName ?? 'gf';
    return `${prefix}_${dims}_${dividerLabel}.stl`;
  }

  // Descriptive style: include piece dimensions
  const prefix = effectiveName ?? 'gridfinity';
  const pieceSuffix = pieceDims.length > 0 ? `_${pieceDims.join('+')}mm` : '';
  return `${prefix}_${dims}_${dividerLabel}${pieceSuffix}.stl`;
}
