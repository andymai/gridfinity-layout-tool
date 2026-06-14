import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSettingsSearch } from './useSettingsSearch';

// Map the keys the test relies on to human strings; fall back to the key.
const STRINGS: Record<string, string> = {
  'settings.theme': 'Theme',
  'settings.printEstimates': 'Print Estimates',
  'settings.search.keywords.print': 'filament, nozzle, infill',
  'settings.tabs.print': 'Print & Material',
  'settings.tabs.appearance': 'Appearance',
};

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => STRINGS[key] ?? key,
}));

describe('useSettingsSearch', () => {
  it('returns no results for an empty query', () => {
    const { result } = renderHook(() => useSettingsSearch('   '));
    expect(result.current).toEqual([]);
  });

  it('matches by label prefix', () => {
    const { result } = renderHook(() => useSettingsSearch('theme'));
    expect(result.current.some((r) => r.id === 'theme')).toBe(true);
  });

  it('matches by keyword synonym not present in the label', () => {
    const { result } = renderHook(() => useSettingsSearch('filament'));
    const printResult = result.current.find((r) => r.id === 'print-estimates');
    expect(printResult).toBeDefined();
    expect(printResult?.tabLabel).toBe('Print & Material');
  });

  it('returns nothing for a non-matching query', () => {
    const { result } = renderHook(() => useSettingsSearch('zzzznomatch'));
    expect(result.current).toEqual([]);
  });
});
