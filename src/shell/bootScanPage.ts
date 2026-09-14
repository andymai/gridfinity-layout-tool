/**
 * Boot the `/scan/:token` phone-capture route, hardened against a failed chunk
 * load.
 *
 * `#root` holds only a `display:none` SEO fallback, so an unhandled rejection
 * from the lazy `scanBoot` import renders nothing and logs nothing — a silently
 * blank page (#4275). A returning phone can hit a stale precache after a deploy,
 * or a flaky mobile connection can drop the chunk fetch. Every other lazy entry
 * point is already hardened this way (`lazyWithRetry`, `main.tsx`'s
 * `wwwMigration` import); this one was the gap.
 */
import { recoverStaleBundle } from '@/shared/pwa/staleRecovery';
import type * as ScanBoot from './scanBoot';

export async function bootScanPage(): Promise<void> {
  let scanBoot: typeof ScanBoot;
  try {
    scanBoot = await import('./scanBoot');
  } catch {
    // The chunk failed to load — most likely a stale precache after a deploy.
    // Reload onto fresh chunks; if recovery is skipped (offline, or already
    // tried this session) fall back to a prompt rather than a blank page.
    const recovered = await recoverStaleBundle('scan_boot_chunk_load').catch(() => false);
    if (!recovered) showScanBootError();
    return;
  }

  // The chunk loaded, so a throw here is a real boot error, not a stale bundle:
  // show the prompt directly rather than clearing caches and reloading.
  try {
    scanBoot.runScanBoot();
  } catch {
    showScanBootError();
  }
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
