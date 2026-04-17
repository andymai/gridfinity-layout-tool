import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { useDoubleTapReset } from './useDoubleTapReset';

interface PointerStub {
  pointerId: number;
  pointerType?: string;
  isPrimary?: boolean;
  clientX?: number;
  clientY?: number;
  preventDefault?: () => void;
}

function pointerEvent(stub: PointerStub): PointerEvent {
  return {
    pointerId: stub.pointerId,
    pointerType: stub.pointerType ?? 'touch',
    isPrimary: stub.isPrimary ?? true,
    clientX: stub.clientX ?? 100,
    clientY: stub.clientY ?? 100,
    preventDefault: stub.preventDefault ?? (() => undefined),
  } as unknown as PointerEvent;
}

describe('useDoubleTapReset', () => {
  const onDoubleTap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(opts: { disabled?: boolean; windowMs?: number } = {}) {
    return renderHook(() => useDoubleTapReset({ onDoubleTap, ...opts }));
  }

  it('fires on two quick taps with the same finger', () => {
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    act(() => {
      vi.advanceTimersByTime(150);
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });

  it('fires on two quick taps even when the second uses a different pointerId', () => {
    // iOS Safari often assigns a new pointerId to each fresh touch.
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    act(() => {
      vi.advanceTimersByTime(150);
      result.current.onPointerDown(pointerEvent({ pointerId: 2 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 2 }));
    });
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });

  it('does NOT fire when a pinch gesture releases both fingers in quick succession', () => {
    // This is the core bug: two pointerups within 300ms from a pinch.
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerDown(pointerEvent({ pointerId: 2, isPrimary: false }));
      vi.advanceTimersByTime(5);
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
      vi.advanceTimersByTime(5);
      result.current.onPointerUp(pointerEvent({ pointerId: 2, isPrimary: false }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('does NOT fire when a three-finger gesture releases in sequence', () => {
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerDown(pointerEvent({ pointerId: 2, isPrimary: false }));
      result.current.onPointerDown(pointerEvent({ pointerId: 3, isPrimary: false }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 2, isPrimary: false }));
      result.current.onPointerUp(pointerEvent({ pointerId: 3, isPrimary: false }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('does NOT fire when the two taps are farther apart than the window', () => {
    const { result } = render({ windowMs: 300 });
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('does NOT fire when the first gesture is a drag (movement exceeds threshold)', () => {
    // Orbit rotation: pointer moves significantly between down and up.
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1, clientX: 100, clientY: 100 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1, clientX: 180, clientY: 120 }));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('does NOT fire when a single tap is held too long (long-press)', () => {
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      vi.advanceTimersByTime(600);
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('does NOT fire for mouse or pen events', () => {
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1, pointerType: 'mouse' }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1, pointerType: 'mouse' }));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.onPointerDown(pointerEvent({ pointerId: 1, pointerType: 'mouse' }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1, pointerType: 'mouse' }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('is a no-op when disabled', () => {
    const { result } = render({ disabled: true });
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('calls preventDefault on the second tap when firing', () => {
    // Parity with the old inline handler: prevent synthesized click / legacy
    // double-tap-zoom on the triggering pointerup event.
    const { result } = render();
    const firstPreventDefault = vi.fn();
    const secondPreventDefault = vi.fn();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(
        pointerEvent({ pointerId: 1, preventDefault: firstPreventDefault })
      );
    });
    act(() => {
      vi.advanceTimersByTime(150);
      result.current.onPointerDown(pointerEvent({ pointerId: 2 }));
      result.current.onPointerUp(
        pointerEvent({ pointerId: 2, preventDefault: secondPreventDefault })
      );
    });
    expect(onDoubleTap).toHaveBeenCalledOnce();
    expect(firstPreventDefault).not.toHaveBeenCalled();
    expect(secondPreventDefault).toHaveBeenCalledOnce();
  });

  it('recovers after a cancelled touch so subsequent taps still detect', () => {
    // Regression: without onPointerCancel, an interrupted touch leaves the
    // pointerId in the active set forever and disables double-tap detection.
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      // OS yanks the gesture — pointerup never arrives, pointercancel does.
      result.current.onPointerCancel(pointerEvent({ pointerId: 1 }));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.onPointerDown(pointerEvent({ pointerId: 2 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 2 }));
      vi.advanceTimersByTime(150);
      result.current.onPointerDown(pointerEvent({ pointerId: 3 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 3 }));
    });
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });

  it('clears state when the last of several pointers is cancelled mid-pinch', () => {
    const { result } = render();
    act(() => {
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerDown(pointerEvent({ pointerId: 2, isPrimary: false }));
      // First finger lifts normally, second is cancelled.
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
      result.current.onPointerCancel(pointerEvent({ pointerId: 2, isPrimary: false }));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.onPointerDown(pointerEvent({ pointerId: 3 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 3 }));
      vi.advanceTimersByTime(150);
      result.current.onPointerDown(pointerEvent({ pointerId: 4 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 4 }));
    });
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });

  it('fires after a pinch gesture is fully completed', () => {
    // User pinches (no reset), then double-taps (reset should fire fresh).
    const { result } = render();
    act(() => {
      // Pinch
      result.current.onPointerDown(pointerEvent({ pointerId: 1 }));
      result.current.onPointerDown(pointerEvent({ pointerId: 2, isPrimary: false }));
      result.current.onPointerUp(pointerEvent({ pointerId: 1 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 2, isPrimary: false }));
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
      // Now a real double-tap
      result.current.onPointerDown(pointerEvent({ pointerId: 3 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 3 }));
      vi.advanceTimersByTime(150);
      result.current.onPointerDown(pointerEvent({ pointerId: 4 }));
      result.current.onPointerUp(pointerEvent({ pointerId: 4 }));
    });
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });
});
