// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type * as CollectOriginsModule from './collectOrigins';
import { FeatureTag } from '../featureTags';

type BoxFn = (xLen: number, yLen: number, zLen: number) => Shape3D;
type GetFaceOriginsFn = (shape: Shape3D) => ReadonlyMap<number, number> | undefined;
type FuseFn = (a: Shape3D, b: Shape3D) => unknown;
type TranslateFn = (shape: Shape3D, v: [number, number, number]) => Shape3D;

let collectOrigins: typeof CollectOriginsModule.collectOrigins;
let box: BoxFn;
let getFaceOrigins: GetFaceOriginsFn;
let fuse: FuseFn;
let translate: TranslateFn;
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
  box = brepjs.box;
  getFaceOrigins = brepjs.getFaceOrigins;
  fuse = brepjs.fuse;
  translate = brepjs.translate;
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
