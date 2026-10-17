import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import { usePlacesFindResults } from './usePlacesFindResults';

describe('usePlacesFindResults', () => {
  beforeEach(() => {
    useLabsStore.getState().disableFeature('places');
  });

  it('gives the palette nothing while the places flag is off', () => {
    const { result } = renderHook(() => usePlacesFindResults());
    expect(result.current).toBeUndefined();
  });

  it('gives the palette a renderer once the flag is on', () => {
    useLabsStore.getState().enableFeature('places');
    const { result } = renderHook(() => usePlacesFindResults());
    expect(typeof result.current).toBe('function');
  });
});
