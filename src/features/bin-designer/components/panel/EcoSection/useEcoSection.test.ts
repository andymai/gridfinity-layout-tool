import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEcoSection } from './useEcoSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useEcoSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns initial state with all features off', () => {
    const { result } = renderHook(() => useEcoSection());

    expect(result.current.state.activeCount).toBe(0);
    expect(result.current.state.savingsPercent).toBe(0);
    expect(result.current.meta.summary).toBe('Off');
  });

  it('toggles honeycomb floor', () => {
    const { result } = renderHook(() => useEcoSection());

    act(() => {
      result.current.handlers.toggleHoneycombFloor();
    });

    expect(result.current.state.eco.honeycombFloor.enabled).toBe(true);
    expect(result.current.state.activeCount).toBe(1);
  });

  it('toggles honeycomb walls', () => {
    const { result } = renderHook(() => useEcoSection());

    act(() => {
      result.current.handlers.toggleHoneycombWall();
    });

    expect(result.current.state.eco.honeycombWall.mode).toBe('pocketed');
    expect(result.current.state.activeCount).toBe(1);
  });

  it('toggles wave walls and disables honeycomb walls', () => {
    const { result } = renderHook(() => useEcoSection());

    // First enable honeycomb walls
    act(() => {
      result.current.handlers.toggleHoneycombWall();
    });
    expect(result.current.state.eco.honeycombWall.mode).toBe('pocketed');

    // Enable wave walls — should disable honeycomb walls
    act(() => {
      result.current.handlers.toggleSinusoidalWall();
    });

    expect(result.current.state.eco.sinusoidalWall.enabled).toBe(true);
    expect(result.current.state.eco.honeycombWall.mode).toBe('none');
  });

  it('applies eco preset', () => {
    const { result } = renderHook(() => useEcoSection());

    act(() => {
      result.current.handlers.applyEcoPreset();
    });

    const params = useDesignerStore.getState().params;
    expect(params.wallThickness).toBe(0.8);
    expect(params.eco.honeycombFloor.enabled).toBe(true);
    expect(params.eco.honeycombWall.mode).toBe('pocketed');
  });

  it('computes savings when features active', () => {
    const { result } = renderHook(() => useEcoSection());

    act(() => {
      result.current.handlers.toggleHoneycombFloor();
    });

    expect(result.current.state.savingsPercent).toBeGreaterThan(0);
  });

  it('summary shows feature names when active', () => {
    const { result } = renderHook(() => useEcoSection());

    act(() => {
      result.current.handlers.toggleHoneycombFloor();
    });

    expect(result.current.meta.summary).toContain('Floor');
  });
});
