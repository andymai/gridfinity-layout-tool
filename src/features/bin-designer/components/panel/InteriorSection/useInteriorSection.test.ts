import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteriorSection } from './useInteriorSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useInteriorSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns standard style by default', () => {
    const { result } = renderHook(() => useInteriorSection());

    expect(result.current.state.style).toBe('standard');
    expect(result.current.state.isSlotted).toBe(false);
  });

  it('setStyle changes bin style', () => {
    const { result } = renderHook(() => useInteriorSection());

    act(() => {
      result.current.handlers.setStyle('slotted');
    });

    expect(useDesignerStore.getState().params.style).toBe('slotted');
  });

  it('summary shows compartment count for standard style', () => {
    const { result } = renderHook(() => useInteriorSection());

    // Default: 1×1 = 1 compartment
    expect(result.current.meta.summary).toContain('1');
  });

  it('summary shows removable text for slotted style', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'slotted' },
    });

    const { result } = renderHook(() => useInteriorSection());

    expect(result.current.meta.summary).toContain('Removable');
  });
});
