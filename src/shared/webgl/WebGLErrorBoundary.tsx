import { Component } from 'react';
import type { ReactNode } from 'react';
import { markWebGLUnavailable } from './detectWebGL';
import { WebGLFallback } from './WebGLFallback';

/** Substring of the error three.js throws when it can't acquire a GL context. */
const WEBGL_CONTEXT_ERROR = 'Error creating WebGL context';

interface Props {
  children: ReactNode;
  /** Identifies the viewport in telemetry (e.g. "designer", "baseplate"). */
  component: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches the synchronous `Error creating WebGL context.` that three.js throws
 * when the real `<Canvas>` can't acquire a GL context even though the cached
 * `detectWebGL()` probe passed — context-slot exhaustion across the app's
 * several canvases, or a GPU-process loss between probe and render.
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
    if (error.message.includes(WEBGL_CONTEXT_ERROR)) {
      markWebGLUnavailable('context-failed');
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (error.message.includes(WEBGL_CONTEXT_ERROR)) {
        return <WebGLFallback reason="context-failed" component={this.props.component} />;
      }
      // Not a WebGL-context failure — re-throw from render() so React unwinds to
      // the outer PanelErrorBoundary. This delegation is exercised by the
      // "rethrows non-WebGL errors" test; keep that test if you touch this.
      throw error;
    }
    return this.props.children;
  }
}
