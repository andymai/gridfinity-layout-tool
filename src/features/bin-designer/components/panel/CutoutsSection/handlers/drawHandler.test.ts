import { describe, it, expect, vi } from 'vitest';
import { handleDrawMove } from './drawHandler';
import type { InteractionMode } from '../useCutoutInteraction';
import type { BinBounds, PreviewSetters } from './types';

type DrawingMode = Extract<InteractionMode, { type: 'drawing' }>;

const noopSnap = (n: number): number => n;

const makeMode = (shape: DrawingMode['shape'], x: number, y: number): DrawingMode => ({
  type: 'drawing',
  shape,
  startMmX: x,
  startMmY: y,
});

function makeSetters() {
  const setDrawingPreview = vi.fn();
  return { setDrawingPreview } as unknown as Pick<PreviewSetters, 'setDrawingPreview'> & {
    setDrawingPreview: ReturnType<typeof vi.fn>;
  };
}

const PLAIN: BinBounds = { binWidth: 100, binDepth: 100 };

// 2×2 mask with the top-right cell empty — the notch is x ≥ 50, y ≥ 50.
const L_MASK: BinBounds = {
  binWidth: 100,
  binDepth: 100,
  cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
  maskCellSize: { cellMmX: 50, cellMmY: 50 },
};

describe('handleDrawMove', () => {
  it('emits a corner-to-corner preview on an unmasked bin', () => {
    const setters = makeSetters();
    handleDrawMove(makeMode('rectangle', 10, 10), { mmX: 40, mmY: 30 }, PLAIN, noopSnap, setters);
    expect(setters.setDrawingPreview).toHaveBeenCalledWith({
      x: 10,
      y: 10,
      width: 30,
      depth: 20,
      shape: 'rectangle',
    });
  });

  it('rejects a rectangle preview that straddles the notch', () => {
    const setters = makeSetters();
    handleDrawMove(makeMode('rectangle', 40, 40), { mmX: 70, mmY: 70 }, L_MASK, noopSnap, setters);
    expect(setters.setDrawingPreview).not.toHaveBeenCalled();
  });

  it('accepts a circle whose bounding box overhangs the notch but whose disc does not', () => {
    // Drawn 24→44 on both axes: the box crosses the (50, 50) notch corner…
    const setters = makeSetters();
    handleDrawMove(makeMode('circle', 24, 24), { mmX: 44, mmY: 44 }, L_MASK, noopSnap, setters);
    expect(setters.setDrawingPreview).toHaveBeenCalledTimes(1);
  });

  it('still rejects a circle that genuinely reaches into the notch', () => {
    const setters = makeSetters();
    handleDrawMove(makeMode('circle', 20, 20), { mmX: 60, mmY: 60 }, L_MASK, noopSnap, setters);
    expect(setters.setDrawingPreview).not.toHaveBeenCalled();
  });
});
