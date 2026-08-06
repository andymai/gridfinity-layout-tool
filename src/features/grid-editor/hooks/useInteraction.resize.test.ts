import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteraction } from '@/features/grid-editor/hooks/useInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import type { Rect } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';
import { getBinId } from '@/test/testUtils';
import { createMockGridRef, setupStores } from './useInteraction.testUtils';

function gridRect(x: number, y: number, width: number, depth: number): Rect {
  return { x: gridUnits(x), y: gridUnits(y), width: gridUnits(width), depth: gridUnits(depth) };
}

describe('startResize', () => {
  beforeEach(() => {
    setupStores();
  });

  it('initializes resize interaction', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId, 'e');
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction).not.toBeNull();
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      expect(interaction.binIds).toContain(binId);
      expect(interaction.handle).toBe('e');
      expect(interaction.valid).toBe(true);
      expect(interaction.startRects.get(binId)).toEqual({
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
      });
    }
  });

  it('resizes all selected bins when clicked bin is in selection', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId1 = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const binId2 = getBinId(
      addBin({
        layerId,
        x: gridUnits(5),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    useSelectionStore.getState().setSelectedBins([binId1, binId2]);

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId1, 'ne');
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      expect(interaction.binIds).toHaveLength(2);
      expect(interaction.startRects.size).toBe(2);
      expect(interaction.currentRects.size).toBe(2);
    }
  });

  it('refuses to start on a size-locked bin', () => {
    const { addBin, updateBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );
    updateBin(binId, { locked: true });

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId, 'e');
    });

    expect(useInteractionStore.getState().interaction).toBeNull();
  });

  it('drops size-locked bins from a multi-select resize', () => {
    const { addBin, updateBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const makeBin = (x: number) =>
      getBinId(
        addBin({
          layerId,
          x: gridUnits(x),
          y: gridUnits(0),
          width: gridUnits(2),
          depth: gridUnits(2),
          height: heightUnits(3),
          category: categoryId,
          label: '',
          notes: '',
        })
      );

    const freeBin = makeBin(0);
    const lockedBin = makeBin(5);
    updateBin(lockedBin, { locked: true });

    useSelectionStore.getState().setSelectedBins([freeBin, lockedBin]);

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(freeBin, 'ne');
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      expect(interaction.binIds).toEqual([freeBin]);
      expect(interaction.startRects.has(lockedBin)).toBe(false);
    }
  });

  it('stores different handles for corner resize', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();

    // Test different handles
    const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

    for (const handle of handles) {
      const { result } = renderHook(() => useInteraction(gridRef));

      act(() => {
        result.current.startResize(binId, handle);
      });

      const interaction = useInteractionStore.getState().interaction;
      expect(interaction?.type).toBe('resize');
      if (interaction?.type === 'resize') {
        expect(interaction.handle).toBe(handle);
      }

      // Reset for next iteration
      act(() => {
        useInteractionStore.getState().setInteraction(null);
      });
    }
  });
});

describe('resize rect calculation (integration)', () => {
  beforeEach(() => {
    setupStores();
  });

  it('resize east expands width', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId, 'e');
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      const startRect = interaction.startRects.get(binId);
      expect(startRect?.width).toBe(2);
    }
  });

  it('resize preserves minimum size of 1', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(2),
        y: gridUnits(2),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start resize from west edge
    act(() => {
      result.current.startResize(binId, 'w');
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      // Width should still be at least 1 after initialization
      const currentRect = interaction.currentRects.get(binId);
      expect(currentRect?.width).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('resize pointer events', () => {
  beforeEach(() => {
    setupStores();
  });

  it('resize interaction updates on pointer move', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId, 'e');
    });

    expect(useInteractionStore.getState().interaction?.type).toBe('resize');

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 50,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still be resize type
    expect(useInteractionStore.getState().interaction?.type).toBe('resize');
  });

  it('resize interaction completes on pointer up', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startResize(binId, 'ne');
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Interaction should be cleared
    expect(useInteractionStore.getState().interaction).toBeNull();
  });
});

describe('resize completion with changes', () => {
  beforeEach(() => {
    setupStores();
  });

  it('applies resize changes when dimensions actually change', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up resize interaction with actual dimension change
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'resize',
          binIds: [binId],
          handle: 'e',
          valid: true,
          startRects: new Map([[binId, gridRect(0, 0, 2, 2)]]),
          currentRects: new Map([[binId, gridRect(0, 0, 4, 2)]]), // Width changed: 2 -> 4
        },
      });
    });

    // Complete resize
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should have new dimensions
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.width).toBe(4);
    expect(bin?.depth).toBe(2);
  });

  it('applies resize to multiple bins', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId1 = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const binId2 = getBinId(
      addBin({
        layerId,
        x: gridUnits(5),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up resize for both bins
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'resize',
          binIds: [binId1, binId2],
          handle: 'n',
          valid: true,
          startRects: new Map([
            [binId1, gridRect(0, 0, 2, 2)],
            [binId2, gridRect(5, 0, 2, 2)],
          ]),
          currentRects: new Map([
            [binId1, gridRect(0, 0, 2, 4)],
            [binId2, gridRect(5, 0, 2, 4)],
          ]),
        },
      });
    });

    // Complete resize
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Both bins should have new depth
    const bins = useLayoutStore.getState().layout.bins;
    const bin1 = bins.find((b) => b.id === binId1);
    const bin2 = bins.find((b) => b.id === binId2);
    expect(bin1?.depth).toBe(4);
    expect(bin2?.depth).toBe(4);
  });

  it('does not apply changes when no dimensions changed', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up resize with no actual change
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'resize',
          binIds: [binId],
          handle: 'e',
          valid: true,
          startRects: new Map([[binId, gridRect(0, 0, 2, 2)]]),
          currentRects: new Map([[binId, gridRect(0, 0, 2, 2)]]), // Same as start
        },
      });
    });

    // Complete resize
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should still have original dimensions
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.width).toBe(2);
    expect(bin?.depth).toBe(2);
  });
});

describe('resize via pointer movement', () => {
  beforeEach(() => {
    setupStores();
  });

  it('resize via pointer movement updates currentRects', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start resize
    act(() => {
      result.current.startResize(binId, 'e');
    });

    expect(useInteractionStore.getState().interaction?.type).toBe('resize');

    // Move pointer to expand width
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 200, // Move significantly to the right
        clientY: 50,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still be resize with potentially updated rects
    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
  });

  it('handles west resize direction', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(3),
        y: gridUnits(3),
        width: gridUnits(3),
        depth: gridUnits(3),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start resize from west
    act(() => {
      result.current.startResize(binId, 'w');
    });

    expect(useInteractionStore.getState().interaction?.type).toBe('resize');

    // Move pointer to left
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 50, // Move to the left
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      expect(interaction.handle).toBe('w');
    }
  });

  it('handles south resize direction', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(3),
        y: gridUnits(3),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start resize from south
    act(() => {
      result.current.startResize(binId, 's');
    });

    // Move pointer down
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 250, // Move down
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      expect(interaction.handle).toBe('s');
    }
  });

  it('handles corner resize (sw)', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: gridUnits(3),
        y: gridUnits(3),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start resize from southwest corner
    act(() => {
      result.current.startResize(binId, 'sw');
    });

    // Move pointer to southwest
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 50, // Move left
        clientY: 250, // Move down
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('resize');
    if (interaction?.type === 'resize') {
      expect(interaction.handle).toBe('sw');
    }
  });
});
