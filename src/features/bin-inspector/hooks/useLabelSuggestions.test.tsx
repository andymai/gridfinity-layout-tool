import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { binId, gridUnits } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import { useLabelSuggestions } from './useLabelSuggestions';

describe('useLabelSuggestions', () => {
  const target = createTestBin({ id: binId('t'), x: gridUnits(2), label: '' });
  const bins = [
    target,
    createTestBin({ id: binId('a'), x: gridUnits(0), label: 'M3 screws' }),
    createTestBin({ id: binId('b'), x: gridUnits(1), label: 'M4 screws' }),
  ];

  it('derives ranked suggestions and a ghost from the layout', () => {
    const { result } = renderHook(() => useLabelSuggestions(target, bins));
    expect(result.current.suggestions[0]?.value).toBe('M5 screws');
    expect(result.current.ghost?.value).toBe('M5 screws');
  });

  it('memoizes while inputs are referentially stable', () => {
    const { result, rerender } = renderHook(() => useLabelSuggestions(target, bins));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
