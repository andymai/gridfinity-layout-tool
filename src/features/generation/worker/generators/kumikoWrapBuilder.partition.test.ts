import { describe, it, expect } from 'vitest';
import { partitionDisjoint, strokeFootprint, type FootprintBox } from './kumikoWrapBuilder';
import type { KumikoSegment } from './patterns';

function box(u0: number, u1: number, z0: number, z1: number): FootprintBox {
  return { u0, u1, z0, z1 };
}

function partitionIndices(boxes: readonly FootprintBox[]): number[][] {
  // `partitionDisjoint` reads only `box` and never touches the solid, so stand
  // in plain indices to keep this test off the WASM kernel.
  const tools = boxes.map((b, i) => ({ solid: i, box: b }));
  return partitionDisjoint(
    tools as unknown as Parameters<typeof partitionDisjoint>[0]
  ) as unknown as number[][];
}

describe('strokeFootprint', () => {
  it('boxes a horizontal segment as length+width by width', () => {
    const seg: KumikoSegment = { a: [0, 0], b: [10, 0] };
    const f = strokeFootprint(seg, 2);
    // Stroke rect is (10 + 2) long and 2 tall, centred on (5, 0).
    expect(f.u0).toBeCloseTo(-1, 6);
    expect(f.u1).toBeCloseTo(11, 6);
    expect(f.z0).toBeCloseTo(-1, 6);
    expect(f.z1).toBeCloseTo(1, 6);
  });

  it('encloses a rotated segment on every side', () => {
    // A 45° thin rect: the box must contain the whole rotated rectangle, and
    // pinning all four bounds catches an asymmetric under-estimate that a
    // width-only check would let through. `partitionDisjoint` relies on the
    // enclosure being conservative, never tight.
    const diagonal: KumikoSegment = { a: [0, 0], b: [10, 10] };
    const f = strokeFootprint(diagonal, 2);
    // len = 10√2; stroke rect is (len + 2) x 2 at 45°, so each half-extent is
    // ((len + 2) + 2) / √2 / 2, about the midpoint (5, 5).
    const half = (10 * Math.SQRT2 + 4) / Math.SQRT2 / 2;
    expect(f.u0).toBeCloseTo(5 - half, 6);
    expect(f.u1).toBeCloseTo(5 + half, 6);
    expect(f.z0).toBeCloseTo(5 - half, 6);
    expect(f.z1).toBeCloseTo(5 + half, 6);
    // Conservative: strictly larger than the segment's own 10mm span.
    expect(f.u1 - f.u0).toBeGreaterThan(10);
  });

  it('honours a per-segment width override', () => {
    const seg: KumikoSegment = { a: [0, 0], b: [10, 0], width: 4 };
    expect(strokeFootprint(seg, 2).z1).toBeCloseTo(2, 6);
  });
});

describe('partitionDisjoint', () => {
  it('keeps mutually disjoint tools in a single bucket', () => {
    const boxes = [box(0, 1, 0, 1), box(2, 3, 0, 1), box(4, 5, 0, 1)];
    expect(partitionIndices(boxes)).toEqual([[0, 1, 2]]);
  });

  it('separates overlapping tools into different buckets', () => {
    const boxes = [box(0, 2, 0, 1), box(1, 3, 0, 1)];
    expect(partitionIndices(boxes)).toEqual([[0], [1]]);
  });

  it('every bucket it returns is pairwise disjoint', () => {
    // A chain where each piece overlaps only its neighbour — the shape a
    // lattice's filling pieces actually make.
    const boxes = Array.from({ length: 20 }, (_, i) => box(i, i + 1.5, 0, 1));
    const buckets = partitionIndices(boxes);
    for (const bucket of buckets) {
      for (const a of bucket) {
        for (const b of bucket) {
          if (a === b) continue;
          const overlap =
            boxes[a].u0 < boxes[b].u1 &&
            boxes[b].u0 < boxes[a].u1 &&
            boxes[a].z0 < boxes[b].z1 &&
            boxes[b].z0 < boxes[a].z1;
          expect(overlap).toBe(false);
        }
      }
    }
    // A chain of neighbour-overlaps needs exactly two colours, and greedy
    // first-fit finds them — over-splitting would cost more cutAll calls than
    // it saves in intersection work.
    expect(buckets).toHaveLength(2);
  });

  it('treats edge-touching boxes as disjoint', () => {
    expect(partitionIndices([box(0, 1, 0, 1), box(1, 2, 0, 1)])).toEqual([[0, 1]]);
  });

  it('returns no buckets for no tools', () => {
    expect(partitionIndices([])).toEqual([]);
  });
});
