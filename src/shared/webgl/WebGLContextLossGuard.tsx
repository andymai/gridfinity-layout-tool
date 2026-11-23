import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { CONTEXT_LOST_ERROR } from './detectWebGL';

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
 * when the context is not restored in time, this throws from render and lets
 * R3F hand the error to the boundary, which shows the fallback.
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
  const [lost, setLost] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const startGrace = (): void => {
      if (document.hidden) {
        document.addEventListener('visibilitychange', startGrace, { once: true });
        return;
      }
      timer = setTimeout(() => setLost(true), RESTORE_GRACE_MS);
    };
    const stopGrace = (): void => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', startGrace);
    };
    const onLost = (): void => {
      stopGrace();
      startGrace();
    };
    // A `frameloop="demand"` canvas draws nothing after the restore until
    // something invalidates it.
    const onRestored = (): void => {
      stopGrace();
      invalidate();
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      stopGrace();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [canvas, invalidate]);

  if (lost) throw new Error(CONTEXT_LOST_ERROR);
  return null;
}
