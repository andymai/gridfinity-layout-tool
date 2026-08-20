import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, useEffect } from 'react';
import { render as renderComponent, act } from '@testing-library/react';
import { useCutoutWorkspaceCamera } from './useCutoutWorkspaceCamera';
import type { CutoutWorkspaceCamera } from './useCutoutWorkspaceCamera';
import { ZOOM_STEP } from '@/features/bin-designer/components/panel/CutoutsSection/renderer/constants';

/**
 * Drives the container size the hook measures. The global mock reports one
 * fixed rect; these tests need to change it mid-run to stand in for the split
 * divider being dragged.
 */
let resizeCallbacks: ResizeObserverCallback[] = [];
let containerRect = { width: 800, height: 400 };

class ControllableResizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeCallbacks.push(callback);
  }
  observe(): void {
    this.callback([{ contentRect: containerRect } as unknown as ResizeObserverEntry], this);
  }
  unobserve(): void {}
  disconnect(): void {}
}

function resizeContainerTo(width: number, height: number): void {
  containerRect = { width, height };
  for (const cb of resizeCallbacks) {
    cb([{ contentRect: containerRect } as unknown as ResizeObserverEntry], {
      observe: () => {},
      unobserve: () => {},
      disconnect: () => {},
    });
  }
}

/** A wheel event carrying a real delta, which the fixed-step version ignored. */
function wheel(deltaY: number, deltaMode = 0): React.WheelEvent<HTMLDivElement> {
  return {
    deltaY,
    deltaMode,
    clientX: 400,
    clientY: 200,
    preventDefault: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
    },
  } as unknown as React.WheelEvent<HTMLDivElement>;
}

const originalResizeObserver = window.ResizeObserver;

beforeEach(() => {
  resizeCallbacks = [];
  containerRect = { width: 800, height: 400 };
  window.ResizeObserver = ControllableResizeObserver;
});

afterEach(() => {
  window.ResizeObserver = originalResizeObserver;
});

/**
 * The hook measures a container it holds a ref to, and only observes one React
 * has already attached — so this mounts a real element rather than assigning
 * the ref after the fact, which would leave the observer unregistered and every
 * resize in these tests silently inert.
 */
const holder: { current: CutoutWorkspaceCamera | null } = { current: null };

function Harness({ w, d }: { readonly w: number; readonly d: number }) {
  const camera = useCutoutWorkspaceCamera(w, d);
  // Published from an effect, not during render: every read below happens
  // after an `act()` has flushed, so the value is current either way.
  useEffect(() => {
    holder.current = camera;
  });
  return createElement('div', { ref: camera.canvasContainerRef });
}

function render(binWidth = 100, binDepth = 50) {
  const view = renderComponent(createElement(Harness, { w: binWidth, d: binDepth }));
  return {
    result: {
      get current(): CutoutWorkspaceCamera {
        if (!holder.current) throw new Error('camera not published');
        return holder.current;
      },
    },
    rerender: (props: { w: number; d: number }) => view.rerender(createElement(Harness, props)),
  };
}

describe('useCutoutWorkspaceCamera — wheel zoom is proportional to the wheel', () => {
  it('moves exactly one step for a mouse notch', () => {
    // A fixed step per event was right for a mouse and stays right for one.
    const { result } = render();
    const before = result.current.zoom;
    act(() => result.current.handleWheel(wheel(-120)));
    expect(result.current.zoom / before).toBeCloseTo(ZOOM_STEP, 5);
  });

  it('moves a fraction of a step for a trackpad nudge', () => {
    // The reported overshoot: a two-finger flick is a stream of small deltas,
    // and each one used to be a full 1.25x.
    const { result } = render();
    const before = result.current.zoom;
    act(() => result.current.handleWheel(wheel(-10)));
    const ratio = result.current.zoom / before;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(ZOOM_STEP);
    expect(ratio).toBeCloseTo(Math.pow(ZOOM_STEP, 10 / 120), 5);
  });

  it('zooms out on a positive delta', () => {
    const { result } = render();
    const before = result.current.zoom;
    act(() => result.current.handleWheel(wheel(120)));
    expect(result.current.zoom / before).toBeCloseTo(1 / ZOOM_STEP, 5);
  });

  it('reads LINE deltas as lines, not pixels', () => {
    // Firefox reports ~3 lines per notch; as raw pixels that would be almost
    // no zoom at all, which is the mirror image of the trackpad bug.
    const { result } = render();
    const before = result.current.zoom;
    act(() => result.current.handleWheel(wheel(-3, 1)));
    expect(result.current.zoom / before).toBeCloseTo(Math.pow(ZOOM_STEP, 48 / 120), 5);
  });

  it('caps how far one event may travel', () => {
    const { result } = render();
    const before = result.current.zoom;
    act(() => result.current.handleWheel(wheel(-100_000)));
    expect(result.current.zoom / before).toBeLessThanOrEqual(Math.pow(ZOOM_STEP, 2) + 1e-6);
  });
});

describe('useCutoutWorkspaceCamera — a container resize is not a re-frame', () => {
  it('keeps the zoom and pan the user set when the canvas is resized', () => {
    // defaultZoom is derived from the container, so dragging the split divider
    // beside the canvas used to throw the framing away — the loop the issue
    // describes as "zooming repositions the view".
    const { result } = render();
    act(() => result.current.handleWheel(wheel(-120)));
    act(() => result.current.setCameraCenter({ x: 12, y: 34 }));
    const framed = { zoom: result.current.zoom, center: result.current.cameraCenter };

    act(() => resizeContainerTo(500, 400));

    expect(result.current.zoom).toBe(framed.zoom);
    expect(result.current.cameraCenter).toEqual(framed.center);
  });

  it('still auto-fits a resize while the user has not taken over', () => {
    // Both axes: the fit takes the smaller of the two, so growing one alone
    // leaves the other binding and the zoom unchanged.
    const { result } = render();
    const before = result.current.zoom;
    act(() => resizeContainerTo(1600, 800));
    expect(result.current.zoom).toBeGreaterThan(before);
  });

  it('re-frames when the bin itself changes', () => {
    // A different bin is a different subject; its old framing means nothing.
    const { result, rerender } = render(100, 50);
    act(() => result.current.setCameraCenter({ x: 12, y: 34 }));

    rerender({ w: 200, d: 80 });

    expect(result.current.cameraCenter).toEqual({ x: 100, y: 40 });
  });

  it('hands the view back to auto-fit on Fit to view', () => {
    const { result } = render();
    act(() => result.current.setCameraCenter({ x: 12, y: 34 }));
    act(() => result.current.fitToView());
    expect(result.current.cameraCenter).toEqual({ x: 50, y: 25 });

    const fitted = result.current.zoom;
    act(() => resizeContainerTo(1600, 800));
    expect(result.current.zoom).toBeGreaterThan(fitted);
  });

  it('treats the zoom buttons as taking over too', () => {
    const { result } = render();
    act(() => result.current.zoomIn());
    const zoomed = result.current.zoom;
    act(() => resizeContainerTo(1600, 800));
    expect(result.current.zoom).toBe(zoomed);
  });
});
