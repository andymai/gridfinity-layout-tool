// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type * as CollectOriginsModule from './collectOrigins';
import type * as ShapeCacheModule from '../shapeCache';
import { FeatureTag } from '../featureTags';

type BoxFn = (xLen: number, yLen: number, zLen: number) => Shape3D;
type GetFaceOriginsFn = (shape: Shape3D) => ReadonlyMap<number, number> | undefined;
type FuseFn = (a: Shape3D, b: Shape3D) => unknown;
type TranslateFn = (shape: Shape3D, v: [number, number, number]) => Shape3D;
type MeasureVolumeFn = (shape: Shape3D) => number;

let collectOrigins: typeof CollectOriginsModule.collectOrigins;
let setShellCache: typeof ShapeCacheModule.setShellCache;
let getShellCache: typeof ShapeCacheModule.getShellCache;
let clearAllCaches: typeof ShapeCacheModule.clearAllCaches;
let box: BoxFn;
let getFaceOrigins: GetFaceOriginsFn;
let fuse: FuseFn;
let translate: TranslateFn;
let measureVolume: MeasureVolumeFn;
let unwrap: <T>(r: { value: T } | T) => T;

beforeAll(async () => {
  const brepjs = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  brepjs.initFromOC(OC);

  collectOrigins = (await import('./collectOrigins')).collectOrigins;
  const shapeCache = await import('../shapeCache');
  setShellCache = shapeCache.setShellCache;
  getShellCache = shapeCache.getShellCache;
  clearAllCaches = shapeCache.clearAllCaches;
  box = brepjs.box;
  getFaceOrigins = brepjs.getFaceOrigins;
  fuse = brepjs.fuse;
  translate = brepjs.translate;
  measureVolume = brepjs.measureVolume;
  unwrap = brepjs.unwrap as unknown as typeof unwrap;
}, 30000);

describe('collectOrigins', () => {
  it('tags every face of the shape with the provided FeatureTag', () => {
    const shape = box(10, 10, 10);
    collectOrigins(shape, FeatureTag.LIP, new Map());

    const origins = getFaceOrigins(shape);
    expect(origins).toBeDefined();
    expect(origins!.size).toBe(6); // a box has six faces
    for (const value of origins!.values()) {
      expect(value).toBe(FeatureTag.LIP);
    }
  });

  it('propagates origins through a boolean fuse', () => {
    // Two boxes tagged distinctly. After fuse, faces inherited from each
    // input must still report the input's tag — this is the invariant the
    // multi-color pipeline relies on.
    const base = box(20, 20, 10);
    const lipBase = box(20, 20, 4);
    const top = translate(lipBase, [0, 0, 10]);

    collectOrigins(base, FeatureTag.BASE, new Map());
    collectOrigins(top, FeatureTag.LIP, new Map());

    const fused = unwrap(fuse(base, top)) as Shape3D;
    const origins = getFaceOrigins(fused);
    expect(origins).toBeDefined();

    const tags = new Set(origins!.values());
    // Boolean fuse over BASE=0 yields origin=0 for those faces, which we
    // treat as untagged downstream — LIP must still be present.
    expect(tags.has(FeatureTag.LIP)).toBe(true);
  });
});

describe('shell cache preserves face origins', () => {
  // Pins the load-bearing invariant of the multi-color fix: `getShellCache`
  // returns a `translate([0,0,0])` clone (not a plain `clone()`) so origins
  // survive the cache hit. If brepjs changes `translate`'s metadata behavior
  // or someone "simplifies" the cache to use `clone()`, this catches it.
  it('survives a setShellCache/getShellCache round-trip', () => {
    clearAllCaches();

    const base = box(20, 20, 10);
    const lipBase = box(20, 20, 4);
    const top = translate(lipBase, [0, 0, 10]);
    collectOrigins(base, FeatureTag.BASE, new Map());
    collectOrigins(top, FeatureTag.LIP, new Map());
    const fused = unwrap(fuse(base, top)) as Shape3D;

    setShellCache('test-shell-key', fused);
    const retrieved = getShellCache('test-shell-key');
    expect(retrieved).not.toBeNull();

    const origins = getFaceOrigins(retrieved!);
    expect(origins).toBeDefined();
    const tags = new Set(origins!.values());
    expect(tags.has(FeatureTag.LIP)).toBe(true);
  });

  it('translate([0,0,0]) preserves the source volume', () => {
    // Pins the geometric equivalence of the clone-replacement: the
    // `flat base no lip` scenario re-tessellated to fewer triangles after
    // the switch (252 → 204). Volume parity confirms that's a meshing
    // change, not a topology regression.
    const source = box(42, 42, 21);
    const copy = translate(source, [0, 0, 0]);
    expect(unwrap(measureVolume(copy))).toBeCloseTo(unwrap(measureVolume(source)), 3);
  });
});
