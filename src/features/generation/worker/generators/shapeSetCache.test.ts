import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Shape3D } from 'brepjs';
import type * as Brepjs from 'brepjs';

type MockShape = Shape3D & { delete: ReturnType<typeof vi.fn>; source?: MockShape };

vi.mock('brepjs', async (importOriginal) => ({
  ...(await importOriginal<typeof Brepjs>()),
  clone: (shape: MockShape) => ({ ok: true, value: { delete: vi.fn(), source: shape } }),
}));

const { getShapeSetCache, setShapeSetCache, clearAllCaches } = await import('./shapeCache');

function mockShape(): MockShape {
  return { delete: vi.fn() } as unknown as MockShape;
}

function mockSet(n: number): MockShape[] {
  return Array.from({ length: n }, mockShape);
}

describe('shape-set cache', () => {
  beforeEach(() => {
    clearAllCaches();
  });

  it('returns fresh clones and keeps the cached set', () => {
    const set = mockSet(3);
    setShapeSetCache('t', 'k', set);
    const read = getShapeSetCache('t', 'k') as MockShape[];
    expect(read).toHaveLength(3);
    read.forEach((clone, i) => {
      expect(clone).not.toBe(set[i]);
      expect(clone.source).toBe(set[i]);
      clone.delete();
    });
    expect(set.every((s) => s.delete.mock.calls.length === 0)).toBe(true);
    expect(getShapeSetCache('t', 'k')).toHaveLength(3);
  });

  it('disposes a set when its key is replaced', () => {
    const first = mockSet(2);
    setShapeSetCache('t', 'k', first);
    setShapeSetCache('t', 'k', mockSet(2));
    expect(first.every((s) => s.delete.mock.calls.length === 1)).toBe(true);
  });

  it('evicts whole sets once the shape budget is spent', () => {
    const old = mockSet(200);
    const recent = mockSet(100);
    setShapeSetCache('t', 'old', old);
    setShapeSetCache('t', 'recent', recent);
    expect(old.every((s) => s.delete.mock.calls.length === 1)).toBe(true);
    expect(recent.every((s) => s.delete.mock.calls.length === 0)).toBe(true);
    expect(getShapeSetCache('t', 'old')).toBeNull();
  });

  it('disposes every cached set on clearAllCaches', () => {
    const a = mockSet(2);
    const b = mockSet(3);
    setShapeSetCache('t', 'a', a);
    setShapeSetCache('u', 'b', b);
    clearAllCaches();
    expect([...a, ...b].every((s) => s.delete.mock.calls.length === 1)).toBe(true);
    expect(getShapeSetCache('t', 'a')).toBeNull();
  });
});
