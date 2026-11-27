import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useYour2026Routing } from './useYour2026Routing';

describe('useYour2026Routing', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it.each(['/your-2026', '/your-2026/'])('is on the route at %s', (path) => {
    window.history.replaceState(null, '', path);
    expect(renderHook(() => useYour2026Routing()).result.current.isYour2026Route).toBe(true);
  });

  it('is not on the route elsewhere', () => {
    window.history.replaceState(null, '', '/your-2025');
    expect(renderHook(() => useYour2026Routing()).result.current.isYour2026Route).toBe(false);
  });

  it('navigates in with a query string, and home again', () => {
    const { result } = renderHook(() => useYour2026Routing());
    act(() => result.current.navigateToYour2026('?from=dock'));
    expect(window.location.pathname + window.location.search).toBe('/your-2026?from=dock');
    expect(result.current.isYour2026Route).toBe(true);

    act(() => result.current.navigateHome());
    expect(window.location.pathname).toBe('/');
    expect(result.current.isYour2026Route).toBe(false);
  });

  it('replaces its own history entry when it only redirects home', () => {
    window.history.replaceState(null, '', '/your-2026');
    const before = window.history.length;
    const { result } = renderHook(() => useYour2026Routing());
    act(() => result.current.replaceWithHome());
    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(before);
  });
});
