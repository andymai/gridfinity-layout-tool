import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteraction } from '@/features/grid-editor/hooks/useInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { STAGING_ID } from '@/core/constants';
import { getBinId } from '@/test/testUtils';
import { createMockGridRef, setupStores } from './useInteraction.testUtils';

describe('startDrag', () => {
  beforeEach(() => {
    setupStores();
  });

  it('initializes drag interaction for single bin', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // startDrag needs client coordinates that map to grid coords
    // With BASE_CELL_SIZE=32 and gap=2, position (2,2) would be at pixel ~68,68
    act(() => {
      result.current.startDrag(binId, 68, 68);
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction).not.toBeNull();
    expect(interaction?.type).toBe('drag');
    if (interaction?.type === 'drag') {
      expect(interaction.binIds).toContain(binId);
      expect(interaction.valid).toBe(true);
      expect(interaction.isOverGrid).toBe(true);
    }
  });

  it('drags all selected bins when clicked bin is in selection', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId1 = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const binId2 = getBinId(
      addBin({
        layerId,
        x: 3,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    // Select both bins
    useSelectionStore.getState().setSelectedBins([binId1, binId2]);

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Drag the first bin (which is in selection)
    act(() => {
      result.current.startDrag(binId1, 34, 34);
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('drag');
    if (interaction?.type === 'drag') {
      expect(interaction.binIds).toHaveLength(2);
      expect(interaction.binIds).toContain(binId1);
      expect(interaction.binIds).toContain(binId2);
    }
  });

  it('selects only clicked bin when not in current selection', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId1 = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const binId2 = getBinId(
      addBin({
        layerId,
        x: 3,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    // Select only first bin
    useSelectionStore.getState().setSelectedBins([binId1]);

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Drag the second bin (not in selection)
    act(() => {
      result.current.startDrag(binId2, 100, 34);
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('drag');
    if (interaction?.type === 'drag') {
      expect(interaction.binIds).toHaveLength(1);
      expect(interaction.binIds).toContain(binId2);
    }
  });

  it('does nothing for non-existent bin', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag('non-existent-id', 50, 50);
    });

    expect(useInteractionStore.getState().interaction).toBeNull();
  });
});

describe('drag pointer events', () => {
  beforeEach(() => {
    setupStores();
  });

  it('drag interaction validates placement on move', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag(binId, 68, 68);
    });

    expect(useInteractionStore.getState().interaction?.type).toBe('drag');

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still be drag type
    expect(useInteractionStore.getState().interaction?.type).toBe('drag');
  });

  it('drag interaction completes on pointer up', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag(binId, 68, 68);
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Interaction should be cleared
    expect(useInteractionStore.getState().interaction).toBeNull();
  });

  it('drag to staging moves bin to staging', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDrag(binId, 68, 68);
    });

    // Set drop target to staging
    act(() => {
      useInteractionStore.getState().setDropTarget('staging');
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should be in staging
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.layerId).toBe(STAGING_ID);
  });

  it('pointer cancel does not commit drag movement', () => {
    const gridRef = createMockGridRef();
    const layout = useLayoutStore.getState().layout;
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    // Add a bin at position (2, 2)
    const addResult = useLayoutStore.getState().addBin({
      layerId,
      x: 2,
      y: 2,
      width: 2,
      depth: 2,
      height: 3,
      category: categoryId,
      label: 'Test',
      notes: '',
    });
    const binId = getBinId(addResult);

    const { result } = renderHook(() => useInteraction(gridRef));

    // Start dragging
    act(() => {
      result.current.startDrag(binId, 68, 68);
    });

    expect(useInteractionStore.getState().interaction?.type).toBe('drag');

    // Simulate pointer cancel
    act(() => {
      const cancelEvent = new PointerEvent('pointercancel', { bubbles: true });
      document.dispatchEvent(cancelEvent);
    });

    // Bin should still be at original position
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.x).toBe(2);
    expect(bin?.y).toBe(2);
  });

  it('pointer cancel clears drop target if set during drag', () => {
    const gridRef = createMockGridRef();
    const layout = useLayoutStore.getState().layout;
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const addResult = useLayoutStore.getState().addBin({
      layerId,
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
      category: categoryId,
      label: '',
      notes: '',
    });
    const binId = getBinId(addResult);

    const { result } = renderHook(() => useInteraction(gridRef));

    // Start drag and set drop target
    act(() => {
      result.current.startDrag(binId, 36, 36);
    });
    act(() => {
      useInteractionStore.getState().setDropTarget('staging');
    });

    expect(useInteractionStore.getState().dropTarget).toBe('staging');

    // Simulate pointer cancel
    act(() => {
      const cancelEvent = new PointerEvent('pointercancel', { bubbles: true });
      document.dispatchEvent(cancelEvent);
    });

    // Drop target should be cleared
    expect(useInteractionStore.getState().dropTarget).toBeNull();
    // Bin should NOT be deleted
    expect(useLayoutStore.getState().layout.bins.find((b) => b.id === binId)).toBeDefined();
  });
});

describe('duplicate drag (Alt+drag)', () => {
  beforeEach(() => {
    setupStores();
  });

  it('initializes duplicate drag interaction with duplicate flag', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Original',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start duplicate drag (Alt+drag)
    act(() => {
      result.current.startDrag(binId, 68, 68, undefined, true);
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction).not.toBeNull();
    expect(interaction?.type).toBe('drag');
    if (interaction?.type === 'drag') {
      expect(interaction.binIds).toContain(binId);
      expect(interaction.duplicate).toBe(true);
    }
  });

  it('creates duplicate bins at new position on drag end', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Original',
        notes: 'Test notes',
      })
    );

    expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start duplicate drag
    act(() => {
      result.current.startDrag(binId, 34, 34, undefined, true);
    });

    // Set up a valid drop position with delta movement
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'drag',
          binIds: [binId],
          startCoord: { x: 0, y: 0 },
          currentCoord: { x: 3, y: 0 }, // Delta: move 3 units right
          valid: true,
          isOverGrid: true,
          duplicate: true,
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Should now have 2 bins
    const bins = useLayoutStore.getState().layout.bins;
    expect(bins).toHaveLength(2);

    // Original should still be at original position
    const original = bins.find((b) => b.id === binId);
    expect(original?.x).toBe(0);
    expect(original?.y).toBe(0);

    // New bin should be at new position with same properties
    const duplicate = bins.find((b) => b.id !== binId);
    expect(duplicate?.x).toBe(3);
    expect(duplicate?.y).toBe(0);
    expect(duplicate?.width).toBe(2);
    expect(duplicate?.depth).toBe(2);
    expect(duplicate?.label).toBe('Original');
    expect(duplicate?.notes).toBe('Test notes');
    expect(duplicate?.category).toBe(categoryId);
  });

  it('duplicates multiple selected bins preserving arrangement', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId1 = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Bin 1',
        notes: '',
      })
    );

    const binId2 = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Bin 2',
        notes: '',
      })
    );

    expect(useLayoutStore.getState().layout.bins).toHaveLength(2);

    // Select both bins
    useSelectionStore.getState().setSelectedBins([binId1, binId2]);

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Start duplicate drag on first bin
    act(() => {
      result.current.startDrag(binId1, 34, 34, undefined, true);
    });

    // Set up valid drop with delta
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'drag',
          binIds: [binId1, binId2],
          startCoord: { x: 0, y: 0 },
          currentCoord: { x: 0, y: 3 }, // Delta: move 3 units up
          valid: true,
          isOverGrid: true,
          duplicate: true,
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Should now have 4 bins (2 original + 2 duplicates)
    const bins = useLayoutStore.getState().layout.bins;
    expect(bins).toHaveLength(4);

    // Originals should still be at original positions
    const original1 = bins.find((b) => b.id === binId1);
    const original2 = bins.find((b) => b.id === binId2);
    expect(original1?.x).toBe(0);
    expect(original1?.y).toBe(0);
    expect(original2?.x).toBe(2);
    expect(original2?.y).toBe(0);

    // Duplicates should be at new positions preserving relative arrangement
    const duplicates = bins.filter((b) => b.id !== binId1 && b.id !== binId2);
    expect(duplicates).toHaveLength(2);

    // Find duplicates by their labels
    const dup1 = duplicates.find((b) => b.label === 'Bin 1');
    const dup2 = duplicates.find((b) => b.label === 'Bin 2');
    expect(dup1?.x).toBe(0);
    expect(dup1?.y).toBe(3);
    expect(dup2?.x).toBe(2);
    expect(dup2?.y).toBe(3);
  });

  it('does not duplicate bins when drop position is invalid', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up invalid drop (collision or out of bounds)
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'drag',
          binIds: [binId],
          startCoord: { x: 0, y: 0 },
          currentCoord: { x: 0, y: 0 },
          valid: false, // Invalid position
          isOverGrid: true,
          duplicate: true,
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Should still have only 1 bin
    expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
  });

  it('does not duplicate bins when delta is zero (no movement)', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 2,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up duplicate drag with no movement
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'drag',
          binIds: [binId],
          startCoord: { x: 2, y: 2 },
          currentCoord: { x: 0, y: 0 }, // No delta
          valid: true,
          isOverGrid: true,
          duplicate: true,
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Should still have only 1 bin (no duplication on zero movement)
    expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
  });

  it('selects duplicated bins after successful duplicate drag', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up duplicate drag with movement
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'drag',
          binIds: [binId],
          startCoord: { x: 0, y: 0 },
          currentCoord: { x: 3, y: 0 },
          valid: true,
          isOverGrid: true,
          duplicate: true,
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // The new duplicate should be selected
    const selectedBinIds = useSelectionStore.getState().selectedBinIds;
    expect(selectedBinIds).toHaveLength(1);
    expect(selectedBinIds[0]).not.toBe(binId); // Should be the new bin, not the original
  });
});

describe('drag completion with movement', () => {
  beforeEach(() => {
    setupStores();
  });

  it('moves bin to new position when drag completes with valid delta', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up a valid drag with actual movement
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'drag',
          binIds: [binId],
          startCoord: { x: 0, y: 0 },
          currentCoord: { x: 3, y: 2 }, // Move delta: (3, 2)
          valid: true,
          isOverGrid: true,
        },
      });
    });

    // Simulate pointer up to complete drag
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should now be at new position
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.x).toBe(3);
    expect(bin?.y).toBe(2);
  });

  it('moves multiple bins preserving relative arrangement', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const layerId = layout.layers[0].id;
    const categoryId = layout.categories[0].id;

    const binId1 = getBinId(
      addBin({
        layerId,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const binId2 = getBinId(
      addBin({
        layerId,
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Set up valid drag for both bins
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'drag',
          binIds: [binId1, binId2],
          startCoord: { x: 0, y: 0 },
          currentCoord: { x: 0, y: 3 }, // Move delta: (0, 3)
          valid: true,
          isOverGrid: true,
        },
      });
    });

    // Complete drag
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Both bins should be moved preserving arrangement
    const bins = useLayoutStore.getState().layout.bins;
    const bin1 = bins.find((b) => b.id === binId1);
    const bin2 = bins.find((b) => b.id === binId2);
    expect(bin1?.x).toBe(0);
    expect(bin1?.y).toBe(3);
    expect(bin2?.x).toBe(2);
    expect(bin2?.y).toBe(3);
  });
});
