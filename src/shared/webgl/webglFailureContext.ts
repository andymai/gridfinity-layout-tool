import { createContext } from 'react';

/**
 * Lets `WebGLContextLossGuard` report a failure to `WebGLErrorBoundary`
 * without a throw. R3F reports every error that its own boundary catches to
 * `window.reportError`, so a throw from inside a `<Canvas>` reaches
 * posthog-js as a second capture.
 */
export const WebGLFailureContext = createContext<((error: Error) => void) | null>(null);
