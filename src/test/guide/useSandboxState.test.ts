import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSandboxState, DEFAULT_SANDBOX_CATEGORIES } from '../../guide/hooks/useSandboxState';
import type { SandboxBin } from '../../guide/hooks/useSandboxState';

describe('useSandboxState', () => {
  const defaultConfig = {
    width: 6,
    depth: 6,
    initialBins: [] as SandboxBin[],
    categories: DEFAULT_SANDBOX_CATEGORIES,
  };

  describe('initialization', () => {
    it('initializes with empty bins by default', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      expect(result.current.bins).toHaveLength(0);
      expect(result.current.selectedBinId).toBeNull();
      expect(result.current.interaction).toBeNull();
    });

    it('initializes with provided bins', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      expect(result.current.bins).toHaveLength(1);
      expect(result.current.bins[0].x).toBe(0);
      expect(result.current.bins[0].width).toBe(2);
    });

    it('uses default categories when none provided', () => {
      const { result } = renderHook(() =>
        useSandboxState({ width: 6, depth: 6 })
      );

      expect(result.current.categories).toEqual(DEFAULT_SANDBOX_CATEGORIES);
      expect(result.current.activeCategory).toBe('general');
    });

    it('uses custom categories when provided', () => {
      const customCategories = [
        { id: 'custom', name: 'Custom', color: '#ff0000' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ width: 6, depth: 6, categories: customCategories })
      );

      expect(result.current.categories).toEqual(customCategories);
      expect(result.current.activeCategory).toBe('custom');
    });

    it('exposes drawer size', () => {
      const { result } = renderHook(() =>
        useSandboxState({ width: 8, depth: 10 })
      );

      expect(result.current.drawerSize).toEqual({ width: 8, depth: 10 });
    });
  });

  describe('addBin', () => {
    it('adds a bin within bounds', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      let binId: string | null = null;
      act(() => {
        binId = result.current.addBin({
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          category: 'general',
        });
      });

      expect(binId).toBeTruthy();
      expect(result.current.bins).toHaveLength(1);
      expect(result.current.bins[0].x).toBe(0);
      expect(result.current.bins[0].width).toBe(2);
    });

    it('returns null for out-of-bounds bin', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      let binId: string | null = null;
      act(() => {
        binId = result.current.addBin({
          x: 5,
          y: 5,
          width: 2, // Would extend beyond bounds
          depth: 2,
          category: 'general',
        });
      });

      expect(binId).toBeNull();
      expect(result.current.bins).toHaveLength(0);
    });

    it('returns null for colliding bin', () => {
      const initialBins: SandboxBin[] = [
        { id: 'existing', x: 0, y: 0, width: 3, depth: 3, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      let binId: string | null = null;
      act(() => {
        binId = result.current.addBin({
          x: 1, // Overlaps with existing bin
          y: 1,
          width: 2,
          depth: 2,
          category: 'general',
        });
      });

      expect(binId).toBeNull();
      expect(result.current.bins).toHaveLength(1); // Only the initial bin
    });

    it('allows adjacent bins that touch but do not overlap', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      act(() => {
        result.current.addBin({ x: 0, y: 0, width: 2, depth: 2, category: 'general' });
      });

      let binId: string | null = null;
      act(() => {
        binId = result.current.addBin({
          x: 2, // Directly adjacent, no overlap
          y: 0,
          width: 2,
          depth: 2,
          category: 'general',
        });
      });

      expect(binId).toBeTruthy();
      expect(result.current.bins).toHaveLength(2);
    });
  });

  describe('updateBin', () => {
    it('updates bin position', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      let success = false;
      act(() => {
        success = result.current.updateBin('bin-1', { x: 2, y: 2 });
      });

      expect(success).toBe(true);
      expect(result.current.bins[0].x).toBe(2);
      expect(result.current.bins[0].y).toBe(2);
    });

    it('updates bin category', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      act(() => {
        result.current.updateBin('bin-1', { category: 'tools' });
      });

      expect(result.current.bins[0].category).toBe('tools');
    });

    it('returns false for invalid update (out of bounds)', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      let success = false;
      act(() => {
        success = result.current.updateBin('bin-1', { x: 10 }); // Out of bounds
      });

      expect(success).toBe(false);
      expect(result.current.bins[0].x).toBe(0); // Unchanged
    });

    it('returns false for non-existent bin', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      let success = false;
      act(() => {
        success = result.current.updateBin('non-existent', { x: 1 });
      });

      expect(success).toBe(false);
    });
  });

  describe('deleteBin', () => {
    it('removes bin by id', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
        { id: 'bin-2', x: 3, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      act(() => {
        result.current.deleteBin('bin-1');
      });

      expect(result.current.bins).toHaveLength(1);
      expect(result.current.bins[0].id).toBe('bin-2');
    });

    it('clears selection if deleted bin was selected', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      act(() => {
        result.current.selectBin('bin-1');
      });

      expect(result.current.selectedBinId).toBe('bin-1');

      act(() => {
        result.current.deleteBin('bin-1');
      });

      expect(result.current.selectedBinId).toBeNull();
    });
  });

  describe('selection', () => {
    it('selects a bin', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      act(() => {
        result.current.selectBin('bin-1');
      });

      expect(result.current.selectedBinId).toBe('bin-1');
      expect(result.current.selectedBin).toEqual(initialBins[0]);
    });

    it('clears selection with null', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      act(() => {
        result.current.selectBin('bin-1');
      });

      act(() => {
        result.current.selectBin(null);
      });

      expect(result.current.selectedBinId).toBeNull();
      expect(result.current.selectedBin).toBeNull();
    });

    it('clearSelection clears selection', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      act(() => {
        result.current.selectBin('bin-1');
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedBinId).toBeNull();
    });
  });

  describe('category management', () => {
    it('changes active category', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      expect(result.current.activeCategory).toBe('general');

      act(() => {
        result.current.setActiveCategory('tools');
      });

      expect(result.current.activeCategory).toBe('tools');
    });
  });

  describe('interaction state', () => {
    it('sets and clears interaction', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      expect(result.current.interaction).toBeNull();

      act(() => {
        result.current.setInteraction({
          type: 'draw',
          startX: 0,
          startY: 0,
          currentX: 2,
          currentY: 2,
        });
      });

      expect(result.current.interaction?.type).toBe('draw');

      act(() => {
        result.current.setInteraction(null);
      });

      expect(result.current.interaction).toBeNull();
    });
  });

  describe('resetBins', () => {
    it('resets bins to initial state', () => {
      const initialBins: SandboxBin[] = [
        { id: 'initial', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      // Add another bin
      act(() => {
        result.current.addBin({ x: 3, y: 0, width: 2, depth: 2, category: 'tools' });
      });

      expect(result.current.bins).toHaveLength(2);

      // Reset
      act(() => {
        result.current.resetBins();
      });

      expect(result.current.bins).toHaveLength(1);
      expect(result.current.selectedBinId).toBeNull();
      expect(result.current.interaction).toBeNull();
    });
  });

  describe('validation helpers', () => {
    it('canPlaceBin returns true for valid placement', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      expect(
        result.current.canPlaceBin({ x: 0, y: 0, width: 2, depth: 2 })
      ).toBe(true);
    });

    it('canPlaceBin returns false for out-of-bounds', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      expect(
        result.current.canPlaceBin({ x: 5, y: 5, width: 2, depth: 2 })
      ).toBe(false);
    });

    it('canPlaceBin excludes specific bin from collision check', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      // Same position as bin-1, should fail normally
      expect(
        result.current.canPlaceBin({ x: 0, y: 0, width: 2, depth: 2 })
      ).toBe(false);

      // But should pass when excluding bin-1 (for moving the same bin)
      expect(
        result.current.canPlaceBin({ x: 0, y: 0, width: 2, depth: 2 }, 'bin-1')
      ).toBe(true);
    });

    it('checkCollision detects overlapping bins', () => {
      const initialBins: SandboxBin[] = [
        { id: 'bin-1', x: 0, y: 0, width: 3, depth: 3, category: 'general' },
      ];

      const { result } = renderHook(() =>
        useSandboxState({ ...defaultConfig, initialBins })
      );

      expect(
        result.current.checkCollision({ x: 1, y: 1, width: 2, depth: 2 })
      ).toBe(true);

      expect(
        result.current.checkCollision({ x: 4, y: 0, width: 2, depth: 2 })
      ).toBe(false);
    });

    it('isInBounds checks boundaries correctly', () => {
      const { result } = renderHook(() => useSandboxState(defaultConfig));

      expect(result.current.isInBounds({ x: 0, y: 0, width: 2, depth: 2 })).toBe(true);
      expect(result.current.isInBounds({ x: 4, y: 4, width: 2, depth: 2 })).toBe(true);
      expect(result.current.isInBounds({ x: 5, y: 5, width: 2, depth: 2 })).toBe(false);
      expect(result.current.isInBounds({ x: -1, y: 0, width: 2, depth: 2 })).toBe(false);
    });
  });
});
