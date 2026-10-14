import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { useCutoutWorkspacePointer } from './useCutoutWorkspacePointer';

function renderPointer() {
  return renderHook(() =>
    useCutoutWorkspacePointer({
      mode: { type: 'idle' },
      setMode: vi.fn(),
      cutouts: [],
      selectCutout: vi.fn(),
      deselectAll: vi.fn(),
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      handlePathBackgroundDown: vi.fn(),
      handleVertexBackgroundDown: vi.fn(),
      zoom: 1,
      setCameraCenter: vi.fn(),
      fitToView: vi.fn(),
    })
  );
}

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
