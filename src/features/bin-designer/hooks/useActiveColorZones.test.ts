import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useActiveColorZones } from './useActiveColorZones';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useActiveColorZones', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('turns the Text zone on when text appears anywhere on the design', () => {
    const { result } = renderHook(() => useActiveColorZones());
    expect(result.current.has('text')).toBe(false);

    act(() => {
      const { params } = useDesignerStore.getState();
      useDesignerStore.setState({ params: { ...params, surfaceText: { walls: { front: 'AB' } } } });
    });
    expect(result.current.has('text')).toBe(true);
  });

  it('keeps the same set while unrelated params change', () => {
    const { result } = renderHook(() => useActiveColorZones());
    const before = result.current;
    act(() => {
      const { params } = useDesignerStore.getState();
      useDesignerStore.setState({ params: { ...params, height: params.height + 1 } });
    });
    expect(result.current).toBe(before);
  });
});
