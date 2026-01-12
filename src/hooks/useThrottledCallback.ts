import { useRef, useCallback, useEffect } from 'react';

/**
 * Throttles a callback using requestAnimationFrame for optimal performance.
 * Ensures the callback is called at most once per frame (60fps).
 * 
 * This is ideal for pointer move handlers, scroll handlers, and other
 * high-frequency events where we want to sync updates with the browser's
 * repaint cycle.
 * 
 * @param callback - Function to throttle
 * @returns Throttled version of the callback
 */
export function useThrottledCallback<T extends unknown[]>(
  callback: (...args: T) => void
): (...args: T) => void {
  const rafIdRef = useRef<number | null>(null);
  const argsRef = useRef<T | null>(null);
  
  const throttledCallback = useCallback((...args: T) => {
    // Store the latest arguments
    argsRef.current = args;
    
    // If we already have a pending frame, don't schedule another
    if (rafIdRef.current !== null) {
      return;
    }
    
    // Schedule the callback to run on the next frame
    rafIdRef.current = requestAnimationFrame(() => {
      if (argsRef.current !== null) {
        callback(...argsRef.current);
        argsRef.current = null;
      }
      rafIdRef.current = null;
    });
  }, [callback]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);
  
  return throttledCallback;
}
