/**
 * Pure ingestion core for phone-scanned outlines.
 *
 * A scan arrives as an SVG silhouette in arbitrary units (a traced photo has
 * no real-world scale). This module reuses the SVG-import parser to get cutout
 * specs, measures their combined bounding box, and rescales them uniformly to a
 * user-confirmed real-world dimension before hydration.
 *
 * No React, no store, no side effects.
 */

import type { Result } from '@/core/result';
import { ok, err, isOk } from '@/core/result';
import { parseSvgString } from '../svgImport/svgParser';
import { scaleParsedSpec } from '../svgImport/svgScaleSpec';
import type { ParsedCutoutSpec, SvgImportError } from '../svgImport/types';
import { minAreaRect } from '@/shared/scanTrace/minAreaRect';
import type { Point } from '@/shared/scanTrace';

/** Combined extent of all parsed specs, in the SVG's own (unscaled) units. */
export interface ScanBounds {
  readonly width: number;
  readonly depth: number;
  /** Longest side — the dimension the user confirms a real-world size for. */
  readonly longest: number;
}

export interface ParsedScan {
  readonly specs: readonly ParsedCutoutSpec[];
  readonly bounds: ScanBounds;
  /**
   * What the user gives a real size for, measured along its own axis: the
   * whole outline, or the longest tool when several lie side by side, since
   * nobody knows the span of a batch. Longest, not largest by area, so the
   * prompt names a tool the user can pick out by eye.
   */
  readonly sized: ScanBounds;
  readonly sizedByLongest: boolean;
}

/** Bounding box across every spec's [x, x+width] × [y, y+depth] footprint. */
export function computeScanBounds(specs: readonly ParsedCutoutSpec[]): ScanBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of specs) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.depth);
  }

  const width = Number.isFinite(minX) ? maxX - minX : 0;
  const depth = Number.isFinite(minY) ? maxY - minY : 0;
  return { width, depth, longest: Math.max(width, depth) };
}

/**
 * Parse a scanned SVG outline into specs plus their measured bounds.
 *
 * Rejects outlines that parse but have zero size — the scale-confirm step
 * divides by the longest side, and a degenerate outline can't be placed.
 */
export function parseScanSvg(svgString: string): Result<ParsedScan, SvgImportError> {
  const parsed = parseSvgString(svgString);
  if (!isOk(parsed)) return parsed;

  const specs = parsed.value;
  const bounds = computeScanBounds(specs);
  if (bounds.longest <= 0) {
    return err({ code: 'SVG_NO_SHAPES', detail: 'Traced outline has zero size' });
  }

  const longest = specs
    .map((spec) => ({ spec, size: ownSize([spec]) }))
    .reduce((a, b) => (b.size.longest > a.size.longest ? b : a));
  const box = computeScanBounds([longest.spec]);
  // A spec inside the longest one is detail on the same tool, not a second tool.
  const sizedByLongest = box.width < bounds.width - 1e-6 || box.depth < bounds.depth - 1e-6;
  return ok({
    specs,
    bounds,
    sized: sizedByLongest ? longest.size : ownSize(specs),
    sizedByLongest,
  });
}

/** A spec's outline as points: its path, or its box turned by its rotation. */
function outlineOf(spec: ParsedCutoutSpec): Point[] {
  if (spec.path && spec.path.length >= 3) return spec.path.map(({ x, y }) => ({ x, y }));
  const cx = spec.x + spec.width / 2;
  const cy = spec.y + spec.depth / 2;
  const a = (spec.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const dx = (sx * spec.width) / 2;
    const dy = (sy * spec.depth) / 2;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

/**
 * Long and short sides measured along the outline's own axis, the way a ruler
 * laid along the tool reads them: a tool photographed at an angle has a
 * bounding box shorter than the tool, and scaling by it would size the whole
 * batch wrong.
 */
function ownSize(specs: readonly ParsedCutoutSpec[]): ScanBounds {
  const rect = minAreaRect(specs.flatMap(outlineOf));
  if (!rect) return computeScanBounds(specs);
  return { width: rect.width, depth: rect.height, longest: rect.width };
}

/**
 * Uniformly rescale specs so their longest side equals `targetLongestMm`.
 *
 * Scale is uniform (about the SVG origin) to preserve the outline's shape and
 * the relative layout of multiple specs. Returns the specs unchanged when the
 * target or current size is non-positive, or already at scale.
 */
export function rescaleToLongestMm(
  specs: readonly ParsedCutoutSpec[],
  currentLongest: number,
  targetLongestMm: number
): ParsedCutoutSpec[] {
  if (targetLongestMm <= 0 || currentLongest <= 0) return [...specs];
  const factor = targetLongestMm / currentLongest;
  if (factor === 1) return [...specs];
  return specs.map((s) => scaleParsedSpec(s, factor));
}
