// @vitest-environment node
/**
 * Per-text glyph-solid cache behavior, exercised through the real `buildTextSolid`
 * path (brepjs WASM + a loaded font). The two properties that matter:
 *  1. The cache key ignores placement, so the same text in different positions
 *     reuses one canonical solid.
 *  2. Cached entries are independent of the DisposalScope that built them — a hit
 *     after the building scope has closed must still mesh to valid geometry
 *     (the bug this guards against is caching a scope-registered handle, which
 *     would be `.delete()`-ed at scope exit and dangle).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadFont, isErr, withScope, mesh } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import { buildTextSolid } from './textBuilder';
import type { BuildTextSolidOptions } from './textBuilder';
import { getTextSolidCacheStats, clearTextSolidCache } from './textSolidCache';

const MESH_OPTS = { tolerance: 0.5, angularTolerance: 15 };

const baseOptions: BuildTextSolidOptions = {
  text: 'M8',
  fontFamily: 'atkinson',
  mode: 'engrave',
  availW: 30,
  availD: 12,
  centerX: 15,
  centerY: -6,
  topZ: 5,
  depth: 0.8,
  hostThickness: 1.2,
  margin: 1,
  minFontSize: 3,
  maxFontSize: 20,
};

beforeAll(async () => {
  const { initBrepjs } = await import('./__kernel-tests__/wasmInit');
  await initBrepjs();
  const buffer = readFileSync(
    resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf')
  );
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 60_000);

beforeEach(() => {
  clearTextSolidCache();
});

/** Build a text solid in a fresh scope and return its mesh vertex count (0 if
 *  the build returned null). The scope disposes everything it registered before
 *  returning, so anything still valid afterward must live in the cache. */
function meshTextSolid(overrides: Partial<BuildTextSolidOptions> = {}): number {
  return withScope((scope: DisposalScope): number => {
    const built = buildTextSolid(scope, { ...baseOptions, ...overrides });
    if (!built) return 0;
    return mesh(built.solid, MESH_OPTS).vertices.length;
  });
}

describe('textSolidCache', () => {
  it('builds a non-empty solid and records a miss + one entry', () => {
    const verts = meshTextSolid();
    expect(verts).toBeGreaterThan(0);
    const stats = getTextSolidCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('serves a cache hit for identical text and meshes to the same geometry', () => {
    const first = meshTextSolid();
    const second = meshTextSolid();
    expect(second).toBe(first);
    const stats = getTextSolidCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('reuses the cached solid across placements (key ignores center/topZ)', () => {
    // The first scope builds and disposes its registered clone; the cache's
    // independent clone must survive for the second (differently placed) build.
    const first = meshTextSolid();
    const second = meshTextSolid({ centerX: 20, centerY: -4, topZ: 9 });
    expect(first).toBeGreaterThan(0);
    // Placement is a rigid translate, so the vertex count is unchanged.
    expect(second).toBe(first);
    expect(getTextSolidCacheStats().hits).toBe(1);
  });

  it('treats different text as a distinct entry', () => {
    meshTextSolid({ text: 'M8' });
    meshTextSolid({ text: 'M4' });
    const stats = getTextSolidCacheStats();
    expect(stats.misses).toBe(2);
    expect(stats.size).toBe(2);
  });

  it('clearTextSolidCache empties the cache and resets stats', () => {
    meshTextSolid();
    clearTextSolidCache();
    const stats = getTextSolidCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });
});
