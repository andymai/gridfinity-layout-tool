import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { usePopoverPosition } from './usePopoverPosition';

const POPOVER_WIDTH = 320;

function fakeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  const base = {
    top: 100,
    bottom: 130,
    left: 800,
    right: 880,
    width: 80,
    height: 30,
    x: 800,
    y: 100,
  };
  return { ...base, ...overrides, toJSON: () => ({}) };
}

function setupHook(rect: DOMRect, viewport: { width: number; height: number }) {
  vi.stubGlobal('innerWidth', viewport.width);
  vi.stubGlobal('innerHeight', viewport.height);

  return renderHook(() => {
    const ref = useRef<HTMLElement>(null);
    if (ref.current === null) {
      const fakeEl = { getBoundingClientRect: () => rect } as HTMLElement;
      // Cast through unknown to assign to a readonly ref in tests; the hook
      // only needs the element to expose getBoundingClientRect.
      (ref as unknown as { current: HTMLElement | null }).current = fakeEl;
    }
    return usePopoverPosition(ref, POPOVER_WIDTH);
  });
}

describe('usePopoverPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when the anchor ref has no element', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(null);
      return usePopoverPosition(ref, POPOVER_WIDTH);
    });
    expect(result.current).toBeNull();
  });

  it('positions the popover below the anchor by default', () => {
    const { result } = setupHook(fakeRect({ bottom: 130, right: 880 }), {
      width: 1024,
      height: 768,
    });
    expect(result.current).toEqual({ top: 138, right: 144 });
  });

  it('clamps to viewport padding when the anchor sits at the right edge', () => {
    const { result } = setupHook(fakeRect({ right: 1020 }), { width: 1024, height: 768 });
    expect(result.current?.right).toBeGreaterThanOrEqual(16);
  });

  it('flips above when the popover would clip the bottom', () => {
    const { result } = setupHook(fakeRect({ top: 700, bottom: 730 }), { width: 1024, height: 768 });
    expect(result.current?.top).toBeLessThan(700);
  });

  it('clamps top to viewport padding when flipped above does not fit either', () => {
    const { result } = setupHook(fakeRect({ top: 50, bottom: 800 }), { width: 1024, height: 768 });
    expect(result.current?.top).toBeGreaterThanOrEqual(16);
  });

  it('recomputes position on window resize', () => {
    const { result } = setupHook(fakeRect({ bottom: 130, right: 880 }), {
      width: 1024,
      height: 768,
    });

    const initial = result.current;
    expect(initial).not.toBeNull();

    act(() => {
      vi.stubGlobal('innerWidth', 600);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).not.toEqual(initial);
  });
});
