import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSettingsStore } from '@/core/store';
import { useMeasureUnit } from './useMeasureUnit';

describe('useMeasureUnit', () => {
  afterEach(() => {
    useSettingsStore.getState().updateSetting('measureUnit', 'mm');
  });

  it('follows the measure unit setting', () => {
    const { result } = renderHook(() => useMeasureUnit());
    expect(result.current).toEqual({ unit: 'mm', symbol: 'mm' });
    act(() => {
      useSettingsStore.getState().updateSetting('measureUnit', 'in');
    });
    expect(result.current).toEqual({ unit: 'in', symbol: 'in' });
  });
});
