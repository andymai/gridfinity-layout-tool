import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCutoutPathTool } from './useCutoutPathTool';
import type { InteractionMode } from './cutoutInteractionTypes';
import type { Cutout } from '@/features/bin-designer/types';

const CUTOUT: Cutout = {
  id: 'p1',
  shape: 'path',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 15,
  cornerRadius: 0,
  label: '',
  groupId: null,
  path: [
    { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
    { x: 10, y: 0, handleIn: null, handleOut: null, symmetric: false },
    { x: 5, y: 10, handleIn: null, handleOut: null, symmetric: false },
  ],
};

function tool(mode: InteractionMode) {
  const setMode = vi.fn();
  const { result } = renderHook(() =>
    useCutoutPathTool({
      mode,
      setMode,
      cutouts: [CUTOUT],
      onAdd: () => true,
      onUpdate: vi.fn(),
      setSelection: vi.fn(),
      setPathDrawingPreview: vi.fn(),
      setPreview: vi.fn(),
      setSegmentHover: vi.fn(),
      snap: (v) => v,
      binWidth: 100,
      binDepth: 100,
    })
  );
  return { tool: result.current, setMode };
}

describe('useCutoutPathTool', () => {
  it('selects the anchor of a handle it starts dragging, on the handle’s ring', () => {
    // Otherwise Delete after a handle drag removes whatever point on whichever
    // ring was selected before.
    const { tool: path, setMode } = tool({
      type: 'vertex-editing',
      cutoutId: 'p1',
      ring: 0,
      selectedPointIndex: 3,
      dragTarget: null,
    });
    path.handleVertexHandleDown(1, 'out', 0, 0, 2);
    expect(setMode).toHaveBeenCalledWith({
      type: 'vertex-editing',
      cutoutId: 'p1',
      ring: 2,
      selectedPointIndex: 1,
      dragTarget: { type: 'handle', ring: 2, index: 1, handleType: 'out' },
      // What the drag began from, so a change under it cancels the release.
      dragFrom: { path: CUTOUT.path, holes: undefined, rotation: 15 },
    });
  });

  it('takes the nearest point when a press lands on overlapping handles', () => {
    const pt = (x: number, y: number) => ({
      x,
      y,
      handleIn: null,
      handleOut: null,
      symmetric: false,
    });
    const islanded: Cutout = {
      ...CUTOUT,
      rotation: 0,
      path: [pt(0, 0), pt(40, 0), pt(40, 40), pt(0, 40)],
      width: 40,
      depth: 40,
      holes: [[pt(1.5, 1.5), pt(10, 1.5), pt(10, 10)]],
    };
    const setMode = vi.fn();
    const { result } = renderHook(() =>
      useCutoutPathTool({
        mode: {
          type: 'vertex-editing',
          cutoutId: 'p1',
          ring: 0,
          selectedPointIndex: null,
          dragTarget: null,
        },
        setMode,
        cutouts: [islanded],
        onAdd: () => true,
        onUpdate: vi.fn(),
        setSelection: vi.fn(),
        setPathDrawingPreview: vi.fn(),
        setPreview: vi.fn(),
        setSegmentHover: vi.fn(),
        snap: (v) => v,
        binWidth: 100,
        binDepth: 100,
      })
    );
    // The outline corner's handle reported the hit, but the island's is nearer.
    result.current.handleVertexPointDown(0, 1.2, 1.2, 0);
    expect(setMode).toHaveBeenCalledWith(
      expect.objectContaining({ ring: 1, selectedPointIndex: 0 })
    );
  });

  it('ignores a handle outside vertex editing', () => {
    const { tool: path, setMode } = tool({ type: 'idle' });
    path.handleVertexHandleDown(1, 'out', 0, 0, 0);
    expect(setMode).not.toHaveBeenCalled();
  });
});
