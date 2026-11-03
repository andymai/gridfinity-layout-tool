import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCutoutPathTool } from './useCutoutPathTool';
import type { InteractionMode } from './cutoutInteractionTypes';

function tool(mode: InteractionMode) {
  const setMode = vi.fn();
  const startTransaction = vi.fn();
  const { result } = renderHook(() =>
    useCutoutPathTool({
      mode,
      setMode,
      cutouts: [],
      onAdd: () => true,
      onUpdate: vi.fn(),
      setSelection: vi.fn(),
      setPathDrawingPreview: vi.fn(),
      setPreview: vi.fn(),
      setSegmentHover: vi.fn(),
      snap: (v) => v,
      binWidth: 100,
      binDepth: 100,
      startTransaction,
    })
  );
  return { tool: result.current, setMode, startTransaction };
}

describe('useCutoutPathTool', () => {
  it('selects the anchor of a handle it starts dragging, on the handle’s ring', () => {
    // Otherwise Delete after a handle drag removes whatever point on whichever
    // ring was selected before.
    const {
      tool: path,
      setMode,
      startTransaction,
    } = tool({
      type: 'vertex-editing',
      cutoutId: 'p1',
      ring: 0,
      selectedPointIndex: 3,
      dragTarget: null,
    });
    path.handleVertexHandleDown(1, 'out', 0, 0, 2);
    expect(startTransaction).toHaveBeenCalledOnce();
    expect(setMode).toHaveBeenCalledWith({
      type: 'vertex-editing',
      cutoutId: 'p1',
      ring: 2,
      selectedPointIndex: 1,
      dragTarget: { type: 'handle', ring: 2, index: 1, handleType: 'out' },
    });
  });

  it('ignores a handle outside vertex editing', () => {
    const { tool: path, setMode } = tool({ type: 'idle' });
    path.handleVertexHandleDown(1, 'out', 0, 0, 0);
    expect(setMode).not.toHaveBeenCalled();
  });
});
