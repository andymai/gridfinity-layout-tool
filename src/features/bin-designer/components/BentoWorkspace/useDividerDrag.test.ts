import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { snapShift, useDividerDrag } from './useDividerDrag';
import type { DividerDragHandlers } from './useDividerDrag';
import type { TiltRow } from '../CompartmentEditor/useDividerTiltSubsection';

function makeRow(axis: 'vertical' | 'horizontal', overrides: Partial<TiltRow> = {}): TiltRow {
  return {
    key: '0-1',
    compartmentA: 0,
    compartmentB: 1,
    axis,
    angleDeg: 0,
    shiftMm: 0,
    isModified: false,
    offsetStart: 0,
    offsetEnd: 0,
    geometry: { segmentLengthMm: 40, offsetMin: -20, offsetMax: 20 },
    ...overrides,
  } as unknown as TiltRow;
}

// 2 px per mm on both axes keeps the arithmetic obvious.
const SCALE = 2;

function mountDrag(previewTilt = vi.fn(), commitTilt = vi.fn(), cancelTilt = vi.fn()) {
  let handlers: DividerDragHandlers | null = null;

  function Harness() {
    handlers = useDividerDrag(SCALE, SCALE, previewTilt, commitTilt, cancelTilt);
    return createElement('div', {
      'data-testid': 'handle',
      onPointerDown: (e: React.PointerEvent) => handlers?.onDragStart(currentRow, e),
    });
  }

  let currentRow = makeRow('vertical');
  const utils = render(createElement(Harness));

  return {
    previewTilt,
    commitTilt,
    cancelTilt,
    unmount: utils.unmount,
    get draggingKey() {
      return handlers?.draggingKey ?? null;
    },
    start(row: TiltRow, clientX: number, clientY: number) {
      currentRow = row;
      fireEvent.pointerDown(utils.getByTestId('handle'), { clientX, clientY });
    },
    move(clientX: number, clientY: number, altKey = false) {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, altKey }));
      });
    },
    up(clientX: number, clientY: number, altKey = false) {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointerup', { clientX, clientY, altKey }));
      });
    },
  };
}

describe('snapShift', () => {
  it('snaps back to the cell boundary near zero', () => {
    expect(snapShift(1.2, false)).toBe(0);
    expect(snapShift(-1.4, false)).toBe(0);
  });

  it('snaps to half-millimetre steps by default', () => {
    expect(snapShift(4.4, false)).toBe(4.5);
    expect(snapShift(-6.3, false)).toBe(-6.5);
  });

  it('keeps hundredths when free dragging', () => {
    expect(snapShift(4.4713, true)).toBe(4.47);
  });

  it('still magnets to the boundary when free dragging', () => {
    // Otherwise "put it back" is unreachable by hand and the design keeps a
    // sub-millimetre override that reads as a mistake.
    expect(snapShift(0.4, true)).toBe(0);
  });
});

describe('useDividerDrag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tracks which wall is being dragged', () => {
    const d = mountDrag();
    expect(d.draggingKey).toBeNull();

    d.start(makeRow('vertical'), 100, 100);
    expect(d.draggingKey).toBe('0-1');

    d.up(100, 100);
    expect(d.draggingKey).toBeNull();
  });

  it('moves a vertical wall along +X with the pointer', () => {
    const d = mountDrag();
    d.start(makeRow('vertical'), 100, 100);

    d.move(120, 100); // +20px → +10mm at 2px/mm

    expect(d.previewTilt).toHaveBeenLastCalledWith(expect.objectContaining({ axis: 'vertical' }), {
      angleDeg: 0,
      shiftMm: 10,
    });
  });

  it('moves a horizontal wall OPPOSITE the pointer, because the grid draws bottom-up', () => {
    const d = mountDrag();
    d.start(makeRow('horizontal'), 100, 100);

    d.move(100, 120); // pointer DOWN the screen is -Y in bin space

    expect(d.previewTilt).toHaveBeenLastCalledWith(
      expect.objectContaining({ axis: 'horizontal' }),
      { angleDeg: 0, shiftMm: -10 }
    );
  });

  it('previews during the drag without committing', () => {
    const d = mountDrag();
    d.start(makeRow('vertical'), 100, 100);

    d.move(120, 100);
    d.move(140, 100);

    expect(d.previewTilt).toHaveBeenCalledTimes(2);
    expect(d.commitTilt).not.toHaveBeenCalled();
  });

  it('commits once on release, tagged as a canvas drag', () => {
    const d = mountDrag();
    d.start(makeRow('vertical'), 100, 100);
    d.move(120, 100);
    d.up(120, 100);

    expect(d.commitTilt).toHaveBeenCalledTimes(1);
    expect(d.commitTilt).toHaveBeenCalledWith(
      expect.objectContaining({ key: '0-1' }),
      { angleDeg: 0, shiftMm: 10 },
      'canvas_drag'
    );
  });

  it('slides a tilted wall without straightening it', () => {
    const d = mountDrag();
    d.start(makeRow('vertical', { angleDeg: 30, shiftMm: 2 }), 100, 100);

    d.move(110, 100); // +5mm on top of the existing 2mm shift

    expect(d.previewTilt).toHaveBeenLastCalledWith(expect.anything(), {
      angleDeg: 30,
      shiftMm: 7,
    });
  });

  it('drops to free placement while Alt is held', () => {
    const d = mountDrag();
    d.start(makeRow('vertical'), 100, 100);

    d.move(109, 100, true); // +9px → 4.5mm exactly, so probe an off-step value
    d.move(108.5, 100, true); // +8.5px → 4.25mm, which half-mm snapping would move

    expect(d.previewTilt).toHaveBeenLastCalledWith(expect.anything(), {
      angleDeg: 0,
      shiftMm: 4.25,
    });
  });

  it('ignores a wall with no geometry envelope', () => {
    const d = mountDrag();
    d.start(makeRow('vertical', { geometry: null }), 100, 100);

    expect(d.draggingKey).toBeNull();
    d.move(120, 100);
    expect(d.previewTilt).not.toHaveBeenCalled();
  });

  it('commits on pointercancel so a wall is never stranded mid-drag', () => {
    const d = mountDrag();
    d.start(makeRow('vertical'), 100, 100);
    d.move(120, 100);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { clientX: 120, clientY: 100 }));
    });

    expect(d.commitTilt).toHaveBeenCalledTimes(1);
    expect(d.draggingKey).toBeNull();
  });

  it('drops the preview when the workspace closes mid-drag', () => {
    const d = mountDrag();
    d.start(makeRow('vertical'), 100, 100);
    d.move(120, 100);

    act(() => {
      d.unmount();
    });

    // Cancelled, not committed: the wall was never released, so an override
    // here would write a position the user did not confirm.
    expect(d.cancelTilt).toHaveBeenCalledTimes(1);
    expect(d.commitTilt).not.toHaveBeenCalled();
  });

  it('leaves the preview alone when nothing was being dragged', () => {
    const d = mountDrag();

    act(() => {
      d.unmount();
    });

    expect(d.cancelTilt).not.toHaveBeenCalled();
  });
});
