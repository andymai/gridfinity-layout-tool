import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import type { CutoutDepthFrame } from '@/shared/utils/cutoutDepth';
import { placeLeanOpenings } from './leanOpening';

const FRAME: CutoutDepthFrame = { fillDepthMm: 30, baseMm: 0 };

const rect = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'r',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 20,
  cutDepth: 30,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  leanDeg: 60,
  ...overrides,
});

const minX = (ring: readonly { x: number }[]): number => Math.min(...ring.map((p) => p.x));

describe('placeLeanOpenings', () => {
  it('has nothing to draw for upright pockets', () => {
    expect(placeLeanOpenings([rect({ leanDeg: undefined })], new Map(), FRAME)).toEqual([]);
  });

  it('follows a live drag and skips hidden pockets', () => {
    const moving = rect({ id: 'm' });
    const hidden = rect({ id: 'h', hidden: true });
    const placed = placeLeanOpenings([moving, hidden], new Map([['m', { x: 50 }]]), FRAME);
    expect(placed).toHaveLength(1);
    expect(minX(placed[0].ring)).toBeCloseTo(50, 6);
  });

  it('draws one opening per repeat copy', () => {
    const repeated = rect({
      array: {
        mode: 'grid',
        cols: 3,
        rows: 1,
        pitchX: 15,
        pitchY: 15,
        count: 3,
        radius: 20,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    expect(placeLeanOpenings([repeated], new Map(), FRAME)).toHaveLength(3);
  });

  it('shows no hole for an intersect group whose members never meet', () => {
    const a = rect({ id: 'a', groupId: 'g', groupOp: 'intersect' });
    const b = rect({ id: 'b', x: 60, groupId: 'g', groupOp: 'intersect' });
    expect(placeLeanOpenings([a, b], new Map(), FRAME)).toEqual([]);
  });

  it('shows one hole for a union group that overlaps', () => {
    const a = rect({ id: 'a', groupId: 'g' });
    const b = rect({ id: 'b', x: 5, groupId: 'g', leanDeg: undefined });
    expect(placeLeanOpenings([a, b], new Map(), FRAME)).toHaveLength(1);
  });

  it('cuts no deeper than the fill', () => {
    const ring = (c: Cutout) => placeLeanOpenings([c], new Map(), FRAME)[0].ring;
    expect(ring(rect({ cutDepth: 200 }))).toEqual(ring(rect({ cutDepth: FRAME.fillDepthMm })));
  });
});
