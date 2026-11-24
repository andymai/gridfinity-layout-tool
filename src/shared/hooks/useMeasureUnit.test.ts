import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSettingsStore } from '@/core/store';
import { useMeasureUnit } from './useMeasureUnit';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('useMeasureUnit', () => {
  afterEach(() => {
    useSettingsStore.getState().updateSetting('measureUnit', 'mm');
  });

  it('follows the measure unit setting, with the symbol from the translations', () => {
    const { result } = renderHook(() => useMeasureUnit());
    expect(result.current.unit).toBe('mm');
    expect(result.current.symbol).toBe('units.symbol.mm');
    expect(result.current.format(441.25)).toBe('441.25');
    act(() => {
      useSettingsStore.getState().updateSetting('measureUnit', 'in');
    });
    expect(result.current.unit).toBe('in');
    expect(result.current.symbol).toBe('units.symbol.in');
    expect(result.current.format(431.8)).toBe('17');
    expect(result.current.withUnit('Width')).toBe('common.labelWithUnit');
  });
});
