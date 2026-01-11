import { useEffect, useRef } from 'react';

/**
 * Preloads critical code chunks after the initial page load.
 *
 * This improves the offline experience by ensuring commonly-used components
 * are cached by the service worker before the user needs them. Uses
 * requestIdleCallback to avoid impacting initial load performance.
 *
 * Preloaded chunks:
 * - HelpModal: Opened via keyboard shortcut (?)
 * - IsometricPreview: 3D preview (V key)
 * - MobileLayout: For users who switch between devices
 */
export function useChunkPreloader(): void {
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (hasPreloaded.current) return;
    hasPreloaded.current = true;

    // Wait for idle time to preload chunks
    const preloadChunks = () => {
      // Use dynamic imports to trigger chunk loading
      // These are fire-and-forget - we don't need the result,
      // just need to trigger the network request so SW can cache them

      // Preload help modal (commonly accessed via ? shortcut)
      import('../components/modals/HelpModal').catch(() => {
        // Silently ignore preload failures - user can load on-demand
      });

      // Preload 3D preview (commonly accessed via V shortcut)
      // This is a larger chunk (Three.js), preload with lower priority
      setTimeout(() => {
        import('../components/Grid/IsometricPreview').catch(() => {
          // Silently ignore preload failures
        });
      }, 2000);
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preloadChunks, { timeout: 5000 });
    } else {
      // Fallback: wait 3 seconds after page load
      setTimeout(preloadChunks, 3000);
    }
  }, []);
}
