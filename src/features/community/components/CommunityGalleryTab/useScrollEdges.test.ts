// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollEdges } from './useScrollEdges';

function scroller({
  scrollWidth,
  clientWidth,
  scrollLeft = 0,
}: {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft?: number;
}): HTMLDivElement {
  const element = document.createElement('div');
  // jsdom lays nothing out, so the three numbers the hook reads are stubbed.
  Object.defineProperty(element, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(element, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(element, 'scrollLeft', {
    value: scrollLeft,
    writable: true,
    configurable: true,
  });
  document.body.appendChild(element);
  return element;
}

function edgesOf(element: HTMLDivElement) {
  return renderHook(() => useScrollEdges({ current: element }));
}

describe('useScrollEdges', () => {
  it('reports no edges when the content fits', () => {
    const { result } = edgesOf(scroller({ scrollWidth: 400, clientWidth: 400 }));
    expect(result.current).toEqual({ atStart: false, atEnd: false });
  });

  it('reports a trailing edge at the start of an overflowing scroller', () => {
    const { result } = edgesOf(scroller({ scrollWidth: 1200, clientWidth: 400 }));
    expect(result.current).toEqual({ atStart: false, atEnd: true });
  });

  it('reports both edges mid-scroll', () => {
    const element = scroller({ scrollWidth: 1200, clientWidth: 400, scrollLeft: 400 });
    const { result } = edgesOf(element);
    expect(result.current).toEqual({ atStart: true, atEnd: true });
  });

  it('drops the trailing edge once scrolled to the end', () => {
    const element = scroller({ scrollWidth: 1200, clientWidth: 400, scrollLeft: 800 });
    const { result } = edgesOf(element);
    expect(result.current).toEqual({ atStart: true, atEnd: false });
  });

  it('tolerates a fractional offset at the true end', () => {
    // A hair short of the end must not strand a fade over nothing.
    const element = scroller({ scrollWidth: 1200, clientWidth: 400, scrollLeft: 799.4 });
    const { result } = edgesOf(element);
    expect(result.current.atEnd).toBe(false);
  });

  it('re-measures on scroll', () => {
    const element = scroller({ scrollWidth: 1200, clientWidth: 400 });
    const { result } = edgesOf(element);
    expect(result.current.atStart).toBe(false);

    act(() => {
      element.scrollLeft = 500;
      element.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.atStart).toBe(true);
  });

  it('reads a negative RTL offset as distance travelled', () => {
    const element = scroller({ scrollWidth: 1200, clientWidth: 400, scrollLeft: -400 });
    const { result } = edgesOf(element);
    expect(result.current.atStart).toBe(true);
  });

  it('stays inert without an element', () => {
    const { result } = renderHook(() => useScrollEdges({ current: null }));
    expect(result.current).toEqual({ atStart: false, atEnd: false });
  });
});
