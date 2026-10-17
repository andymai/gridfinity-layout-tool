import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { usePlacesFindResults } from './usePlacesFindResults';

describe('usePlacesFindResults', () => {
  beforeEach(() => {
    resetAllStores();
    useLabsStore.getState().disableFeature('places');
  });

  it('gives the palette nothing while the places flag is off', () => {
    const { result } = renderHook(() => usePlacesFindResults(true));
    expect(result.current).toBeUndefined();
  });

  it('gives the palette a renderer once the flag is on', () => {
    useLabsStore.getState().enableFeature('places');
    const { result } = renderHook(() => usePlacesFindResults(true));
    expect(typeof result.current).toBe('function');
  });

  it('gives the palette nothing off the layout planner', () => {
    useLabsStore.getState().enableFeature('places');
    const { result } = renderHook(() => usePlacesFindResults(false));
    expect(result.current).toBeUndefined();
  });
});
