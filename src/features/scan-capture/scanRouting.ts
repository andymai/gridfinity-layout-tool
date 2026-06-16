/**
 * Pure path helpers for the `/scan/:token` capture route.
 *
 * Kept free of React and heavy imports so `main.tsx` can cheaply detect the
 * route and hand off to the isolated `scanBoot` chunk.
 */

// UUID v4 only — matches `isValidScanToken` and the `/scan/:token` Vercel rewrite,
// so invalid paths aren't treated as scan routes.
const SCAN_PATH_RE =
  /^\/scan\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

export function isScanPath(pathname: string = window.location.pathname): boolean {
  return SCAN_PATH_RE.test(pathname);
}

export function getScanToken(pathname: string = window.location.pathname): string | null {
  const match = pathname.match(SCAN_PATH_RE);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    // Malformed percent-encoding — fall back to the raw segment rather than throw.
    return match[1];
  }
}
