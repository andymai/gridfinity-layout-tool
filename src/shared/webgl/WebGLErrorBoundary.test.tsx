import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Component } from 'react';
import type { ReactNode } from 'react';
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@/shared/analytics/posthog', () => ({ captureException }));

import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { detectWebGL, resetWebGLDetectionCacheForTests } from './detectWebGL';

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
      <WebGLErrorBoundary>
        <div>canvas-content</div>
      </WebGLErrorBoundary>
    );
    expect(screen.getByText('canvas-content')).toBeInTheDocument();
  });

  it('renders the WebGL fallback (no retry) on a context-creation error', () => {
    render(
      <WebGLErrorBoundary>
        <Thrower message="Error creating WebGL context." />
      </WebGLErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('flips detectWebGL() to unavailable so the next render skips the canvas', () => {
    expect(detectWebGL().available).toBe(true);
    render(
      <WebGLErrorBoundary>
        <Thrower message="Error creating WebGL context." />
      </WebGLErrorBoundary>
    );
    const result = detectWebGL();
    expect(result.available).toBe(false);
    expect(result.reason).toBe('context-failed');
  });

  it('captures the context error explicitly, since the boundary swallows it', () => {
    render(
      <WebGLErrorBoundary>
        <Thrower message="Error creating WebGL context." />
      </WebGLErrorBoundary>
    );
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Error creating WebGL context.' }),
      { boundary: 'webgl' }
    );
  });

  it('routes a context that broke after the probe to the fallback, not the panel error', () => {
    // WebKit's wording for three.js reading `.precision` off a null
    // getShaderPrecisionFormat() result: the probe passed at startup and the
    // GPU process lost the context before this canvas mounted.
    const message =
      "null is not an object (evaluating 'e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision')";
    render(
      <Catcher>
        <WebGLErrorBoundary>
          <Thrower message={message} />
        </WebGLErrorBoundary>
      </Catcher>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('outer-caught')).not.toBeInTheDocument();
    const result = detectWebGL();
    expect(result.available).toBe(false);
    expect(result.reason).toBe('no-precision');
    expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ message }), {
      boundary: 'webgl',
    });
  });

  it('rethrows an unrelated precision null read, since only three.js earns the fallback', () => {
    render(
      <Catcher>
        <WebGLErrorBoundary>
          <Thrower message="Cannot read properties of null (reading 'precision')" />
        </WebGLErrorBoundary>
      </Catcher>
    );
    expect(screen.getByText('outer-caught')).toBeInTheDocument();
    expect(detectWebGL().available).toBe(true);
  });

  it('rethrows non-WebGL errors for an outer boundary to handle', () => {
    render(
      <Catcher>
        <WebGLErrorBoundary>
          <Thrower message="something unrelated blew up" />
        </WebGLErrorBoundary>
      </Catcher>
    );
    expect(screen.getByText('outer-caught')).toBeInTheDocument();
    // Detection must NOT be flipped by a non-WebGL error.
    expect(detectWebGL().available).toBe(true);
  });
});
