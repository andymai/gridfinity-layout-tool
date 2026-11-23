import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const { captureException, state } = vi.hoisted(() => ({
  captureException: vi.fn(),
  state: { gl: { domElement: null as unknown as HTMLCanvasElement }, invalidate: vi.fn() },
}));
vi.mock('@/shared/analytics/posthog', () => ({ captureException }));
// jsdom has no WebGL, so the guard reads a stub R3F state.
vi.mock('@react-three/fiber', () => ({
  useThree: <T,>(selector: (s: typeof state) => T): T => selector(state),
}));

import { WebGLContextLossGuard, RESTORE_GRACE_MS } from './WebGLContextLossGuard';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { detectWebGL, resetWebGLDetectionCacheForTests } from './detectWebGL';

function renderGuard() {
  return render(
    <WebGLErrorBoundary>
      <WebGLContextLossGuard />
    </WebGLErrorBoundary>
  );
}

function fire(type: 'webglcontextlost' | 'webglcontextrestored'): void {
  act(() => {
    state.gl.domElement.dispatchEvent(new Event(type));
  });
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
}

describe('WebGLContextLossGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetWebGLDetectionCacheForTests();
    captureException.mockClear();
    state.invalidate.mockClear();
    state.gl.domElement = document.createElement('canvas');
    setHidden(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setHidden(false);
  });

  it('shows the fallback when a lost context is not restored in time', () => {
    renderGuard();
    fire('webglcontextlost');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(RESTORE_GRACE_MS);
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(detectWebGL()).toEqual({ available: false, reason: 'context-lost' });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('keeps the canvas and redraws it when the context is restored', () => {
    renderGuard();
    fire('webglcontextlost');
    fire('webglcontextrestored');
    act(() => {
      vi.advanceTimersByTime(RESTORE_GRACE_MS * 2);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(detectWebGL().available).toBe(true);
    expect(state.invalidate).toHaveBeenCalled();
  });

  it('waits for a background tab to come back before it starts the grace period', () => {
    renderGuard();
    setHidden(true);
    fire('webglcontextlost');
    act(() => {
      vi.advanceTimersByTime(RESTORE_GRACE_MS * 10);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    setHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    fire('webglcontextrestored');
    act(() => {
      vi.advanceTimersByTime(RESTORE_GRACE_MS);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(detectWebGL().available).toBe(true);
  });

  it('pauses the grace period while the tab is hidden and restarts it on return', () => {
    renderGuard();
    fire('webglcontextlost');
    act(() => {
      vi.advanceTimersByTime(RESTORE_GRACE_MS - 100);
    });
    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(RESTORE_GRACE_MS * 10);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    setHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(RESTORE_GRACE_MS - 100);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('ignores the context loss R3F forces after the canvas unmounts', () => {
    const { unmount } = renderGuard();
    unmount();
    fire('webglcontextlost');

    expect(vi.getTimerCount()).toBe(0);
  });
});
