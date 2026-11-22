import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { contentBounds } from './libraryContent';
import { thumbnailHost } from './thumbnailHost';

const rect = (width: number, depth: number, cutDepth = 5): Cutout => ({
  id: 'a',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width,
  depth,
  cutDepth,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
});

describe('thumbnailHost', () => {
  it('makes the smallest custom-cutouts bin that holds the item in its middle', () => {
    const host = thumbnailHost({ params: { cutouts: [rect(20, 10)] } });
    expect(host).toMatchObject({ style: 'solid', width: 1, depth: 1 });
    const { innerW, innerD } = cutoutInterior(host ?? (null as never));
    const box = contentBounds(host?.cutouts ?? []);
    expect(((box?.minX ?? 0) + (box?.maxX ?? 0)) / 2).toBeCloseTo(innerW / 2, 9);
    expect(((box?.minY ?? 0) + (box?.maxY ?? 0)) / 2).toBeCloseTo(innerD / 2, 9);
  });

  it('grows the bin for a wide or deep item', () => {
    const host = thumbnailHost({ params: { cutouts: [rect(120, 10, 40)] } });
    expect(host?.width).toBe(4);
    expect(host?.height).toBeGreaterThanOrEqual(8);
  });

  it('is null for an empty item', () => {
    expect(thumbnailHost({ params: { cutouts: [] } })).toBeNull();
  });
});
