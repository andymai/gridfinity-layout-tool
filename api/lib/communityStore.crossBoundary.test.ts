/**
 * Cross-boundary equality test for the community-metrics mirror.
 *
 * api/ cannot import from src/, so the pitch, height unit and seating
 * tolerance `deriveCommunityMetrics` measures a published card with are
 * hand-copied from `GRIDFINITY_SPEC`, and its outer-dimension formula is a
 * hand-copy of `binDimensions`. Card metrics feed bed-fit and search facts, so
 * drift here is silent: nothing 400s, the numbers are just wrong.
 */
import { describe, expect, it } from 'vitest';

import {
  BIN_TOLERANCE_MM,
  DEFAULT_GRID_UNIT_MM,
  DEFAULT_HEIGHT_UNIT_MM,
  deriveCommunityMetrics,
} from './communityStore.js';

import { binDimensions } from '../../src/features/bin-designer/utils/binDimensions.js';
import { DEFAULT_BIN_PARAMS } from '../../src/shared/constants/bin.js';
import { GRIDFINITY_SPEC } from '../../src/shared/printSettings/gridfinityGeometry.js';
import type { BinParams } from '../../src/shared/types/bin.js';

const SHAPES: readonly (readonly [string, Partial<BinParams>])[] = [
  ['stock bin', {}],
  ['tall 1x1', { width: 1, depth: 1, height: 12 }],
  ['wide half-bin', { width: 4.5, depth: 2, height: 3 }],
  ['custom units', { width: 3, depth: 2, height: 5, gridUnitMm: 50, heightUnitMm: 10 }],
];

describe('community metric defaults (cross-boundary mirror)', () => {
  it('takes its pitch, height unit and tolerance from the Gridfinity spec', () => {
    expect(DEFAULT_GRID_UNIT_MM).toBe(GRIDFINITY_SPEC.GRID_SIZE);
    expect(DEFAULT_HEIGHT_UNIT_MM).toBe(GRIDFINITY_SPEC.HEIGHT_UNIT);
    expect(BIN_TOLERANCE_MM).toBe(GRIDFINITY_SPEC.TOLERANCE);
  });

  it('falls back to those defaults when the params carry no units', () => {
    const metrics = deriveCommunityMetrics({ width: 2, depth: 2, height: 3 });
    const client = binDimensions({ ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 3 });
    expect(metrics.gridUnitMm).toBe(GRIDFINITY_SPEC.GRID_SIZE);
    expect(metrics.width).toBe(client.outerW);
    expect(metrics.height).toBe(client.totalH);
  });

  it.each(SHAPES)('%s: outer dimensions match binDimensions', (_label, overrides) => {
    const params: BinParams = { ...DEFAULT_BIN_PARAMS, ...overrides };
    const client = binDimensions(params);
    const metrics = deriveCommunityMetrics(params as unknown as Record<string, unknown>);
    expect(metrics.width).toBeCloseTo(client.outerW, 10);
    expect(metrics.depth).toBeCloseTo(client.outerD, 10);
    expect(metrics.height).toBeCloseTo(client.totalH, 10);
    expect(metrics.gridUnitMm).toBe(params.gridUnitMm);
  });
});
