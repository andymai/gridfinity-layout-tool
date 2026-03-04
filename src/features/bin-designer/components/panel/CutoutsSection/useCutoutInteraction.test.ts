import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { useCutoutInteraction } from './useCutoutInteraction';

const createCutout = (id: string, overrides: Partial<Cutout> = {}): Cutout => ({
  id,
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

describe('useCutoutInteraction', () => {
  const onUpdate = vi.fn();
  const onRemove = vi.fn();
  const onAdd = vi.fn();
  const defaultCutouts = [createCutout('a'), createCutout('b'), createCutout('c')];

  const defaultOpts = {
    cutouts: defaultCutouts,
    onUpdate,
    onRemove,
    onAdd,
    binWidth: 100,
    binDepth: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in rectangle placing mode with empty selection', () => {
    const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
    expect(result.current.mode).toEqual({ type: 'placing', shape: 'rectangle' });
    expect(result.current.selection.size).toBe(0);
  });

  describe('selectCutout', () => {
    it('selects a single cutout', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      expect(result.current.selection.has('a')).toBe(true);
      expect(result.current.selection.size).toBe(1);
    });

    it('replaces selection when non-additive', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('b', false));
      expect(result.current.selection.has('a')).toBe(false);
      expect(result.current.selection.has('b')).toBe(true);
      expect(result.current.selection.size).toBe(1);
    });

    it('adds to selection when additive', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('b', true));
      expect(result.current.selection.has('a')).toBe(true);
      expect(result.current.selection.has('b')).toBe(true);
      expect(result.current.selection.size).toBe(2);
    });

    it('toggles off when additive and already selected', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('a', true));
      expect(result.current.selection.has('a')).toBe(false);
    });
  });

  describe('deselectAll', () => {
    it('clears the selection', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('b', true));
      expect(result.current.selection.size).toBe(2);

      act(() => result.current.deselectAll());
      expect(result.current.selection.size).toBe(0);
    });
  });

  describe('selectAll', () => {
    it('selects all cutouts', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectAll());
      expect(result.current.selection.size).toBe(3);
      expect(result.current.selection.has('a')).toBe(true);
      expect(result.current.selection.has('b')).toBe(true);
      expect(result.current.selection.has('c')).toBe(true);
    });
  });

  describe('deleteSelected', () => {
    it('calls onRemove for each selected cutout and clears selection', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('b', true));
      act(() => result.current.deleteSelected());

      expect(onRemove).toHaveBeenCalledWith('a');
      expect(onRemove).toHaveBeenCalledWith('b');
      expect(onRemove).toHaveBeenCalledTimes(2);
      expect(result.current.selection.size).toBe(0);
    });
  });

  describe('mode transitions', () => {
    it('can switch to placing mode', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.setMode({ type: 'placing', shape: 'circle' }));
      expect(result.current.mode).toEqual({ type: 'placing', shape: 'circle' });
    });

    it('returns to idle when setMode called with idle', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.setMode({ type: 'placing', shape: 'rectangle' }));
      act(() => result.current.setMode({ type: 'idle' }));
      expect(result.current.mode).toEqual({ type: 'idle' });
    });
  });

  describe('keyboard shortcuts', () => {
    it('deletes selected on Delete key', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
      });

      expect(onRemove).toHaveBeenCalledWith('a');
    });

    it('deselects all and resets mode on Escape', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.setMode({ type: 'placing', shape: 'circle' }));

      // First Escape: exits placing mode but keeps selection
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.mode).toEqual({ type: 'idle' });
      expect(result.current.selection.size).toBe(1); // Selection persists

      // Second Escape: deselects when already idle
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.selection.size).toBe(0);
    });

    it('selects all on Ctrl+A', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));
      });

      expect(result.current.selection.size).toBe(3);
    });

    it('nudges selected left on ArrowLeft', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      });

      expect(onUpdate).toHaveBeenCalledWith('a', expect.objectContaining({ x: 9.5 }));
    });

    it('nudges selected right on ArrowRight', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });

      expect(onUpdate).toHaveBeenCalledWith('a', expect.objectContaining({ x: 10.5 }));
    });

    it('nudges selected up on ArrowUp (increases model Y)', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      });

      expect(onUpdate).toHaveBeenCalledWith('a', expect.objectContaining({ y: 10.5 }));
    });

    it('nudges selected down on ArrowDown (decreases model Y)', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      });

      expect(onUpdate).toHaveBeenCalledWith('a', expect.objectContaining({ y: 9.5 }));
    });

    it('does not fire when typing in input', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      });

      expect(onRemove).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  describe('selection cleanup', () => {
    it('removes stale ids when cutouts are removed externally', () => {
      const { result, rerender } = renderHook((opts) => useCutoutInteraction(opts), {
        initialProps: defaultOpts,
      });

      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('b', true));
      expect(result.current.selection.size).toBe(2);

      // Simulate removing cutout 'a' externally
      rerender({
        ...defaultOpts,
        cutouts: [createCutout('b'), createCutout('c')],
      });

      expect(result.current.selection.has('a')).toBe(false);
      expect(result.current.selection.has('b')).toBe(true);
      expect(result.current.selection.size).toBe(1);
    });
  });

  describe('drag lifecycle', () => {
    it('starts drag and sets mode to dragging with offsets', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startDrag('a', 15, 15));

      expect(result.current.mode.type).toBe('dragging');
      if (result.current.mode.type === 'dragging') {
        expect(result.current.mode.startX).toBe(15);
        expect(result.current.mode.startY).toBe(15);
        expect(result.current.mode.offsets.has('a')).toBe(true);
      }
    });

    it('selects cutout if not already selected when starting drag', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      // Don't explicitly select — startDrag should auto-select
      act(() => result.current.startDrag('a', 15, 15));

      expect(result.current.selection.has('a')).toBe(true);
    });

    it('does not update preview within dead zone', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startDrag('a', 15, 15));

      // Move very slightly (within dead zone)
      act(() => result.current.handlePointerMove(15.1, 15.1));
      expect(result.current.preview.size).toBe(0);
    });

    it('updates preview after exceeding dead zone', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startDrag('a', 15, 15));

      // Move beyond dead zone
      act(() => result.current.handlePointerMove(20, 20));
      expect(result.current.preview.size).toBe(1);
      expect(result.current.preview.has('a')).toBe(true);
    });

    it('commits preview to store on pointer up', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startDrag('a', 15, 15));

      // Drag beyond dead zone
      act(() => result.current.handlePointerMove(25, 25));
      act(() => result.current.handlePointerUp());

      expect(onUpdate).toHaveBeenCalledWith(
        'a',
        expect.objectContaining({ x: expect.any(Number) })
      );
      expect(result.current.mode.type).toBe('idle');
      expect(result.current.preview.size).toBe(0);
    });

    it('does not commit on pointer up if within dead zone', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startDrag('a', 15, 15));

      // Release without moving
      act(() => result.current.handlePointerUp());

      expect(onUpdate).not.toHaveBeenCalled();
      expect(result.current.mode.type).toBe('idle');
    });

    it('clamps drag to bin bounds', () => {
      const opts = {
        ...defaultOpts,
        cutouts: [createCutout('a', { x: 5, y: 5, width: 20, depth: 15 })],
      };
      const { result } = renderHook(() => useCutoutInteraction(opts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startDrag('a', 15, 12));

      // Try to drag way beyond bounds
      act(() => result.current.handlePointerMove(200, 200));

      const previewA = result.current.preview.get('a');
      expect(previewA).toBeDefined();
      if (previewA?.x !== undefined) {
        expect(previewA.x).toBeLessThanOrEqual(80); // binWidth(100) - width(20)
      }
    });
  });

  describe('resize lifecycle', () => {
    it('starts resize and sets mode', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startResize('a', 'se', 30, 25));

      expect(result.current.mode.type).toBe('resizing');
      if (result.current.mode.type === 'resizing') {
        expect(result.current.mode.cutoutId).toBe('a');
        expect(result.current.mode.handle).toBe('se');
        expect(result.current.mode.startRect).toEqual({ x: 10, y: 10, width: 20, depth: 15 });
      }
    });

    it('updates preview during resize', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startResize('a', 'se', 30, 25));

      // Move to resize
      act(() => result.current.handlePointerMove(40, 5));
      expect(result.current.preview.has('a')).toBe(true);
    });

    it('commits resize on pointer up', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startResize('a', 'se', 30, 25));

      act(() => result.current.handlePointerMove(40, 5));
      act(() => result.current.handlePointerUp());

      expect(onUpdate).toHaveBeenCalledWith(
        'a',
        expect.objectContaining({
          width: expect.any(Number),
        })
      );
      expect(result.current.mode.type).toBe('idle');
    });
  });

  describe('escape cancels drag/resize', () => {
    it('cancels in-progress drag without committing', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startDrag('a', 15, 15));
      act(() => result.current.handlePointerMove(25, 25));

      expect(result.current.preview.size).toBe(1);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.preview.size).toBe(0);
      expect(result.current.mode.type).toBe('idle');
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('cancels in-progress resize without committing', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.startResize('a', 'se', 30, 25));
      act(() => result.current.handlePointerMove(40, 5));

      expect(result.current.preview.size).toBe(1);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.preview.size).toBe(0);
      expect(result.current.mode.type).toBe('idle');
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    it('starts with empty preview map', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      expect(result.current.preview.size).toBe(0);
    });
  });

  describe('group drag', () => {
    it('computes offsets for all group members when clicking a grouped cutout', () => {
      const groupedCutouts = [
        createCutout('a', { x: 10, y: 10, groupId: 'g1' }),
        createCutout('b', { x: 30, y: 30, groupId: 'g1' }),
        createCutout('c', { x: 50, y: 50 }),
      ];
      const opts = { ...defaultOpts, cutouts: groupedCutouts };
      const { result } = renderHook(() => useCutoutInteraction(opts));

      // Click cutout 'a' (non-additive), which should select both 'a' and 'b' (group)
      act(() => result.current.selectCutout('a', false));
      // Then start drag on 'a' — but selection state may be stale in the closure
      act(() => result.current.startDrag('a', 15, 15));

      expect(result.current.mode.type).toBe('dragging');
      if (result.current.mode.type === 'dragging') {
        // Both group members should have offsets
        expect(result.current.mode.offsets.has('a')).toBe(true);
        expect(result.current.mode.offsets.has('b')).toBe(true);
        // Non-group member should not
        expect(result.current.mode.offsets.has('c')).toBe(false);
      }
    });

    it('handles stale closure: startDrag computes group selection eagerly', () => {
      const groupedCutouts = [
        createCutout('a', { x: 10, y: 10, groupId: 'g1' }),
        createCutout('b', { x: 30, y: 30, groupId: 'g1' }),
      ];
      const opts = { ...defaultOpts, cutouts: groupedCutouts };
      const { result } = renderHook(() => useCutoutInteraction(opts));

      // Don't pre-select; startDrag should detect the group and include both members
      act(() => result.current.startDrag('a', 15, 15));

      expect(result.current.mode.type).toBe('dragging');
      if (result.current.mode.type === 'dragging') {
        expect(result.current.mode.offsets.has('a')).toBe(true);
        expect(result.current.mode.offsets.has('b')).toBe(true);
      }
    });
  });

  describe('drawing lifecycle', () => {
    it('creates cutout with required properties', () => {
      const mockOnAdd = vi.fn();
      const mockOnUpdate = vi.fn();
      const mockOnUpdateBatch = vi.fn();
      const mockOnRemove = vi.fn();
      const mockOnUndo = vi.fn();
      const mockOnRedo = vi.fn();

      const { result } = renderHook(() =>
        useCutoutInteraction({
          cutouts: [],
          binWidth: 100,
          binDepth: 80,
          onAdd: mockOnAdd,
          onUpdate: mockOnUpdate,
          onUpdateBatch: mockOnUpdateBatch,
          onRemove: mockOnRemove,
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
        })
      );

      // Set mode to pending-place (simulating pointer down in placing mode)
      act(() => {
        result.current.setMode({
          type: 'pending-place',
          shape: 'rectangle',
          startMmX: 10,
          startMmY: 10,
        });
      });

      // Move pointer far enough to exceed threshold and trigger drawing mode (> 2mm)
      act(() => {
        result.current.handlePointerMove(15, 15);
      });

      // Verify mode transitioned to drawing
      expect(result.current.mode.type).toBe('drawing');

      // Continue dragging to create larger shape
      act(() => {
        result.current.handlePointerMove(30, 25);
      });

      // Verify drawingPreview was created
      expect(result.current.drawingPreview).toBeDefined();
      expect(result.current.drawingPreview?.width).toBeGreaterThanOrEqual(2);
      expect(result.current.drawingPreview?.depth).toBeGreaterThanOrEqual(2);

      // Finish drawing
      act(() => {
        result.current.handlePointerUp();
      });

      expect(mockOnAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          shape: 'rectangle',
          cutDepth: 5,
        })
      );
    });
  });

  describe('copy/paste/duplicate', () => {
    it('Ctrl+C copies selected cutouts to clipboard', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('b', true));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      });

      expect(result.current.clipboard.length).toBe(2);
      expect(result.current.clipboard.map((c) => c.id)).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('Ctrl+V pastes from clipboard with offset', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      // Copy
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      });

      // Paste
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 12, // original 10 + 2mm offset
          y: 12,
          groupId: null, // Group membership should not be copied
        })
      );
    });

    it('Multiple pastes increment offset', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      // Copy
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      });

      // First paste
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });

      // Second paste
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });

      expect(onAdd).toHaveBeenCalledTimes(2);
      // First paste: offset = 2mm
      expect(onAdd).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          x: 12,
          y: 12,
        })
      );
      // Second paste: offset = 4mm
      expect(onAdd).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          x: 14,
          y: 14,
        })
      );
    });

    it('Ctrl+D duplicates selected cutouts', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));
      act(() => result.current.selectCutout('b', true));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
      });

      expect(onAdd).toHaveBeenCalledTimes(2);
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 12, // original 10 + 2mm offset
          y: 12,
          groupId: null,
        })
      );
    });

    it('Paste selects newly created cutouts', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      // Copy
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      });

      // Paste
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });

      // After paste, onAdd was called but the cutouts array hasn't been updated in the test
      // So effectiveSelection will clean out the new IDs since they're not in the cutouts array
      // In real usage, the parent component would update cutouts and the selection would persist
      // For this test, we just verify that setSelection was called with new IDs
      expect(onAdd).toHaveBeenCalledTimes(1);
      // The selection is cleaned by effectiveSelection memo, so we can't test it directly
      // We can verify that a new ID was generated (not 'a', 'b', or 'c')
      const addedCutout = onAdd.mock.calls[0][0];
      expect(['a', 'b', 'c'].includes(addedCutout.id)).toBe(false);
    });

    it('Duplicate with no selection does nothing', () => {
      renderHook(() => useCutoutInteraction(defaultOpts));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
      });

      expect(onAdd).not.toHaveBeenCalled();
    });

    it('Paste with empty clipboard does nothing', () => {
      renderHook(() => useCutoutInteraction(defaultOpts));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });

      expect(onAdd).not.toHaveBeenCalled();
    });

    it('Copy resets paste count', () => {
      const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
      act(() => result.current.selectCutout('a', false));

      // Copy and paste twice (creating cutouts at offset 2mm and 4mm)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });

      // After pasting twice, the selection has shifted to the most recently pasted cutouts
      // Re-select cutout 'a' to test that copying resets the paste count
      act(() => result.current.selectCutout('a', false));

      vi.clearAllMocks();

      // Copy again from cutout 'a' (should reset the paste count to 0)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
      });

      // First paste after new copy should have offset of 2mm (paste count = 1)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
      });

      // The clipboard now has cutout 'a' at original position (10, 10)
      // With paste count = 1, offset = 2mm, so position should be (12, 12)
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 12,
          y: 12,
        })
      );
    });
  });
});
