import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteraction } from '@/features/grid-editor/hooks/useInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { STAGING_ID } from '@/core/constants';
import { getBinId } from '@/test/testUtils';
import { createMockGridRef, setupStores } from './useInteraction.testUtils';

describe('stagingDrag interaction', () => {
  beforeEach(() => {
    setupStores();
  });

  it('stagingDrag updates position on pointer move', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;

    // Add bin to staging
    const binId = getBinId(
      addBin({
        layerId: STAGING_ID,
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

    // Manually set up stagingDrag interaction
    useInteractionStore.setState({
      ...useInteractionStore.getState(),
      interaction: {
        type: 'stagingDrag',
        binId: binId,
        currentCoord: { x: 0, y: 0 },
        valid: false,
      },
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still be stagingDrag
    expect(useInteractionStore.getState().interaction?.type).toBe('stagingDrag');
  });

  it('stagingDrag places bin on grid on pointer up when valid', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;
    const layerId = layout.layers[0].id;

    // Add bin to staging
    const binId = getBinId(
      addBin({
        layerId: STAGING_ID,
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

    // Verify bin is in staging
    expect(useLayoutStore.getState().layout.bins.find((b) => b.id === binId)?.layerId).toBe(
      STAGING_ID
    );

    // Set active layer and interaction
    useSelectionStore.setState({
      ...useSelectionStore.getState(),
      activeLayerId: layerId,
    });
    useInteractionStore.setState({
      ...useInteractionStore.getState(),
      interaction: {
        type: 'stagingDrag',
        binId: binId,
        currentCoord: { x: 2, y: 2 },
        valid: true,
      },
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should now be on the grid (not in staging)
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.layerId).toBe(layerId);
    expect(bin?.x).toBe(2);
    expect(bin?.y).toBe(2);
  });

  it('stagingDrag keeps bin in staging when dropped at invalid position', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;

    // Add bin to staging
    const binId = getBinId(
      addBin({
        layerId: STAGING_ID,
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

    // Set up stagingDrag interaction with invalid position
    useInteractionStore.setState({
      ...useInteractionStore.getState(),
      interaction: {
        type: 'stagingDrag',
        binId: binId,
        currentCoord: { x: 100, y: 100 }, // Out of bounds
        valid: false,
      },
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should still be in staging
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.layerId).toBe(STAGING_ID);
  });

  it('stagingDrag allows shorter bin to be placed on layer and keeps original height', () => {
    const { addBin, updateLayer, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;
    const tallLayerId = layout.layers[0].id;

    // Update the layer to have a higher minimum height (5u)
    // Note: Layer "minimum height" is a default for new bins, not a constraint
    updateLayer(tallLayerId, { height: 5 });

    // Add a shorter bin (3u) to staging
    const binId = getBinId(
      addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3, // Shorter than the layer's "default" height of 5
        category: categoryId,
        label: '',
        notes: '',
      })
    );

    // Verify bin is in staging with height 3
    const stagedBin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(stagedBin?.layerId).toBe(STAGING_ID);
    expect(stagedBin?.height).toBe(3);

    // Set active layer to the tall layer
    useSelectionStore.setState({
      ...useSelectionStore.getState(),
      activeLayerId: tallLayerId,
    });

    // Set up stagingDrag interaction with valid position
    // Validation passes - layer height is not a constraint for existing bins
    useInteractionStore.setState({
      ...useInteractionStore.getState(),
      interaction: {
        type: 'stagingDrag',
        binId: binId,
        currentCoord: { x: 2, y: 2 },
        valid: true,
      },
    });

    const gridRef = createMockGridRef();
    renderHook(() => useInteraction(gridRef));

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Bin should now be on the grid with its ORIGINAL height preserved
    // (no auto-adjustment to layer minimum - user may have specific STL dimensions)
    const placedBin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(placedBin?.layerId).toBe(tallLayerId);
    expect(placedBin?.x).toBe(2);
    expect(placedBin?.y).toBe(2);
    expect(placedBin?.height).toBe(3); // Height preserved, NOT adjusted to 5
  });
});

describe('staging drag', () => {
  beforeEach(() => {
    setupStores();
  });

  it('bins can be added to staging', () => {
    const { addBin, layout } = useLayoutStore.getState();
    const categoryId = layout.categories[0].id;

    // Add bin to staging
    const binId = getBinId(
      addBin({
        layerId: STAGING_ID,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: categoryId,
        label: 'Staged bin',
        notes: '',
      })
    );

    expect(binId).not.toBeNull();
    const bin = useLayoutStore.getState().layout.bins.find((b) => b.id === binId);
    expect(bin?.layerId).toBe(STAGING_ID);
  });
});
