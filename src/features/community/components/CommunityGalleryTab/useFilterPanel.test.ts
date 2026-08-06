// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRailOpen, useFilterPanel } from './useFilterPanel';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadRailOpen', () => {
  it('opens on a first visit', () => {
    expect(loadRailOpen()).toBe(true);
  });

  it('falls back to open when storage is unreadable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadRailOpen()).toBe(true);
  });
});

describe('useFilterPanel on desktop', () => {
  it('starts open and persists a collapse across mounts', () => {
    const first = renderHook(() => useFilterPanel(false));
    expect(first.result.current.open).toBe(true);
    act(() => first.result.current.toggle());
    expect(first.result.current.open).toBe(false);

    const second = renderHook(() => useFilterPanel(false));
    expect(second.result.current.open).toBe(false);
  });

  it('persists a re-open too', () => {
    const first = renderHook(() => useFilterPanel(false));
    act(() => first.result.current.close());
    act(() => first.result.current.toggle());
    expect(renderHook(() => useFilterPanel(false)).result.current.open).toBe(true);
  });

  it('survives a storage write failure without losing the session state', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const { result } = renderHook(() => useFilterPanel(false));
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });
});

describe('useFilterPanel when there is nothing to narrow', () => {
  it('reports closed without disturbing the rail preference', () => {
    const { result, rerender } = renderHook(({ available }) => useFilterPanel(false, available), {
      initialProps: { available: true },
    });
    expect(result.current.open).toBe(true);
    rerender({ available: false });
    expect(result.current.open).toBe(false);
    // The rail is a layout preference, so it comes back on its own once there
    // are cards again.
    rerender({ available: true });
    expect(result.current.open).toBe(true);
  });

  it('does not let the mobile view reopen on its own when filters return', () => {
    const { result, rerender } = renderHook(({ available }) => useFilterPanel(true, available), {
      initialProps: { available: true },
    });
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    // Narrowing to an empty set (an owner with nothing published) drops the
    // view; clearing that filter must not throw the visitor back into it.
    rerender({ available: false });
    expect(result.current.open).toBe(false);
    rerender({ available: true });
    expect(result.current.open).toBe(false);
  });
});

describe('useFilterPanel on mobile', () => {
  it('starts closed regardless of the stored rail preference', () => {
    localStorage.setItem('gridfinity-community-filter-rail-v1', 'open');
    const { result } = renderHook(() => useFilterPanel(true));
    expect(result.current.open).toBe(false);
  });

  it('opens and closes without persisting anything', () => {
    const { result } = renderHook(() => useFilterPanel(true));
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    expect(localStorage.getItem('gridfinity-community-filter-rail-v1')).toBeNull();
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it('keeps the transient mobile view out of the persisted rail state', () => {
    const { result, rerender } = renderHook(({ mobile }) => useFilterPanel(mobile), {
      initialProps: { mobile: true },
    });
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    // Crossing the breakpoint falls back to the rail preference, still open by
    // default, rather than inheriting the mobile view's state.
    rerender({ mobile: false });
    expect(result.current.open).toBe(true);
  });

  it('does not bring the mobile view back after a round trip across the breakpoint', () => {
    const { result, rerender } = renderHook(({ mobile }) => useFilterPanel(mobile), {
      initialProps: { mobile: true },
    });
    act(() => result.current.toggle());
    rerender({ mobile: false });
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    // Back at mobile width the grid stays on screen: the filter view is a
    // navigation state, and nothing navigated to it.
    rerender({ mobile: true });
    expect(result.current.open).toBe(false);
  });
});
