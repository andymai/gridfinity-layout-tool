import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { dispatchSyntheticPopstate } from '@/shared/hooks/useDesignerRouting';
import { useDetailHistoryTrap } from './useDetailHistoryTrap';

function mockBackPoppingTrap() {
  // Simulates the browser: back() traverses and fires a real popstate.
  return vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

describe('useDetailHistoryTrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pushes a marker history entry without changing the URL', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const before = window.location.href;
    const { unmount } = renderHook(() => useDetailHistoryTrap(vi.fn()));
    expect(pushSpy).toHaveBeenCalledWith({ communityDetail: true }, '');
    expect(window.location.href).toBe(before);
    unmount();
  });

  it('invokes onBack when the trapped entry is popped', () => {
    const onBack = vi.fn();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useDetailHistoryTrap(onBack));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
    // Closed via pop: the cleanup must not pop a second entry.
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('consumes the trapped entry when closed by other means', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useDetailHistoryTrap(vi.fn()));
    unmount();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores app-synthetic popstate dispatches (pushState + re-fire)', () => {
    const onBack = vi.fn();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useDetailHistoryTrap(onBack));
    dispatchSyntheticPopstate();
    expect(onBack).not.toHaveBeenCalled();
    unmount();
    // Not consumed by the synthetic event: cleanup still pops the entry.
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('consumeTrap pops the entry first, then runs the continuation exactly once', () => {
    const onBack = vi.fn();
    const backSpy = mockBackPoppingTrap();
    const { result, unmount } = renderHook(() => useDetailHistoryTrap(onBack));
    const continuation = vi.fn(() => {
      // The pop must have happened before the continuation runs.
      expect(backSpy).toHaveBeenCalledTimes(1);
    });
    result.current(continuation);
    expect(continuation).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    unmount();
    // Already consumed: the cleanup must not pop a second entry.
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('does not pop a second entry when unmounted while a consume pop is in flight', () => {
    // back() that does NOT deliver its popstate synchronously: the unmount
    // lands in the window between consume() and the popstate event.
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useDetailHistoryTrap(vi.fn()));
    result.current(vi.fn());
    expect(backSpy).toHaveBeenCalledTimes(1);
    unmount();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the latest onBack callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { rerender, unmount } = renderHook(({ cb }) => useDetailHistoryTrap(cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
  });
});
