import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Component } from 'react';
import type { ReactNode } from 'react';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { detectWebGL, resetWebGLDetectionCacheForTests } from './detectWebGL';

vi.mock('@/shared/analytics/posthog', () => ({
  track3DRenderError: vi.fn(),
}));

function Thrower({ message }: { message: string }): ReactNode {
  throw new Error(message);
}

/** Captures whether an error escaped WebGLErrorBoundary (i.e. was rethrown). */
class Catcher extends Component<{ children: ReactNode }, { caught: boolean }> {
  state = { caught: false };
  static getDerivedStateFromError() {
    return { caught: true };
  }
  render() {
    return this.state.caught ? <div>outer-caught</div> : this.props.children;
  }
}

describe('WebGLErrorBoundary', () => {
  beforeEach(() => {
    resetWebGLDetectionCacheForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <WebGLErrorBoundary component="designer">
        <div>canvas-content</div>
      </WebGLErrorBoundary>
    );
    expect(screen.getByText('canvas-content')).toBeInTheDocument();
  });

  it('renders the WebGL fallback (no retry) on a context-creation error', () => {
    render(
      <WebGLErrorBoundary component="designer">
        <Thrower message="Error creating WebGL context." />
      </WebGLErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('flips detectWebGL() to unavailable so the next render skips the canvas', () => {
    expect(detectWebGL().available).toBe(true);
    render(
      <WebGLErrorBoundary component="baseplate">
        <Thrower message="Error creating WebGL context." />
      </WebGLErrorBoundary>
    );
    const result = detectWebGL();
    expect(result.available).toBe(false);
    expect(result.reason).toBe('context-failed');
  });

  it('rethrows non-WebGL errors for an outer boundary to handle', () => {
    render(
      <Catcher>
        <WebGLErrorBoundary component="designer">
          <Thrower message="something unrelated blew up" />
        </WebGLErrorBoundary>
      </Catcher>
    );
    expect(screen.getByText('outer-caught')).toBeInTheDocument();
    // Detection must NOT be flipped by a non-WebGL error.
    expect(detectWebGL().available).toBe(true);
  });
});
