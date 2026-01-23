/**
 * File naming utilities for bin exports.
 *
 * Generates descriptive or compact file names from bin parameters.
 */

import type { BinParams } from '../types';

/** File naming style */
export type FileNameStyle = 'descriptive' | 'compact';

/**
 * Generates a file name from bin parameters and export format.
 *
 * @example
 * // Descriptive: "gridfinity_2x3x6_dividers_scoop.stl"
 * generateFileName(params, 'stl', 'descriptive')
 *
 * // Compact: "gf_2x3x6.stl"
 * generateFileName(params, 'stl', 'compact')
 */
export function generateFileName(
  params: BinParams,
  format: string,
  style: FileNameStyle = 'descriptive'
): string {
  const ext = format.toLowerCase();
  const dims = formatDimensions(params);

  if (style === 'compact') {
    return `gf_${dims}.${ext}`;
  }

  const features = collectFeatures(params);
  const featureSuffix = features.length > 0 ? `_${features.join('_')}` : '';

  return `gridfinity_${dims}${featureSuffix}.${ext}`;
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
