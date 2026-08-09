// Ambient globals attached to `window` at runtime by the boot, smoke, and
// dev-thumbnail paths. Declared here so the read/write sites stay type-safe
// without per-call casts. Kept a global script (no imports) so `interface
// Window` merges with lib.dom.

interface Window {
  /** Set by the inline www→canonical migration detector in index.html. */
  __wwwMigrationPending?: boolean;
  /** Build info published by SmokeReporter for Playwright to read back. */
  __SMOKE_BUILD_INFO__?: {
    version: string;
    gitSha: string;
    buildTime: string;
  };
  /** DevThumbnailRoute capture bridge (dev-only, gated by ?devThumbnails). */
  __thumbnailReady?: boolean;
  __captureThumbnail?: () => string | null;
  __exportGlb?: () => Promise<string | null>;
  __debugScene?: () => unknown;
  __setEdgeVisibility?: (visible: boolean) => number;
}
