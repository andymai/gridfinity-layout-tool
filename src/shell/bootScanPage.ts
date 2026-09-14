/**
 * Boot the `/scan/:token` phone-capture route, hardened against a failed chunk
 * load.
 *
 * The capture UI lives in its own lazy chunk (`scanBoot`) so the route never
 * pulls the editor, the 3D bundle, or the store hydration. But `#root` holds
 * only a `display:none` SEO fallback, so an unhandled rejection from that import
 * renders nothing and logs nothing — a silently blank page (#4275). A returning
 * phone can hit a stale precache after a deploy, or a flaky mobile connection
 * can drop the chunk fetch. This mirrors the hardening every other lazy entry
 * point already has (`lazyWithRetry`, the `wwwMigration` import in `main.tsx`).
 */
import { recoverStaleBundle } from '@/shared/pwa/staleRecovery';

/**
 * Import and run the scan boot chunk. On a chunk-load failure, reload onto fresh
 * chunks if the precache is stale; if recovery is skipped (offline, or already
 * tried this session — i.e. the failure is not a stale bundle) show a reload
 * prompt rather than leave the page blank.
 */
export async function bootScanPage(): Promise<void> {
  try {
    const { runScanBoot } = await import('./scanBoot');
    runScanBoot();
    return;
  } catch {
    // Fall through to recovery below.
  }

  const recovered = await recoverStaleBundle('scan_boot_chunk_load').catch(() => false);
  if (!recovered) showScanBootError();
}

/** Minimal, dependency-free reload prompt for a scan-page boot failure. */
export function showScanBootError(): void {
  const root = document.getElementById('root');
  if (!root) return;
  root.textContent = '';

  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'alert');
  wrap.className =
    'flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6 text-center text-content';

  const message = document.createElement('p');
  message.textContent = 'This page didn’t load. Check your connection and reload.';

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className =
    'rounded-lg border border-stroke-subtle bg-surface-elevated px-5 py-2.5 text-content';
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => window.location.reload());

  wrap.append(message, reload);
  root.append(wrap);
}
