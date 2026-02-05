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
  const defaultCutouts = [createCutout('a'), createCutout('b'), createCutout('c')];

  const defaultOpts = {
    cutouts: defaultCutouts,
    onUpdate,
    onRemove,
    binWidth: 100,
    binDepth: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle mode with empty selection', () => {
    const { result } = renderHook(() => useCutoutInteraction(defaultOpts));
    expect(result.current.mode).toEqual({ type: 'idle' });
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

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.selection.size).toBe(0);
      expect(result.current.mode).toEqual({ type: 'idle' });
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
});
