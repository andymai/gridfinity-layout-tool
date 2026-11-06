import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureFlag, isFeatureEnabled } from '@/shared/hooks/useFeatureFlag';
import { useLabsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';

function storeFlag(enabled: boolean): void {
  useLabsStore.setState({
    preferences: {
      enabledFeatures: { show_generation_perf: enabled },
      lastModified: new Date().toISOString(),
      version: 1,
    },
  });
}

describe('useFeatureFlag', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('is off until the flag is stored as on', () => {
    const { result } = renderHook(() => useFeatureFlag('show_generation_perf'));
    expect(result.current).toBe(false);
  });

  it('follows the store when the flag is toggled', () => {
    const { result } = renderHook(() => useFeatureFlag('show_generation_perf'));

    act(() => storeFlag(true));
    expect(result.current).toBe(true);

    act(() => storeFlag(false));
    expect(result.current).toBe(false);
  });
});

describe('isFeatureEnabled', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('reads the stored flag at call time', () => {
    expect(isFeatureEnabled('show_generation_perf')).toBe(false);
    storeFlag(true);
    expect(isFeatureEnabled('show_generation_perf')).toBe(true);
  });
});
