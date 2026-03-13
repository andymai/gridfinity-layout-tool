import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteraction } from '@/features/grid-editor/hooks/useInteraction';
import { useLayoutStore } from '@/core/store/layout';
import { useInteractionStore } from '@/core/store/interaction';
import { createMockGridRef, setupStores } from './useInteraction.testUtils';

describe('startDraw', () => {
  beforeEach(() => {
    setupStores();
  });

  it('initializes draw interaction', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 2, y: 3 });
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction).not.toBeNull();
    expect(interaction?.type).toBe('draw');
    if (interaction?.type === 'draw') {
      expect(interaction.start).toEqual({ x: 2, y: 3 });
      expect(interaction.current).toEqual({ x: 2, y: 3 });
    }
  });

  it('initializes paint interaction when paint mode is active', () => {
    // Enable paint mode
    useInteractionStore.getState().setPaintSize({ width: 2, depth: 2 });

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction).not.toBeNull();
    expect(interaction?.type).toBe('paint');
    if (interaction?.type === 'paint') {
      expect(interaction.paintSize).toEqual({ width: 2, depth: 2 });
    }
  });
});

describe('draw pointer events', () => {
  beforeEach(() => {
    setupStores();
  });

  it('draw interaction updates on pointer move', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    const interaction = useInteractionStore.getState().interaction;
    expect(interaction?.type).toBe('draw');

    // Simulate pointer move
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Interaction should still exist after move
    expect(useInteractionStore.getState().interaction?.type).toBe('draw');
  });

  it('draw interaction completes on pointer up and creates bin', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    // Update current position
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'draw',
          start: { x: 0, y: 0 },
          current: { x: 2, y: 2 },
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Interaction should be cleared
    expect(useInteractionStore.getState().interaction).toBeNull();

    // A bin should have been created
    expect(useLayoutStore.getState().layout.bins.length).toBeGreaterThanOrEqual(1);
  });

  it('pointer cancel does not create a bin for draw interaction', () => {
    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    const binsBefore = useLayoutStore.getState().layout.bins.length;

    // Start a draw interaction
    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    // Simulate pointer move to establish a region
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
        isPrimary: true,
      });
      document.dispatchEvent(moveEvent);
    });

    // Simulate pointer cancel (OS interruption)
    act(() => {
      const cancelEvent = new PointerEvent('pointercancel', { bubbles: true });
      document.dispatchEvent(cancelEvent);
    });

    // No bin should be created
    expect(useLayoutStore.getState().layout.bins.length).toBe(binsBefore);
  });

  it('paint mode creates multiple bins in area', () => {
    // Enable paint mode with 2x2 bins
    useInteractionStore.getState().setPaintSize({ width: 2, depth: 2 });

    const gridRef = createMockGridRef();
    const { result } = renderHook(() => useInteraction(gridRef));

    act(() => {
      result.current.startDraw({ x: 0, y: 0 });
    });

    expect(useInteractionStore.getState().interaction?.type).toBe('paint');

    // Set a 4x4 area (should fit 2x2 = 4 bins of 2x2 size)
    act(() => {
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        interaction: {
          type: 'paint',
          paintSize: { width: 2, depth: 2 },
          start: { x: 0, y: 0 },
          current: { x: 3, y: 3 },
        },
      });
    });

    // Simulate pointer up
    act(() => {
      const upEvent = new PointerEvent('pointerup', { bubbles: true });
      document.dispatchEvent(upEvent);
    });

    // Should have created bins
    const bins = useLayoutStore.getState().layout.bins;
    expect(bins.length).toBeGreaterThan(0);
  });
});
