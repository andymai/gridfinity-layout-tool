import { Component } from 'react';
import type { ReactNode } from 'react';
import { captureException } from '@/shared/analytics/posthog';
import { markWebGLUnavailable, webglFailureReason } from './detectWebGL';
import { WebGLFallback } from './WebGLFallback';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches the synchronous throw from three.js when the real `<Canvas>` can't
 * use a GL context even though the cached `detectWebGL()` probe passed:
 * `Error creating WebGL context.` from context-slot exhaustion across the
 * app's several canvases, or the `getShaderPrecisionFormat` null read from a
 * context the GPU process lost between probe and render.
 *
 * It flips detection to unavailable and renders the `WebGLFallback` WITHOUT a
 * retry affordance: re-mounting the canvas would just re-throw, which is the
 * source of the rapid `Error creating WebGL context.` bursts in telemetry.
 * Non-WebGL errors are rethrown so the outer `PanelErrorBoundary` handles them.
 */
export class WebGLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    const reason = webglFailureReason(error.message);
    if (reason !== null) {
      // Boundary-caught render throws don't reach window.onerror, so this
      // explicit capture is the path's only telemetry. It must run before
      // markWebGLUnavailable: the exception filter drops WebGL-context
      // captures once detection reads unavailable.
      captureException(error, { boundary: 'webgl' });
      markWebGLUnavailable(reason);
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (webglFailureReason(error.message) !== null) {
        return <WebGLFallback />;
      }
      // Not a WebGL-context failure — re-throw from render() so React unwinds to
      // the outer PanelErrorBoundary. This delegation is exercised by the
      // "rethrows non-WebGL errors" test; keep that test if you touch this.
      throw error;
    }
    return this.props.children;
  }
}
