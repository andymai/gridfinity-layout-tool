/**
 * File naming utilities for bin exports.
 *
 * Generates descriptive, compact, or custom file names from bin parameters
 * and optional design name.
 */

import type { BinParams, FileNameStyle, ExportFileNameConfig } from '../types';

/** Default export filename config */
export const DEFAULT_EXPORT_FILE_NAME_CONFIG: ExportFileNameConfig = {
  style: 'descriptive',
  customName: '',
};

/** Characters not allowed in filenames (replaced with underscore) */
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
 * // Descriptive (no design name): "gridfinity_2x3x6_scoop.stl"
 * generateFileName(params, 'stl', { style: 'descriptive', customName: '' })
 *
 * // Descriptive (with design name): "Screwdriver Bin_2x3x6_scoop.stl"
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
  const resolved: ExportFileNameConfig =
    typeof config === 'string'
      ? { style: config === 'custom' ? 'descriptive' : config, customName: '' }
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
  if (params.scoop.enabled) {
    features.push('scoop');
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
