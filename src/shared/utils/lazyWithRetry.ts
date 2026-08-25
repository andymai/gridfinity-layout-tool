// eslint-disable-next-line no-restricted-imports -- this util is the one legitimate caller of React.lazy.
import { lazy, type ComponentType } from 'react';
import { recoverStaleBundle } from '@/shared/pwa/staleRecovery';

/**
 * Wraps a dynamic import with retry logic to handle chunk loading failures.
 *
 * This is common in PWAs where the service worker may cache stale HTML that
 * references chunk hashes that no longer exist after a deployment.
 *
 * On failure, it will:
 * 1. Retry the import up to `retries` times
 * 2. If all retries fail, recover onto the current build (once per session)
 *
 * Recovery has to go through {@link recoverStaleBundle} rather than a plain
 * `location.reload()`. The precache holds index.html and the boot graph, which
 * name the lazy chunk's hash; the chunk itself is deliberately left out of the
 * manifest (see `manifestTransforms` in vite.config.ts). So a stale precache
 * points at a hash the CDN no longer serves, and because the service worker
 * ships with `skipWaiting: false` / `clientsClaim: false` it keeps serving that
 * same precached pair across a reload, which comes back to the identical dead
 * hash. Dropping the precache and unregistering the worker first is what makes
 * the reload land on the current build.
 *
 * Note: Uses `ComponentType<never>` as the constraint because TypeScript's
 * type inference for lazy-loaded components requires the most permissive type.
 * The actual component props are preserved through the generic T parameter.
 *
 * @typeParam T - The component type, inferred from the import function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic constraint for React.lazy component type inference
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 2,
  recoverOnFinalFailure = true
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (error) {
        // Log the error for debugging
        console.warn(`Dynamic import failed (attempt ${attempt + 1}/${retries + 1}):`, error);

        if (attempt < retries) {
          // Wait a bit before retrying (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
          continue;
        }

        // A stale bundle is one condition for the whole tab, not one per chunk,
        // so the once-per-session guard belongs to the shared recovery rather
        // than to a key derived from this importFn.
        if (recoverOnFinalFailure && (await recoverStaleBundle('chunk_load_failure'))) {
          // Return a never-resolving promise while the page reloads
          return new Promise(() => {});
        }

        // Recovery was declined (already used this session, offline, or opted
        // out), so surface the failure to the nearest boundary.
        throw error;
      }
    }

    // TypeScript: This should never be reached
    throw new Error('Unexpected end of retry loop');
  });
}

/**
 * Helper to wrap named exports (components not exported as default).
 *
 * Usage:
 * ```ts
 * const HelpModal = lazyWithRetry(() =>
 *   import('./modals/HelpModal').then(namedExport('HelpModal'))
 * );
 * ```
 *
 * Note: Uses `any` in the module type because TypeScript cannot infer
 * the specific component props from a dynamic import's module object.
 *
 * @typeParam T - The component type to extract from the module
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ComponentType requires any for generic props */
export function namedExport(name: string) {
  return (module: Record<string, unknown>): { default: ComponentType<any> } => ({
    default: module[name] as ComponentType<any>,
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
