// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D, Result } from 'brepjs';
import type * as CollectOriginsModule from './collectOrigins';
import { initTestKernel } from '@/test/initTestKernel';
import type * as ShapeCacheModule from '../shapeCache';
import { FeatureTag } from '../featureTags';

type BoxFn = (xLen: number, yLen: number, zLen: number) => Shape3D;
type GetFaceOriginsFn = (shape: Shape3D) => ReadonlyMap<number, number> | undefined;
type FuseFn = (a: Shape3D, b: Shape3D) => Result<Shape3D>;
type TranslateFn = (shape: Shape3D, v: [number, number, number]) => Shape3D;
type MeasureVolumeFn = (shape: Shape3D) => Result<number>;

let collectOrigins: typeof CollectOriginsModule.collectOrigins;
let setShellCache: typeof ShapeCacheModule.setShellCache;
let getShellCache: typeof ShapeCacheModule.getShellCache;
let clearAllCaches: typeof ShapeCacheModule.clearAllCaches;
let box: BoxFn;
let getFaceOrigins: GetFaceOriginsFn;
let fuse: FuseFn;
let translate: TranslateFn;
let measureVolume: MeasureVolumeFn;
let unwrap: <T, E>(result: Result<T, E>) => T;

beforeAll(async () => {
  const brepjs = await import('brepjs');
  await initTestKernel();

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
  unwrap = brepjs.unwrap;
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

    const fused = unwrap(fuse(base, top));
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
    const fused = unwrap(fuse(base, top));

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

describe('pruneStaleOrigins', () => {
  // A builder that tags its own faces hands the runner a propagated origin map,
  // and propagation keeps hashes of faces its internal booleans consumed. A
  // freed face's hash can be reused by a live bin face, which the stale entry
  // then overwrites on the next fuse. Only live faces may keep an entry.
  it('keeps exactly the live faces of a self-tagged label tab', async () => {
    const brepjs = await import('brepjs');
    const { loadTestFonts } = await import('@/test/loadTestFonts');
    const { DEFAULT_BIN_PARAMS } = await import('@/features/bin-designer/constants/defaults');
    const { buildLabelTabs } = await import('../labelTabBuilder');
    const { pruneStaleOrigins } = await import('./collectOrigins');
    await loadTestFonts();

    const built = buildLabelTabs(
      {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 1,
        height: 3,
        textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'emboss' },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, compartmentTexts: ['SCREWS'] },
      },
      80,
      38,
      18.4,
      1.2
    );
    expect(built).not.toBeNull();
    if (!built) return;
    const live = new Set(brepjs.getFaces(built).map((face) => brepjs.getHashCode(face)));
    const before = [...(getFaceOrigins(built)?.keys() ?? [])];
    expect(before.some((hash) => !live.has(hash))).toBe(true);

    pruneStaleOrigins(built);

    const after = getFaceOrigins(built);
    expect(new Set(after?.keys())).toEqual(live);
    expect(new Set(after?.values())).toEqual(new Set([FeatureTag.LABEL_TAB, FeatureTag.TEXT]));
    built.delete();
  });
});
