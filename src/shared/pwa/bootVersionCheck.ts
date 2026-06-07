/**
 * Proactive stale-bundle check at app boot.
 *
 * The service worker can keep serving an old precached shell after a deploy, so
 * the running bundle may be behind what's live. `version.json` is globIgnored
 * from the precache (always network-fresh) and reports the deployed build's git
 * SHA. If it disagrees with this bundle's compile-time `__GIT_SHA__`, we're
 * stale — self-heal to the latest build before the user hits a failure.
 *
 * Conservative by design: no-ops in dev/smoke, offline, when either SHA is
 * unknown, or on any fetch error. Recovery itself is one-shot per session.
 */

import { isSmokeMode } from '@/shared/utils/smokeMode';
import { recoverStaleBundle } from './staleRecovery';

interface VersionPayload {
  version: string;
  gitSha: string;
  buildTime: string;
}

export async function checkBootVersionFreshness(): Promise<void> {
  // Never self-reload inside the smoke iframe — it would abort the gate's probe.
  if (isSmokeMode()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  // Builds without git info can't be compared (tarball/detached builds).
  if (__GIT_SHA__ === 'unknown') return;

  let payload: VersionPayload;
  try {
    const res = await fetch('/version.json', { cache: 'reload' });
    if (!res.ok) return;
    payload = (await res.json()) as VersionPayload;
  } catch {
    // Offline / dev (no version.json) / network blip — nothing to do.
    return;
  }

  if (!payload.gitSha || payload.gitSha === 'unknown') return;

  if (payload.gitSha !== __GIT_SHA__) {
    void recoverStaleBundle('boot_version_mismatch');
  }
}
