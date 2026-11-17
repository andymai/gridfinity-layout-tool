import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLabelsRouting } from './useLabelsRouting';

describe('useLabelsRouting', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it.each(['/labels', '/labels/'])('is on the labels route at %s', (path) => {
    window.history.replaceState(null, '', path);
    expect(renderHook(() => useLabelsRouting()).result.current.isLabelsRoute).toBe(true);
  });

  it('is not on the labels route elsewhere', () => {
    window.history.replaceState(null, '', '/labels-guide');
    expect(renderHook(() => useLabelsRouting()).result.current.isLabelsRoute).toBe(false);
  });

  it('follows back and forward navigation', () => {
    const { result } = renderHook(() => useLabelsRouting());
    expect(result.current.isLabelsRoute).toBe(false);

    act(() => {
      window.history.pushState(null, '', '/labels');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.isLabelsRoute).toBe(true);
  });
});
