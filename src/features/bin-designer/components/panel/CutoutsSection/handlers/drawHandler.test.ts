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

  // A knife slot is not sized by the drag; its blade measurements fix the box
  // (chef 8" default: 205+10 = 215 long, 2.3+1.5 = 3.8 thick) and the drag only
  // aims it. The box is centred on the press point and stays unclamped.
  it('sizes a dragged knife slot from the blade and aims it right on a +X flick', () => {
    const setters = makeSetters();
    handleDrawMove(makeMode('knifeSlot', 50, 50), { mmX: 70, mmY: 52 }, PLAIN, noopSnap, setters);
    expect(setters.setDrawingPreview).toHaveBeenCalledWith({
      x: 50 - 215 / 2,
      y: 50 - 3.8 / 2,
      width: 215,
      depth: 3.8,
      shape: 'knifeSlot',
      rotation: 0,
    });
  });

  it('maps flick direction to the wall-aligned exit', () => {
    const rotationFor = (mmX: number, mmY: number): number => {
      const setters = makeSetters();
      handleDrawMove(makeMode('knifeSlot', 50, 50), { mmX, mmY }, PLAIN, noopSnap, setters);
      return setters.setDrawingPreview.mock.calls[0][0].rotation;
    };
    expect(rotationFor(80, 51)).toBe(0); // right
    expect(rotationFor(20, 51)).toBe(180); // left
    expect(rotationFor(51, 20)).toBe(90); // front (−Y)
    expect(rotationFor(51, 80)).toBe(270); // back (+Y)
  });
});
