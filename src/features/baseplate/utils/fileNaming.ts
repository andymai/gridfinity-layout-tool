/**
 * File naming utilities for baseplate exports.
 *
 * Generates descriptive, compact, or custom file names from baseplate
 * parameters and configuration.
 */

import type { BaseplateParams, ExportFileNameConfig, ExportFileFormat } from '@/shared/types/bin';
import { resolveConnectorStyle } from '@/shared/types/bin';

/** Characters not allowed in filenames (replaced with underscore) */
// eslint-disable-next-line no-control-regex -- Intentionally matching control chars for filename sanitization
const UNSAFE_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function sanitizeFileName(name: string): string {
  return name.replace(UNSAFE_CHARS, '_').trim();
}

interface BaseplateNamingParams {
  readonly width: number;
  readonly depth: number;
  readonly magnetHoles: boolean;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  readonly connectorStyle?: 'none' | 'dovetail' | 'snap';
}

/**
 * Generates a file name for baseplate exports.
 *
 * @example
 * // Descriptive: "gridfinity-baseplate-8x8-magnets.stl"
 * // Compact: "gf-bp-8x8.stl"
 * // Custom: "my-baseplate.stl"
 */
export function generateBaseplateFileName(
  params: BaseplateNamingParams,
  format: ExportFileFormat,
  config: ExportFileNameConfig
): string {
  const ext = format.toLowerCase();

  if (config.style === 'custom') {
    const sanitized = sanitizeFileName(config.customName);
    const name = !sanitized || /^_+$/.test(sanitized) ? 'gridfinity-baseplate' : sanitized;
    return `${name}.${ext}`;
  }

  const dims = `${formatNumber(params.width)}x${formatNumber(params.depth)}`;

  if (config.style === 'compact') {
    return `gf-bp-${dims}.${ext}`;
  }

  // Descriptive style
  const features = collectFeatures(params);
  const featureSuffix = features.length > 0 ? `-${features.join('-')}` : '';
  return `gridfinity-baseplate-${dims}${featureSuffix}.${ext}`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function collectFeatures(params: BaseplateNamingParams): string[] {
  const features: string[] = [];

  if (params.magnetHoles) {
    features.push('magnets');
  }

  const hasPadding =
    params.paddingLeft > 0 ||
    params.paddingRight > 0 ||
    params.paddingFront > 0 ||
    params.paddingBack > 0;
  if (hasPadding) {
    features.push('padded');
  }

  if (params.connectorStyle === 'dovetail') features.push('dovetails');
  else if (params.connectorStyle === 'snap') features.push('snap');

  return features;
}

/**
 * Creates naming params from full BaseplateParams.
 * Convenience adapter for the generation hook.
 */
export function toNamingParams(params: BaseplateParams): BaseplateNamingParams {
  return {
    width: params.width,
    depth: params.depth,
    magnetHoles: params.magnetHoles,
    paddingLeft: params.paddingLeft,
    paddingRight: params.paddingRight,
    paddingFront: params.paddingFront,
    paddingBack: params.paddingBack,
    connectorStyle: resolveConnectorStyle(params),
  };
}
