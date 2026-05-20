import { describe, it, expect, vi } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { handleDragMove } from './dragHandler';
import { getRotatedBounds } from '../geometry';
import type { InteractionMode } from '../useCutoutInteraction';
import type { BinBounds, PointerMoveEvent, PreviewSetters, DeadZoneRef } from './types';

type DraggingMode = Extract<InteractionMode, { type: 'dragging' }>;

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c-1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function makeMode(
  startX: number,
  startY: number,
  offsets: Array<[string, number, number]>
): DraggingMode {
  return {
    type: 'dragging',
    startX,
    startY,
    offsets: new Map(offsets.map(([id, dx, dy]) => [id, { dx, dy }])),
  };
}

const noopSnap = (n: number): number => n;
const NO_DEAD_ZONE: DeadZoneRef = { current: true };

function makeSetters() {
  let preview: Map<string, Partial<Cutout>> | null = null;
  const setPreview = vi.fn((map: Map<string, Partial<Cutout>>) => {
    preview = map;
  });
  return {
    setPreview,
    setActiveGuides: vi.fn(),
    get preview() {
      return preview;
    },
  };
}

describe('handleDragMove rotation-aware clamping', () => {
  it('clamps a rotated cutout by its rotated AABB, not its unrotated width', () => {
    // 20×20 square rotated 45° has a rotated AABB of ≈28.28×28.28; the
    // unrotated-width clamp would let x reach binWidth - 20 = 80, where the
    // rotated corner extends to 80 + 24.14 = 104.14, well past the bin.
    const cutout = makeCutout({ x: 10, y: 10, width: 20, depth: 20, rotation: 45 });
    const rb = getRotatedBounds(cutout);
    const overhangX = (rb.maxX - rb.minX - cutout.width) / 2;
    expect(overhangX).toBeGreaterThan(0);

    const bounds: BinBounds = {
      binWidth: 100,
      binDepth: 100,
      cellMask: undefined,
      maskCellSize: undefined,
    };
    // Drag far past the right edge — pre-fix, x clamped to 80; post-fix to 80 - overhangX.
    const mode = makeMode(10, 10, [['c-1', 0, 0]]);
    const event: PointerMoveEvent = { mmX: 500, mmY: 10, shiftKey: false, altKey: false };
    const setters = makeSetters();

    handleDragMove(
      mode,
      event,
      [cutout],
      bounds,
      noopSnap,
      NO_DEAD_ZONE,
      setters as unknown as PreviewSetters
    );

    const patch = setters.preview?.get('c-1');
    expect(patch).toBeDefined();
    const x = patch!.x as number;
    // Rotated AABB right edge must stay within the bin
    expect(x + cutout.width + overhangX).toBeLessThanOrEqual(bounds.binWidth + 1e-9);
  });

  it('unrotated cutouts still clamp to the full bin width', () => {
    const cutout = makeCutout({ x: 0, y: 0, width: 30, depth: 30, rotation: 0 });
    const bounds: BinBounds = {
      binWidth: 50,
      binDepth: 50,
      cellMask: undefined,
      maskCellSize: undefined,
    };
    const mode = makeMode(0, 0, [['c-1', 0, 0]]);
    const event: PointerMoveEvent = { mmX: 200, mmY: 0, shiftKey: false, altKey: false };
    const setters = makeSetters();

    handleDragMove(
      mode,
      event,
      [cutout],
      bounds,
      noopSnap,
      NO_DEAD_ZONE,
      setters as unknown as PreviewSetters
    );

    const patch = setters.preview?.get('c-1');
    expect(patch?.x).toBe(bounds.binWidth - cutout.width);
  });
});
