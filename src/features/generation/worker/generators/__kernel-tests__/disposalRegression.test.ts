/**
 * WASM disposal regression tests.
 *
 * Verifies that explicit disposal (DisposalScope in builders, manual .delete()
 * in pipeline stages, onEvict in LRU caches) keeps WASM handle counts bounded
 * and prevents shapes from leaking to the FinalizationRegistry (GC safety net).
 *
 * Requires real brepjs WASM — excluded from default CI via __kernel-tests__ path.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/disposalRegression
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getDisposalStats, resetDisposalStats } from 'brepjs';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { clearAllCaches } from '../shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

beforeEach(() => {
  clearAllCaches();
  resetDisposalStats();
});

describe('WASM disposal regression', () => {
  it('liveHandles stays bounded after 20 generation cycles', () => {
    const generateBin = getGenerateBin();

    // Generate with varying grid sizes to force cache evictions (LRU capacity = 5)
    for (let i = 0; i < 10; i++) {
      const gridW = 1 + (i % 4); // cycles through 1-4
      const gridD = 1 + ((i + 1) % 3); // cycles through 1-3
      generateBin(buildParams({ gridW, gridD }));
    }

    const stats5 = getDisposalStats();

    // Run 10 more cycles — handle count should not grow linearly
    for (let i = 10; i < 20; i++) {
      const gridW = 1 + (i % 4);
      const gridD = 1 + ((i + 1) % 3);
      generateBin(buildParams({ gridW, gridD }));
    }

    const stats10 = getDisposalStats();

    // With pipeline + cache disposal, handle count should plateau.
    // Allow 20% growth tolerance for minor variations.
    expect(stats10.liveHandles).toBeLessThan(stats5.liveHandles * 1.2 + 20);
  }, 120_000);

  it('clearAllCaches reduces liveHandles', () => {
    const generateBin = getGenerateBin();

    // Generate with several different params to populate all cache types
    for (let gridW = 1; gridW <= 5; gridW++) {
      generateBin(buildParams({ gridW, gridD: 1 }));
    }

    const beforeClear = getDisposalStats();
    expect(beforeClear.liveHandles).toBeGreaterThan(0);

    clearAllCaches();

    const afterClear = getDisposalStats();
    // Caches should have freed handles on disposal
    expect(afterClear.liveHandles).toBeLessThan(beforeClear.liveHandles);
    expect(afterClear.gcCollected).toBe(0);
  }, 120_000);

  it('cache eviction disposes shapes without GC', () => {
    const generateBin = getGenerateBin();

    // Generate with 7 different shell keys to exceed LRU(5) and trigger evictions
    for (let gridW = 1; gridW <= 7; gridW++) {
      generateBin(buildParams({ gridW, gridD: 1 }));
    }

    const stats = getDisposalStats();
    // Evicted shapes should have been explicitly disposed, not GC'd
    expect(stats.gcCollected).toBe(0);
  }, 120_000);

  it.skipIf(!(globalThis as { gc?: () => void }).gc)(
    'diagnostic: baseline leaks on 1x10 without features',
    async () => {
      const generateBin = getGenerateBin();
      const plainParams = (depth: number) => buildParams({ gridW: 1, gridD: depth });
      const gcFn = (globalThis as { gc: () => void }).gc;

      const drainGc = async () => {
        gcFn();
        await new Promise((resolve) => setImmediate(resolve));
        gcFn();
        await new Promise((resolve) => setImmediate(resolve));
      };

      // Warm up the first generation to settle any one-time module init
      // costs (static shape templates, WASM kernel bootstrap).
      generateBin(plainParams(2));
      await drainGc();
      const warmed = getDisposalStats().gcCollected;

      // Force cache evictions by generating 30+ unique grid sizes
      // (socketCache + boxCache + lipCache + shellCache all size 15-20).
      // Each grid size is a fresh cache entry; once capacity is exceeded,
      // LRU evictions trigger disposeShape which calls .delete() on the
      // cached shape. Any LEAK path in the builder allocates extra handles
      // that don't land in the cache and thus don't get .delete()'d — they
      // fall through to the FinalizationRegistry.
      for (let w = 1; w <= 5; w++) {
        for (let d = 3; d <= 10; d++) {
          generateBin(buildParams({ gridW: w, gridD: d }));
        }
      }
      await drainGc();
      const afterChurn = getDisposalStats().gcCollected;

      process.stderr.write(
        `[diag] cache churn (40 unique sizes): warmed=${warmed} afterChurn=${afterChurn} delta=${afterChurn - warmed}\n`
      );
      expect(afterChurn - warmed).toBe(0);
    },
    180_000
  );

  it.skipIf(!(globalThis as { gc?: () => void }).gc)(
    'diagnostic: feature matrix — no leaks across individual features',
    async () => {
      const generateBin = getGenerateBin();
      const gcFn = (globalThis as { gc: () => void }).gc;
      const drainGc = async () => {
        gcFn();
        await new Promise((resolve) => setImmediate(resolve));
        gcFn();
        await new Promise((resolve) => setImmediate(resolve));
      };

      // Baseline — warm everything once
      generateBin(buildParams({ gridW: 2, gridD: 2 }));
      await drainGc();
      const base = getDisposalStats().gcCollected;

      // Each feature is probed independently by churning the cache on
      // unique grid sizes with just that feature enabled. Any per-regen
      // leak in the feature's builder accumulates past the cache LRU
      // capacity (15-20) and shows as delta > 0.

      const churn = async (
        name: string,
        paramsFor: (w: number, d: number) => Parameters<typeof buildParams>[0]
      ): Promise<{ name: string; delta: number }> => {
        const start = getDisposalStats().gcCollected;
        for (let w = 1; w <= 5; w++) {
          for (let d = 3; d <= 9; d++) {
            generateBin(buildParams(paramsFor(w, d)));
          }
        }
        await drainGc();
        const end = getDisposalStats().gcCollected;
        return { name, delta: end - start };
      };

      const results: Array<{ name: string; delta: number }> = [];

      results.push(
        await churn('wall cutouts', (w, d) => ({
          gridW: w,
          gridD: d,
          walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true, width: 70, depth: 50 },
        }))
      );

      results.push(
        await churn('handles', (w, d) => ({
          gridW: w,
          gridD: d,
          handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
        }))
      );

      results.push(
        await churn('scoops', (w, d) => ({
          gridW: w,
          gridD: d,
          scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
        }))
      );

      results.push(
        await churn('label tabs', (w, d) => ({
          gridW: w,
          gridD: d,
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        }))
      );

      results.push(
        await churn('compartments 2x2', (w, d) => ({
          gridW: w,
          gridD: d,
          compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
        }))
      );

      results.push(
        await churn('wall pattern', (w, d) => ({
          gridW: w,
          gridD: d,
          wallPattern: { enabled: true, pattern: 'honeycomb' },
        }))
      );

      // Combined path: walls + compartments activates buildDividerBlends,
      // which is not exercised by any single-feature probe above.
      results.push(
        await churn('wall cutouts + compartments', (w, d) => ({
          gridW: w,
          gridD: d,
          walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true, width: 70, depth: 50 },
          compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
        }))
      );

      process.stderr.write(`[diag] feature matrix (base=${base}):\n`);
      for (const r of results) {
        process.stderr.write(`  ${r.name.padEnd(20)} delta=${r.delta}\n`);
      }

      // Per-feature regression budgets. Residual deltas come from brepjs's
      // internal per-shape topology cache (faces/edges arrays attached to
      // each shape via getOrCreateCache) — those handles are reclaimed only
      // when the parent shape is GC'd, so they always show up in
      // gcCollected even with perfect explicit disposal in our builders.
      // The numbers below cap each feature's leakage at its current
      // post-fix baseline + 50% headroom; a regression past these values
      // means a builder started leaking top-level intermediates again.
      const budgets: Record<string, number> = {
        'wall cutouts': 30,
        handles: 50,
        scoops: 150,
        'label tabs': 60,
        'compartments 2x2': 10,
        'wall pattern': 20,
        'wall cutouts + compartments': 60,
      };
      for (const r of results) {
        const budget = budgets[r.name];
        expect(
          r.delta,
          `${r.name}: delta ${r.delta} exceeds regression budget ${budget}`
        ).toBeLessThanOrEqual(budget);
      }
    },
    600_000
  );

  it.skipIf(!(globalThis as { gc?: () => void }).gc)(
    'diagnostic: no handles reach FinalizationRegistry on 1x10 + wall cutouts',
    async () => {
      const generateBin = getGenerateBin();

      const paramsWithCutouts = (depth: number) =>
        buildParams({
          gridW: 1,
          gridD: depth,
          walls: {
            ...DEFAULT_BIN_PARAMS.walls,
            enabled: true,
            width: 70,
            depth: 50,
          },
        });

      const gcFn = (globalThis as { gc: () => void }).gc;
      const drainGc = async () => {
        gcFn();
        await new Promise((resolve) => setImmediate(resolve));
        gcFn();
        await new Promise((resolve) => setImmediate(resolve));
      };

      // Warm up first generation (one-time init)
      generateBin(paramsWithCutouts(2));
      await drainGc();
      const warmed = getDisposalStats().gcCollected;

      // Force cache evictions with many unique sizes
      for (let w = 1; w <= 5; w++) {
        for (let d = 3; d <= 10; d++) {
          generateBin(paramsWithCutouts(d));
          if (w % 2 === 0) generateBin(buildParams({ gridW: w, gridD: d }));
        }
      }
      await drainGc();
      const afterChurn = getDisposalStats().gcCollected;

      process.stderr.write(
        `[diag] wall cutouts churn: warmed=${warmed} afterChurn=${afterChurn} delta=${afterChurn - warmed}\n`
      );
      // Any per-regeneration leak in wallCutoutBuilder (or other builders
      // invoked via the feature pipeline) shows up here as delta > 0.
      expect(afterChurn - warmed).toBe(0);
    },
    300_000
  );

  it('long 1x10 bin with wall cutouts stays bounded across regenerations', () => {
    const generateBin = getGenerateBin();

    // Long 1×10 bin with wall cutouts — the reported repro for
    // `RuntimeError: memory access out of bounds` in production. Large
    // long-side walls produce the largest OCCT tessellations, so any
    // per-regeneration leak in buildWallCutoutCuts consumes WASM memory
    // fastest on this shape. Before the fix, each regeneration leaked the
    // extrude/translate/rotate intermediates inside `buildSingleCutout`
    // plus the `fuseAll` result inside `buildWallCutoutCuts`, relying on
    // the FinalizationRegistry GC safety net that may not run under WASM
    // memory pressure.
    const paramsWithCutouts = (depth: number) =>
      buildParams({
        gridW: 1,
        gridD: depth,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          width: 70,
          depth: 50,
        },
      });

    // Warm caches with a few regenerations, measure baseline.
    for (let i = 0; i < 3; i++) generateBin(paramsWithCutouts(10));
    const baseline = getDisposalStats();

    // Churn the wall cutout cache by varying the depth so
    // buildWallCutoutCuts re-executes each iteration.
    for (let i = 0; i < 15; i++) {
      generateBin(paramsWithCutouts(3 + (i % 8)));
    }

    const after = getDisposalStats();

    // liveHandles should plateau — the LRU feature caches bound growth and
    // every fresh wall cutout regeneration disposes its intermediates via
    // the DisposalScope added to buildWallCutoutCuts.
    expect(after.liveHandles).toBeLessThan(baseline.liveHandles * 2 + 100);
  }, 180_000);

  it('pipeline intermediates are explicitly disposed', () => {
    const generateBin = getGenerateBin();

    // Generate a bin with features (lip, magnet holes) to exercise full pipeline
    generateBin(
      buildParams({
        gridW: 2,
        gridD: 2,
        base: {
          ...DEFAULT_BIN_PARAMS.base,
          style: 'standard',
          magnetDiameter: 6.2,
          magnetDepth: 2.0,
          screwDiameter: 3.0,
        },
      })
    );

    const stats = getDisposalStats();
    // All intermediate shapes should have been explicitly disposed via
    // DisposalScope (builders) and manual .delete() (pipeline stages).
    // Nothing should have fallen through to the FinalizationRegistry.
    expect(stats.gcCollected).toBe(0);
  }, 60_000);
});
