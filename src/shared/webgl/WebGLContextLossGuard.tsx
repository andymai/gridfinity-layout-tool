import { useContext, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { CONTEXT_LOST_ERROR } from './detectWebGL';
import { WebGLFailureContext } from './webglFailureContext';

/**
 * How long a lost context has to come back before the fallback replaces the
 * canvas. three.js calls `preventDefault()` on the loss, so the browser may
 * restore it, and three.js then rebuilds its GL state by itself.
 */
export const RESTORE_GRACE_MS = 3000;

/**
 * Mount inside a `<Canvas>` that sits under a `WebGLErrorBoundary`. A context
 * loss throws nothing in React: three.js silently stops drawing, and any frame
 * already queued throws from the render loop, out of reach of the boundary. So
 * when the context is not restored in time, this reports the loss to the
 * boundary, which shows the fallback.
 *
 * The grace period waits for a visible page, because Safari drops the context
 * of a background tab and restores it when the tab comes back.
 *
 * R3F calls `forceContextLoss()` when the canvas unmounts. The listeners are
 * gone by then, because R3F flushes effect cleanups first.
 */
export function WebGLContextLossGuard(): null {
  const canvas = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const fail = useContext(WebGLFailureContext);

  useEffect(() => {
    if (!fail) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lost = false;

    const syncGrace = (): void => {
      clearTimeout(timer);
      timer = undefined;
      if (lost && !document.hidden) {
        timer = setTimeout(() => fail(new Error(CONTEXT_LOST_ERROR)), RESTORE_GRACE_MS);
      }
    };
    const onLost = (): void => {
      lost = true;
      syncGrace();
    };
    // A `frameloop="demand"` canvas draws nothing after the restore until
    // something invalidates it.
    const onRestored = (): void => {
      lost = false;
      syncGrace();
      invalidate();
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', syncGrace);
    return () => {
      clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', syncGrace);
    };
  }, [canvas, invalidate, fail]);

  return null;
}
