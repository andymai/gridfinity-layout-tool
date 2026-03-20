import { lazy, type ComponentType } from 'react';

/**
 * Wraps a dynamic import with retry logic to handle chunk loading failures.
 *
 * This is common in PWAs where the service worker may cache stale HTML that
 * references chunk hashes that no longer exist after a deployment.
 *
 * On failure, it will:
 * 1. Retry the import up to `retries` times
 * 2. If all retries fail, reload the page (once) to get fresh assets
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
  reloadOnFinalFailure = true
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const sessionKey = `chunk-reload-${importFn.toString().slice(0, 100)}`;

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

        // All retries exhausted
        if (reloadOnFinalFailure && !sessionStorage.getItem(sessionKey)) {
          // Mark that we're reloading to prevent infinite reload loops
          sessionStorage.setItem(sessionKey, 'true');
          console.warn('All import retries failed, reloading page to fetch fresh assets...');
          window.location.reload();

          // Return a never-resolving promise while the page reloads
          return new Promise(() => {});
        }

        // Clear the reload marker for next time (if user navigates back)
        sessionStorage.removeItem(sessionKey);

        // Re-throw the error if we can't reload or already tried
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
