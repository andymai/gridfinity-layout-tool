// @vitest-environment node
/**
 * Resume-cache correctness for kumiko and divider pattern bins.
 *
 * `booleanStage` skips the whole boolean when a design's resume key is
 * unchanged, so the key must (a) let an identical regen resume without changing
 * geometry, and (b) never collide across designs whose cut set differs — a
 * collision would serve a stale body, the one failure that surfaces as wrong
 * geometry rather than a slow rebuild. This guards both for the kumiko and
 * divider identity keys.
 *
 * Manual (real WASM, not a CI gate):
 *   pnpm exec vitest run --config vitest.profile.config.ts resumeCacheCorrectness
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { clearAllCaches } from '../shapeCache';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/** Cheap but collision-resistant geometry fingerprint. */
function fingerprint(m: MeshData): string {
  const v = m.vertices;
  let cs = 0;
  for (let i = 0; i < v.length; i++) cs = (cs * 31 + Math.round(v[i] * 1000)) | 0;
  return `${m.triangleCount}|${v.length}|${m.indices.length}|${cs}`;
}

interface Case {
  name: string;
  base: BinParams;
  variants: { name: string; params: BinParams }[];
}

const CASES: Case[] = [
  {
    name: 'kumiko-mitsukude',
    base: buildParams({
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
    }),
    variants: [
      {
        name: 'scale',
        params: buildParams({
          width: 2,
          depth: 2,
          height: 5,
          wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.7 },
        }),
      },
      {
        name: 'height',
        params: buildParams({
          width: 2,
          depth: 2,
          height: 6,
          wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
        }),
      },
    ],
  },
  {
    name: 'divider-honeycomb',
    base: buildParams({
      width: 3,
      depth: 2,
      height: 6,
      compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
    }),
    variants: [
      {
        name: 'grid',
        params: buildParams({
          width: 3,
          depth: 2,
          height: 6,
          compartments: { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] },
          wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
        }),
      },
      {
        name: 'thickness',
        params: buildParams({
          width: 3,
          depth: 2,
          height: 6,
          compartments: { cols: 2, rows: 1, thickness: 1.6, cells: [0, 1] },
          wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
        }),
      },
    ],
  },
];

describe('resume cache correctness (kumiko + dividers)', () => {
  for (const c of CASES) {
    it(
      c.name,
      () => {
        const gen = getGenerateBin();

        clearAllCaches();
        const t0 = performance.now();
        const cold = fingerprint(gen(c.base));
        const coldMs = performance.now() - t0;

        // Identical regen: the resume path must return the same geometry and
        // must be much faster (proves it skipped the boolean, i.e. the key is
        // non-null and hit).
        const t1 = performance.now();
        const warm = fingerprint(gen(c.base));
        const warmMs = performance.now() - t1;
        expect(warm).toBe(cold);
        expect(warmMs).toBeLessThan(coldMs * 0.7);

        for (const v of c.variants) {
          clearAllCaches();
          const coldVariant = fingerprint(gen(v.params));
          // The variant is genuinely different geometry.
          expect(coldVariant).not.toBe(cold);

          // Warm the BASE body into the resume cache, then build the variant.
          // A collision would resume the base and yield `cold`; a correct key
          // rebuilds the variant's own geometry.
          clearAllCaches();
          gen(c.base);
          const afterBase = fingerprint(gen(v.params));
          expect(afterBase).toBe(coldVariant);
        }
      },
      300_000
    );
  }
});
