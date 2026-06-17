// @vitest-environment node
/**
 * Draft-preview behavior for baseplate generation.
 *
 * The live preview builds at draft quality (`draft=true`), which skips the
 * underside lightweight floor cutters — invisible when orbiting from above and
 * ~⅓ of build time on magnet grids. The full build (`draft=false`, used by the
 * scenario/winding suites and export) keeps them. These tests pin that contract:
 * draft removes geometry on magnet plates and is a no-op without magnets.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { clearBaseplateCaches } from './baseplateCaches';

const noop = (): void => {};

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 4,
  depth: 4,
  gridUnitMm: 42,
  magnetHoles: true,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  ...overrides,
});

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('generateBaseplate draft preview', () => {
  it('draft skips lightweight floor cuts on magnet plates (fewer triangles)', () => {
    const gen = getGenerateBaseplate();
    clearBaseplateCaches();
    const full = gen(defaults(), noop, false, undefined, false);
    clearBaseplateCaches();
    const draft = gen(defaults(), noop, false, undefined, true);

    expect(full.triangleCount).toBeGreaterThan(0);
    expect(draft.triangleCount).toBeGreaterThan(0);
    // Lightweight cross cutters add interior faces; dropping them lowers the count.
    expect(draft.triangleCount).toBeLessThan(full.triangleCount);
  });

  it('draft is geometrically identical to full when magnets are off', () => {
    const gen = getGenerateBaseplate();
    const p = defaults({ magnetHoles: false });
    clearBaseplateCaches();
    const full = gen(p, noop, false, undefined, false);
    clearBaseplateCaches();
    const draft = gen(p, noop, false, undefined, true);

    // No magnets ⇒ no lightweight floor cut to skip ⇒ same tessellation.
    expect(draft.triangleCount).toBe(full.triangleCount);
  });
});
