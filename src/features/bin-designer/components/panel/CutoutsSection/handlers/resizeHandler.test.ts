import { describe, it, expect, vi } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import type { ResizeHandle, StartRect } from '../geometry';
import { handleResizeMove } from './resizeHandler';
import type { InteractionMode } from '../useCutoutInteraction';
import type { BinBounds, PointerMoveEvent, PreviewSetters, DeadZoneRef } from './types';

type ResizingMode = Extract<InteractionMode, { type: 'resizing' }>;

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c-1',
    shape: 'rectangle',
    x: 0,
    y: 0,
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
  startRect: StartRect,
  handle: ResizeHandle = 'se',
  cutoutId = 'c-1'
): ResizingMode {
  return { type: 'resizing', cutoutId, handle, startRect };
}

const noopSnap = (n: number): number => n;

function makeSetters(): {
  setPreview: ReturnType<typeof vi.fn>;
  preview: Map<string, Partial<Cutout>> | null;
} {
  let preview: Map<string, Partial<Cutout>> | null = null;
  const setPreview = vi.fn((map: Map<string, Partial<Cutout>>) => {
    preview = map;
  });
  return {
    setPreview,
    get preview() {
      return preview;
    },
  };
}

const NO_DEAD_ZONE: DeadZoneRef = { current: true };

describe('handleResizeMove joint-constraint clamping', () => {
  it('keeps x + width within binWidth when snap rounds width past the bin edge', () => {
    // Drag the SE handle far past the bin's right edge. With independent
    // snap-then-clamp, snappedW could exceed binWidth and bypass the x
    // clamp; the joint constraint must cap width to (binWidth - x).
    const cutout = makeCutout({ x: 30, y: 30, width: 20, depth: 20 });
    const bounds: BinBounds = {
      binWidth: 50,
      binDepth: 50,
      cellMask: undefined,
      maskCellSize: undefined,
    };
    const mode = makeMode({ x: 30, y: 30, width: 20, depth: 20 }, 'se');
    const event: PointerMoveEvent = { mmX: 200, mmY: 200, shiftKey: false, altKey: false };
    const setters = makeSetters();

    handleResizeMove(
      mode,
      event,
      [cutout],
      bounds,
      noopSnap,
      NO_DEAD_ZONE,
      setters as unknown as PreviewSetters
    );

    expect(setters.setPreview).toHaveBeenCalled();
    const patch = setters.preview?.get('c-1');
    expect(patch).toBeDefined();
    const x = patch!.x as number;
    const w = patch!.width as number;
    const y = patch!.y as number;
    const d = patch!.depth as number;
    expect(x + w).toBeLessThanOrEqual(bounds.binWidth);
    expect(y + d).toBeLessThanOrEqual(bounds.binDepth);
  });

  it('does not allow width to fall below MIN_CUTOUT_SIZE even after joint clamping', () => {
    const cutout = makeCutout({ x: 49.9, y: 49.9, width: 0.1, depth: 0.1 });
    const bounds: BinBounds = {
      binWidth: 50,
      binDepth: 50,
      cellMask: undefined,
      maskCellSize: undefined,
    };
    const mode = makeMode({ x: 49.9, y: 49.9, width: 0.1, depth: 0.1 }, 'se');
    const event: PointerMoveEvent = { mmX: 49.95, mmY: 49.95, shiftKey: false, altKey: false };
    const setters = makeSetters();

    handleResizeMove(
      mode,
      event,
      [cutout],
      bounds,
      noopSnap,
      NO_DEAD_ZONE,
      setters as unknown as PreviewSetters
    );

    const patch = setters.preview?.get('c-1');
    if (patch) {
      // MIN_CUTOUT_SIZE is 1mm; clamping must not violate it.
      expect((patch.width as number) ?? 1).toBeGreaterThanOrEqual(1);
      expect((patch.depth as number) ?? 1).toBeGreaterThanOrEqual(1);
    }
  });
});
