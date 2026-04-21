import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  BASE_TIMEOUT_MS,
  HEX_PATTERN_BONUS_MS,
  HEX_PLUS_CUTOUT_BONUS_MS,
  HEIGHT_BONUS_MS,
  MAX_TIMEOUT_MS,
  computeGenerationTimeoutMs,
} from './generationTimeout';

function params(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('computeGenerationTimeoutMs', () => {
  it('returns the base timeout for a trivial bin', () => {
    expect(computeGenerationTimeoutMs(params({ height: 3 }))).toBe(BASE_TIMEOUT_MS);
  });

  it('adds a pattern bonus when the hex pattern is enabled', () => {
    const t = computeGenerationTimeoutMs(
      params({
        height: 3,
        wallPattern: { enabled: true, pattern: 'honeycomb' },
      })
    );
    expect(t).toBe(BASE_TIMEOUT_MS + HEX_PATTERN_BONUS_MS);
  });

  it('stacks the cutout bonus only when a side is actually active', () => {
    const allSidesOff = {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: DISABLED_WALL_CUTOUT,
      back: DISABLED_WALL_CUTOUT,
      left: DISABLED_WALL_CUTOUT,
      right: DISABLED_WALL_CUTOUT,
      interior: DISABLED_WALL_CUTOUT,
    };
    const base = params({
      height: 3,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: allSidesOff,
    });
    // walls.enabled but every side still disabled — no bonus.
    expect(computeGenerationTimeoutMs(base)).toBe(BASE_TIMEOUT_MS + HEX_PATTERN_BONUS_MS);

    const withSide = params({
      ...base,
      walls: {
        ...allSidesOff,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    });
    expect(computeGenerationTimeoutMs(withSide)).toBe(
      BASE_TIMEOUT_MS + HEX_PATTERN_BONUS_MS + HEX_PLUS_CUTOUT_BONUS_MS
    );
  });

  it('does not grant the cutout bonus when the pattern is off', () => {
    const t = computeGenerationTimeoutMs(
      params({
        height: 3,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        },
      })
    );
    expect(t).toBe(BASE_TIMEOUT_MS);
  });

  it('adds one height bucket per 2 units above the floor', () => {
    expect(computeGenerationTimeoutMs(params({ height: 4 }))).toBe(BASE_TIMEOUT_MS);
    expect(computeGenerationTimeoutMs(params({ height: 6 }))).toBe(
      BASE_TIMEOUT_MS + HEIGHT_BONUS_MS
    );
    expect(computeGenerationTimeoutMs(params({ height: 8 }))).toBe(
      BASE_TIMEOUT_MS + 2 * HEIGHT_BONUS_MS
    );
  });

  it('caps at the maximum timeout', () => {
    const t = computeGenerationTimeoutMs(
      params({
        height: 20,
        wallPattern: { enabled: true, pattern: 'honeycomb' },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        },
      })
    );
    expect(t).toBe(MAX_TIMEOUT_MS);
  });
});
