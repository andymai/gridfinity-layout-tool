import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { ResolvedBaseplateParams, BinParams } from '@/shared/types/bin';
import {
  BASE_TIMEOUT_MS,
  BASEPLATE_CONNECTOR_BONUS_MS,
  BASEPLATE_LIGHTWEIGHT_BONUS_MS,
  BASEPLATE_MAGNET_BONUS_CAP_MS,
  BASEPLATE_MAGNET_MS_PER_CELL,
  BASEPLATE_MAX_TIMEOUT_MS,
  HEX_PATTERN_BONUS_MS,
  HEX_PLUS_CUTOUT_BONUS_MS,
  HEX_FOOTPRINT_BONUS_MS_PER_CELL,
  HEX_FOOTPRINT_BONUS_FLOOR_CELLS,
  HEIGHT_BONUS_MS,
  MAX_TIMEOUT_MS,
  EXPORT_TIMEOUT_MULTIPLIER,
  EXPORT_MAX_TIMEOUT_MS,
  computeBaseplateTimeoutMs,
  computeBaseplateExportTimeoutMs,
  computeExportTimeoutMs,
  computeGenerationTimeoutMs,
} from './generationTimeout';

const HEX_ON = { enabled: true, pattern: 'honeycomb' } as const;

function params(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

function bpParams(overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams {
  // lightweight defaults to `false` here so base-case assertions aren't
  // polluted by the implicit "undefined = on" bonus. Tests that care about
  // the lightweight bonus opt in explicitly.
  return {
    width: 2,
    depth: 2,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    lightweight: false,
    ...overrides,
  };
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

  it('grants a footprint bonus to large hex bins, scaled per grid cell above the floor', () => {
    // 8×8 = 64 cells; 64 - 16 floor = 48 chargeable cells.
    const t = computeGenerationTimeoutMs(
      params({ width: 8, depth: 8, height: 3, wallPattern: HEX_ON })
    );
    expect(t).toBe(BASE_TIMEOUT_MS + HEX_PATTERN_BONUS_MS + 48 * HEX_FOOTPRINT_BONUS_MS_PER_CELL);
  });

  it('rounds fractional footprint dimensions up when costing cells', () => {
    const frac = computeGenerationTimeoutMs(
      params({ width: 7.5, depth: 8, height: 3, wallPattern: HEX_ON })
    );
    const rounded = computeGenerationTimeoutMs(
      params({ width: 8, depth: 8, height: 3, wallPattern: HEX_ON })
    );
    expect(frac).toBe(rounded);
  });

  it('does not grant a footprint bonus below the cell floor', () => {
    // 4×4 = 16 cells = exactly the floor → no footprint bonus.
    const t = computeGenerationTimeoutMs(
      params({ width: 4, depth: 4, height: 3, wallPattern: HEX_ON })
    );
    expect(t).toBe(BASE_TIMEOUT_MS + HEX_PATTERN_BONUS_MS);
    expect(HEX_FOOTPRINT_BONUS_FLOOR_CELLS).toBe(16);
  });

  it('does not grant a footprint bonus when the hex pattern is off', () => {
    // A large plain bin tessellates fast — footprint cost is hex-driven.
    const t = computeGenerationTimeoutMs(params({ width: 12, depth: 12, height: 3 }));
    expect(t).toBe(BASE_TIMEOUT_MS);
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

  it('caps a large-footprint hex bin at the maximum timeout', () => {
    // 20×20×20 hex: raw budget (base + hex + 384-cell footprint + 8 height
    // buckets ≈ 261s) exceeds the 180s ceiling, so it clamps to MAX.
    const t = computeGenerationTimeoutMs(
      params({ width: 20, depth: 20, height: 20, wallPattern: HEX_ON })
    );
    expect(t).toBe(MAX_TIMEOUT_MS);
  });

  it('clamps non-finite or invalid dimensions into the supported range', () => {
    // Mid-edit UI state can transiently present NaN/negative dims. setTimeout(NaN)
    // coerces to 0ms and would cancel generation immediately, so the budget must
    // stay finite and ≥ BASE regardless of input.
    const cases = [
      params({ width: Number.NaN, depth: 8, height: 6, wallPattern: HEX_ON }),
      params({ width: 8, depth: Number.POSITIVE_INFINITY, height: 6, wallPattern: HEX_ON }),
      params({ width: -4, depth: 8, height: 6, wallPattern: HEX_ON }),
      params({ width: 8, depth: 8, height: Number.NaN, wallPattern: HEX_ON }),
    ];
    for (const p of cases) {
      const t = computeGenerationTimeoutMs(p);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(BASE_TIMEOUT_MS);
      expect(t).toBeLessThanOrEqual(MAX_TIMEOUT_MS);
    }
  });
});

describe('computeBaseplateTimeoutMs', () => {
  it('returns the base timeout for a plain baseplate with no features', () => {
    expect(computeBaseplateTimeoutMs(bpParams())).toBe(BASE_TIMEOUT_MS);
  });

  it('scales with cell count when magnet holes are enabled', () => {
    // 3×3 = 9 cells × 200ms = 1800ms bonus, well under the cap.
    expect(computeBaseplateTimeoutMs(bpParams({ width: 3, depth: 3, magnetHoles: true }))).toBe(
      BASE_TIMEOUT_MS + 9 * BASEPLATE_MAGNET_MS_PER_CELL
    );
  });

  it('rounds fractional grid dimensions up when costing magnet cells', () => {
    // 2.5 × 3 rounds to 3 × 3 for cell cost — a fractional cell still costs a
    // full cell's worth of boolean work.
    const fractional = computeBaseplateTimeoutMs(
      bpParams({ width: 2.5, depth: 3, magnetHoles: true })
    );
    const rounded = computeBaseplateTimeoutMs(bpParams({ width: 3, depth: 3, magnetHoles: true }));
    expect(fractional).toBe(rounded);
  });

  it('caps the magnet bonus before the grid grows unbounded', () => {
    // 30×30 = 900 cells would be 180s of bonus without the cap; must clamp.
    const t = computeBaseplateTimeoutMs(bpParams({ width: 30, depth: 30, magnetHoles: true }));
    expect(t).toBe(BASE_TIMEOUT_MS + BASEPLATE_MAGNET_BONUS_CAP_MS);
  });

  it('stacks connector and lightweight bonuses on top of magnets', () => {
    const t = computeBaseplateTimeoutMs(
      bpParams({
        width: 5,
        depth: 5,
        magnetHoles: true,
        connectorNubs: true,
        lightweight: true,
      })
    );
    expect(t).toBe(
      BASE_TIMEOUT_MS +
        25 * BASEPLATE_MAGNET_MS_PER_CELL +
        BASEPLATE_CONNECTOR_BONUS_MS +
        BASEPLATE_LIGHTWEIGHT_BONUS_MS
    );
  });

  it('sums all bonuses (magnet-capped) when every feature is enabled on a large grid', () => {
    const t = computeBaseplateTimeoutMs(
      bpParams({
        width: 100,
        depth: 100,
        magnetHoles: true,
        connectorNubs: true,
        lightweight: true,
      })
    );
    expect(t).toBe(
      BASE_TIMEOUT_MS +
        BASEPLATE_MAGNET_BONUS_CAP_MS +
        BASEPLATE_CONNECTOR_BONUS_MS +
        BASEPLATE_LIGHTWEIGHT_BONUS_MS
    );
  });

  it('never exceeds BASEPLATE_MAX_TIMEOUT_MS regardless of input', () => {
    // Defensive ceiling — current bonuses sum below it, but future additions
    // could push past without the clamp.
    const t = computeBaseplateTimeoutMs(
      bpParams({
        width: 1000,
        depth: 1000,
        magnetHoles: true,
        connectorNubs: true,
        lightweight: true,
      })
    );
    expect(t).toBeLessThanOrEqual(BASEPLATE_MAX_TIMEOUT_MS);
  });

  it('clamps non-finite and invalid dimensions into the supported timeout range', () => {
    const cases = [
      bpParams({ width: Number.NaN, depth: 3, magnetHoles: true }),
      bpParams({ width: 3, depth: Number.NaN, magnetHoles: true }),
      bpParams({ width: -1, depth: 3, magnetHoles: true }),
      bpParams({ width: 3, depth: -1, magnetHoles: true }),
      bpParams({ width: Number.POSITIVE_INFINITY, depth: 3, magnetHoles: true }),
      bpParams({ width: 3, depth: Number.POSITIVE_INFINITY, magnetHoles: true }),
    ];

    for (const baseplateParams of cases) {
      const timeout = computeBaseplateTimeoutMs(baseplateParams);
      expect(Number.isFinite(timeout)).toBe(true);
      expect(timeout).toBeGreaterThanOrEqual(BASE_TIMEOUT_MS);
      expect(timeout).toBeLessThanOrEqual(BASEPLATE_MAX_TIMEOUT_MS);
    }
  });

  it('treats omitted lightweight field as enabled (matches generator default)', () => {
    // `baseplateGenerator.ts` runs the lightweight floor-cut whenever
    // `lightweight !== false`, so omitting the field triggers the work and
    // must also grant the bonus — otherwise the budget undercounts.
    const { lightweight: _omit, ...rest } = bpParams();
    void _omit;
    expect(computeBaseplateTimeoutMs(rest)).toBe(BASE_TIMEOUT_MS + BASEPLATE_LIGHTWEIGHT_BONUS_MS);
  });

  it('shares the 3-minute hard ceiling with bins', () => {
    // Honeycomb bins are now the heaviest pipeline, so baseplates no longer get a
    // higher ceiling than bins — both clamp at the agreed 3-minute cap.
    expect(BASEPLATE_MAX_TIMEOUT_MS).toBe(MAX_TIMEOUT_MS);
  });
});

describe('export budget tuning', () => {
  it('models the slowest user hardware with a 6× multiplier', () => {
    // Tuned up from 4× after users still hit ExportTimeoutError on heavy designs:
    // old phones / throttled mobile browsers run ~5–6× the reference machine.
    expect(EXPORT_TIMEOUT_MULTIPLIER).toBe(6);
  });

  it('caps exports at 20 minutes', () => {
    // High enough that the heaviest honeycomb pipeline receives the full 6×
    // budget; still bounds a genuinely-wedged WASM heap.
    expect(EXPORT_MAX_TIMEOUT_MS).toBe(20 * 60_000);
  });
});

describe('computeExportTimeoutMs', () => {
  it('scales a trivial bin by the export multiplier', () => {
    // raw = BASE (30s); export = BASE × multiplier. Exports run on the user's
    // possibly-slow hardware and are user-committed + cancellable, so they get a
    // far more generous budget than the live preview.
    expect(computeExportTimeoutMs(params({ height: 3 }))).toBe(
      BASE_TIMEOUT_MS * EXPORT_TIMEOUT_MULTIPLIER
    );
  });

  it('preserves the complexity ordering — a hex bin still gets more than a plain one', () => {
    const plain = computeExportTimeoutMs(params({ height: 3 }));
    const hex = computeExportTimeoutMs(params({ height: 3, wallPattern: HEX_ON }));
    expect(hex).toBeGreaterThan(plain);
    // Specifically: (BASE + hex bonus) × multiplier.
    expect(hex).toBe((BASE_TIMEOUT_MS + HEX_PATTERN_BONUS_MS) * EXPORT_TIMEOUT_MULTIPLIER);
  });

  it('runs well past the preview ceiling for heavy bins', () => {
    // A bin that clamps to the 3-minute preview cap should get a much larger
    // export budget — the whole point of the change.
    const t = computeExportTimeoutMs(
      params({ width: 20, depth: 20, height: 20, wallPattern: HEX_ON })
    );
    expect(t).toBeGreaterThan(MAX_TIMEOUT_MS);
  });

  it('caps at the export ceiling', () => {
    // 20×20×20 hex raw ≈ 261s; ×6 ≈ 1566s, above the 1200s export ceiling → clamp.
    const t = computeExportTimeoutMs(
      params({ width: 20, depth: 20, height: 20, wallPattern: HEX_ON })
    );
    expect(t).toBe(EXPORT_MAX_TIMEOUT_MS);
  });

  it('clamps non-finite or invalid dimensions into the supported range', () => {
    const cases = [
      params({ width: Number.NaN, depth: 8, height: 6, wallPattern: HEX_ON }),
      params({ width: 8, depth: Number.POSITIVE_INFINITY, height: 6, wallPattern: HEX_ON }),
      params({ width: -4, depth: 8, height: 6, wallPattern: HEX_ON }),
      params({ width: 8, depth: 8, height: Number.NaN, wallPattern: HEX_ON }),
    ];
    for (const p of cases) {
      const t = computeExportTimeoutMs(p);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(BASE_TIMEOUT_MS);
      expect(t).toBeLessThanOrEqual(EXPORT_MAX_TIMEOUT_MS);
    }
  });
});

describe('computeBaseplateExportTimeoutMs', () => {
  it('scales a plain baseplate by the export multiplier', () => {
    expect(computeBaseplateExportTimeoutMs(bpParams())).toBe(
      BASE_TIMEOUT_MS * EXPORT_TIMEOUT_MULTIPLIER
    );
  });

  it('scales the magnet bonus alongside the base', () => {
    // (BASE + 9-cell magnet bonus) × multiplier.
    const t = computeBaseplateExportTimeoutMs(bpParams({ width: 3, depth: 3, magnetHoles: true }));
    expect(t).toBe(
      (BASE_TIMEOUT_MS + 9 * BASEPLATE_MAGNET_MS_PER_CELL) * EXPORT_TIMEOUT_MULTIPLIER
    );
  });

  it('never exceeds the export ceiling regardless of input', () => {
    const t = computeBaseplateExportTimeoutMs(
      bpParams({
        width: 1000,
        depth: 1000,
        magnetHoles: true,
        connectorNubs: true,
        lightweight: true,
      })
    );
    expect(t).toBeLessThanOrEqual(EXPORT_MAX_TIMEOUT_MS);
  });

  it('clamps non-finite and invalid dimensions into the supported range', () => {
    const cases = [
      bpParams({ width: Number.NaN, depth: 3, magnetHoles: true }),
      bpParams({ width: 3, depth: Number.POSITIVE_INFINITY, magnetHoles: true }),
      bpParams({ width: -1, depth: 3, magnetHoles: true }),
    ];
    for (const p of cases) {
      const t = computeBaseplateExportTimeoutMs(p);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(BASE_TIMEOUT_MS);
      expect(t).toBeLessThanOrEqual(EXPORT_MAX_TIMEOUT_MS);
    }
  });
});
