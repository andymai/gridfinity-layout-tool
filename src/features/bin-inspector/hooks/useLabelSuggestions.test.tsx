import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Bin } from '@/core/types';
import { useLabelSuggestions } from './useLabelSuggestions';

function bin(overrides: Partial<Bin> & { id: string }): Bin {
  return {
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    layerId: 'L0',
    category: 'c1',
    label: '',
    notes: '',
    ...overrides,
  } as unknown as Bin;
}

describe('useLabelSuggestions', () => {
  const target = bin({ id: 't', x: 2, label: '' });
  const bins = [
    target,
    bin({ id: 'a', x: 0, label: 'M3 screws' }),
    bin({ id: 'b', x: 1, label: 'M4 screws' }),
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
