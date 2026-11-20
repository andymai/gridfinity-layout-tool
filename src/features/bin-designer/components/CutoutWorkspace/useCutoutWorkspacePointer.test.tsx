import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { useCutoutWorkspacePointer } from './useCutoutWorkspacePointer';

function renderPointer(setCameraCenter = vi.fn(), deselectAll = vi.fn()) {
  return renderHook(() =>
    useCutoutWorkspacePointer({
      mode: { type: 'idle' },
      setMode: vi.fn(),
      cutouts: [],
      selectCutout: vi.fn(),
      deselectAll,
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      handlePathBackgroundDown: vi.fn(),
      handleVertexBackgroundDown: vi.fn(),
      zoom: 2,
      setCameraCenter,
      fitToView: vi.fn(),
    })
  );
}

const MIDDLE_BUTTON = 1;
const MIDDLE_HELD = 4;

function pointer(init: PointerEventInit): PointerEvent {
  return new PointerEvent('pointermove', init);
}

describe('useCutoutWorkspacePointer middle-drag pan', () => {
  it('pans the camera while the middle button is held', () => {
    const setCameraCenter = vi.fn();
    const deselectAll = vi.fn();
    const { result } = renderPointer(setCameraCenter, deselectAll);
    act(() => {
      result.current.handleBackgroundPointerDown(
        0,
        0,
        pointer({ button: MIDDLE_BUTTON, buttons: MIDDLE_HELD, clientX: 100, clientY: 100 })
      );
    });
    act(() => {
      result.current.handleCanvasPointerMove(
        0,
        0,
        pointer({ buttons: MIDDLE_HELD, clientX: 110, clientY: 90 })
      );
    });
    expect(deselectAll).not.toHaveBeenCalled();
    expect(result.current.marquee).toBeNull();
    expect(setCameraCenter).toHaveBeenCalledOnce();
    const update = setCameraCenter.mock.calls[0][0] as (p: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    expect(update({ x: 0, y: 0 })).toEqual({ x: -5, y: -5 });
  });

  it('stops panning once the button comes up outside the canvas', () => {
    const setCameraCenter = vi.fn();
    const { result } = renderPointer(setCameraCenter);
    act(() => {
      result.current.handleBackgroundPointerDown(
        0,
        0,
        pointer({ button: MIDDLE_BUTTON, buttons: MIDDLE_HELD, clientX: 100, clientY: 100 })
      );
    });
    act(() => {
      result.current.handleCanvasPointerMove(
        0,
        0,
        pointer({ buttons: 0, clientX: 140, clientY: 60 })
      );
      result.current.handleCanvasPointerMove(
        0,
        0,
        pointer({ buttons: 0, clientX: 150, clientY: 50 })
      );
    });
    expect(setCameraCenter).not.toHaveBeenCalled();
  });
});

describe('useCutoutWorkspacePointer Space-to-pan', () => {
  it('holds Space for panning from the canvas', () => {
    const { result } = renderPointer();
    act(() => {
      fireEvent.keyDown(document.body, { code: 'Space', key: ' ' });
    });
    expect(result.current.spaceHeld).toBe(true);
  });

  it('leaves Space to a focused switch, so it still flips', () => {
    const { result } = renderPointer();
    const toggle = document.createElement('button');
    toggle.setAttribute('role', 'switch');
    document.body.appendChild(toggle);
    let allowed = true;
    act(() => {
      allowed = fireEvent.keyDown(toggle, { code: 'Space', key: ' ' });
    });
    expect(allowed).toBe(true);
    expect(result.current.spaceHeld).toBe(false);
    toggle.remove();
  });
});
