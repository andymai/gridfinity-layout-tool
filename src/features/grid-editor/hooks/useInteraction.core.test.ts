import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteraction } from '@/features/grid-editor/hooks/useInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useInteractionStore } from '@/core/store/interaction';
import { getBinId } from '@/test/testUtils';
import { createMockGridRef, setupStores } from './useInteraction.testUtils';

describe('cancel', () => {
  beforeEach(() => {
    setupStores();
  });

  it('clears interaction state', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    // Set up an interaction
    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    expect(useInteractionStore.getState().interaction).not.toBeNull();

    // Cancel it
    act(() => {
      result.current.cancel();
    });

    expect(useInteractionStore.getState().interaction).toBeNull();
  });
});

describe('interaction property', () => {
  beforeEach(() => {
    setupStores();
  });

  it('returns current interaction from store', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    expect(result.current.interaction).toBeNull();

    act(() => {
      result.current.startDraw({ x: 1, y: 2 });
    });

    expect(result.current.interaction).not.toBeNull();
    expect(result.current.interaction?.type).toBe('draw');
  });
});

describe('pointer cancel clears interaction', () => {
  beforeEach(() => {
    setupStores();
  });

  it('pointer cancel clears interaction', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    expect(useInteractionStore.getState().interaction).not.toBeNull();

    // Simulate pointer cancel
    act(() => {
      const cancelEvent = new PointerEvent('pointercancel', { bubbles: true });
      document.dispatchEvent(cancelEvent);
    });

    // Interaction should be cleared
    expect(useInteractionStore.getState().interaction).toBeNull();
  });
});

describe('cleanup on unmount', () => {
  beforeEach(() => {
    setupStores();
  });

  it('cleans up event listeners on unmount', () => {
    const gridRef = createMockGridRef();
    const { result, unmount } = renderHook(() => useInteraction(gridRef));

    // Start an interaction
    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    expect(useInteractionStore.getState().interaction).not.toBeNull();

    // Unmount should clean up without errors
    expect(() => unmount()).not.toThrow();
  });

  it('cleans up while resize interaction is active', () => {
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
    const { result, unmount } = renderHook(() => useInteraction(gridRef));

    // Start resize
    act(() => {
      result.current.startResize(binId, 'e');
    });

    // Unmount while resize is active
    expect(() => unmount()).not.toThrow();
  });

  it('cleans up while drag interaction is active', () => {
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
    const { result, unmount } = renderHook(() => useInteraction(gridRef));

    // Start drag
    act(() => {
      result.current.startDrag(binId, 50, 50);
    });

    // Unmount while drag is active
    expect(() => unmount()).not.toThrow();
  });
});
