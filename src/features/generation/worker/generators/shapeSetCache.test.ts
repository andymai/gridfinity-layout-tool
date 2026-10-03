// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Shape3D } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { getShapeSetCache, setShapeSetCache, clearAllCaches } from './shapeCache';

let box: (w: number, d: number, h: number) => Shape3D;

beforeAll(async () => {
  await initBrepjs();
  box = (await import('brepjs')).box;
}, 60_000);

beforeEach(() => {
  clearAllCaches();
});

const boxes = (n: number): Shape3D[] =>
  Array.from({ length: n }, (_, i) => box(1 + i * 0.01, 1, 1));
const disposed = (s: Shape3D): boolean => (s as unknown as { disposed: boolean }).disposed;

describe('shape-set cache', () => {
  it('returns fresh clones and keeps the cached set', () => {
    const set = boxes(3);
    setShapeSetCache('t', 'k', set);
    const read = getShapeSetCache('t', 'k');
    expect(read).toHaveLength(3);
    read?.forEach((clone, i) => {
      expect(clone).not.toBe(set[i]);
      clone.delete();
    });
    expect(set.some(disposed)).toBe(false);
    const again = getShapeSetCache('t', 'k');
    expect(again).toHaveLength(3);
    again?.forEach((s) => s.delete());
  });

  it('disposes a set when its key is replaced', () => {
    const first = boxes(2);
    setShapeSetCache('t', 'k', first);
    setShapeSetCache('t', 'k', boxes(2));
    expect(first.every(disposed)).toBe(true);
  });

  it('evicts whole sets once the shape budget is spent', () => {
    const old = boxes(200);
    const recent = boxes(100);
    setShapeSetCache('t', 'old', old);
    setShapeSetCache('t', 'recent', recent);
    expect(old.every(disposed)).toBe(true);
    expect(recent.some(disposed)).toBe(false);
    expect(getShapeSetCache('t', 'old')).toBeNull();
  });

  it('disposes every cached set on clearAllCaches', () => {
    const a = boxes(2);
    const b = boxes(3);
    setShapeSetCache('t', 'a', a);
    setShapeSetCache('u', 'b', b);
    clearAllCaches();
    expect([...a, ...b].every(disposed)).toBe(true);
    expect(getShapeSetCache('t', 'a')).toBeNull();
  });
});
