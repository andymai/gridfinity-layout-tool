/**
 * scan-capture feature — public API.
 *
 * Exposes only the pure routing helpers. `ScanPage` is deliberately NOT
 * re-exported here: it pulls the in-browser tracer, and routing this barrel
 * through the eager `main.tsx` would drag that code into the main bundle. The
 * lazily-imported `scanBoot` chunk imports `ScanPage` from its module directly.
 */

export { isScanPath, getScanToken } from './scanRouting';
