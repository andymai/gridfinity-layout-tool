import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallsSection } from './useWallsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useWallsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns current wall thickness', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.wallThickness).toBe(1.2);
  });

  it('handleChange updates wall thickness in store', () => {
    const { result } = renderHook(() => useWallsSection());

    act(() => {
      result.current.handlers.handleChange(1.6);
    });

    expect(useDesignerStore.getState().params.wallThickness).toBe(1.6);
  });

  it('summary shows wall thickness with mm', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.meta.summary).toBe('1.2mm');
  });

  it('options contain translated descriptions', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.options.length).toBeGreaterThan(0);
    expect(result.current.state.options[0]).toHaveProperty('value');
    expect(result.current.state.options[0]).toHaveProperty('description');
  });

  it('initial state has honeycomb disabled', () => {
    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.honeycombEnabled).toBe(false);
  });

  it('toggleHoneycomb enables honeycomb walls', () => {
    const { result } = renderHook(() => useWallsSection());

    act(() => {
      result.current.handlers.toggleHoneycomb();
    });

    expect(useDesignerStore.getState().params.wallPattern.enabled).toBe(true);
  });

  it('toggleHoneycomb disables when already enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      },
    });

    const { result } = renderHook(() => useWallsSection());

    act(() => {
      result.current.handlers.toggleHoneycomb();
    });

    expect(useDesignerStore.getState().params.wallPattern.enabled).toBe(false);
  });

  it('honeycombDisabledReason set when all walls slotted', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      },
    });

    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.honeycombDisabledReason).toBe('All walls have divider slots');
  });

  it('honeycombPartialNote set when some walls slotted', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      },
    });

    const { result } = renderHook(() => useWallsSection());
    expect(result.current.state.honeycombPartialNote).toBe(
      'Walls with divider slots will keep solid walls'
    );
  });
});
