import { SMOKE_MESSAGE_TYPE, type SmokeResultMessage } from '@/shared/utils/smokeMode';

/**
 * Per-attempt budget for the iframe phase only (load + fixture render +
 * postMessage). Activation runs once before the retry loop with its own budget.
 * Total worst-case wall time: ACTIVATE_TIMEOUT_MS + (1 + SMOKE_RETRIES) * SMOKE_ATTEMPT_TIMEOUT_MS.
 */
const SMOKE_ATTEMPT_TIMEOUT_MS = 10_000;

/** Activation alone (SKIP_WAITING → state=activated) shouldn't take more than this. */
const ACTIVATE_TIMEOUT_MS = 5_000;

/** Number of retries on transient iframe failures. Activation is not retried. */
const SMOKE_RETRIES = 1;

export interface SmokeGateResult {
  ok: boolean;
  reason?: string;
  /** Version reported by the iframe (i.e., the new bundle), if it got far enough. */
  version?: string;
  /** /version.json's reported version (i.e., what the deploy says is live). */
  expectedVersion?: string;
  durationMs: number;
  retries: number;
}

interface VersionPayload {
  version: string;
  gitSha: string;
  buildTime: string;
}

/**
 * Run the client-side update smoke test. Caller is responsible for checking the
 * PostHog flag + iOS bypass first; this function assumes those gates have passed.
 *
 * Sequence:
 *   1. Fetch /version.json from the parent context (the deploy's source of truth).
 *      Because `version.json` is globIgnored from the SW precache, this hits
 *      network/CDN and reflects the just-deployed asset graph.
 *   2. Send SKIP_WAITING to the waiting worker, then wait for `statechange` →
 *      `activated`. Do NOT use `controllerchange`: with `clientsClaim:false`
 *      the parent tab is never claimed and that event would never fire.
 *   3. Open a hidden iframe at `/?smoke=1`. With the new SW now active, the
 *      iframe's initial navigation is served by the new SW = new bundle.
 *   4. Listen for a postMessage from the iframe (with strict origin + source
 *      validation). Compare the iframe's compile-time gitSha to /version.json.
 *      Any mismatch is a stale-SW or asset-graph-mismatch failure.
 *
 * On failure the caller should `caches.delete()` the precache + `unregister()`.
 */
export async function runUpdateSmokeTest(
  registration: ServiceWorkerRegistration
): Promise<SmokeGateResult> {
  const start = performance.now();

  let expected: VersionPayload;
  try {
    const res = await fetch('/version.json', { cache: 'reload' });
    if (!res.ok) {
      return failure('version_fetch_failed', start, 0);
    }
    expected = (await res.json()) as VersionPayload;
  } catch {
    return failure('version_fetch_threw', start, 0);
  }

  const waiting = registration.waiting;
  if (!waiting) return failure('no_waiting_worker', start, 0, undefined, expected);

  try {
    await activateWaitingWorker(waiting);
  } catch (err) {
    return failure(`activate_failed:${asReason(err)}`, start, 0, undefined, expected);
  }

  for (let attempt = 0; attempt <= SMOKE_RETRIES; attempt++) {
    let result: IframeSmokeOutcome;
    try {
      result = await runIframeSmoke();
    } catch (err) {
      result = { ok: false, reason: `iframe_threw:${asReason(err)}` };
    }

    if (!result.ok) {
      // Retry only transient failures: iframe never reported (timeout) or the
      // iframe element failed to load (network/CSP). Do NOT retry
      // `iframe_reported:*` — the iframe loaded fine and deterministically said
      // smoke failed; another attempt will say the same thing.
      const isTransient = result.reason === 'timeout' || result.reason === 'iframe_load_error';
      if (isTransient && attempt < SMOKE_RETRIES) continue;
      return failure(result.reason, start, attempt, undefined, expected);
    }

    // Iframe booted and reported. Verify version matches the deployed source of truth.
    if (result.payload.gitSha !== expected.gitSha) {
      return failure('version_mismatch', start, attempt, result.payload.version, expected);
    }

    return {
      ok: true,
      version: result.payload.version,
      expectedVersion: expected.version,
      durationMs: performance.now() - start,
      retries: attempt,
    };
  }

  return failure('exhausted_retries', start, SMOKE_RETRIES, undefined, expected);
}

function failure(
  reason: string,
  start: number,
  retries: number,
  version?: string,
  expected?: VersionPayload | null
): SmokeGateResult {
  return {
    ok: false,
    reason,
    version,
    expectedVersion: expected?.version,
    durationMs: performance.now() - start,
    retries,
  };
}

function asReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Send SKIP_WAITING and wait for the worker to reach 'activated'. Times out so
 * a SW stuck in installing/activating can't hang the gate forever.
 */
function activateWaitingWorker(waiting: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    if (waiting.state === 'activated') {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      waiting.removeEventListener('statechange', onStateChange);
      reject(new Error(`activate_timeout:${waiting.state}`));
    }, ACTIVATE_TIMEOUT_MS);

    const onStateChange = (): void => {
      if (waiting.state === 'activated') {
        window.clearTimeout(timeoutId);
        waiting.removeEventListener('statechange', onStateChange);
        resolve();
      } else if (waiting.state === 'redundant') {
        window.clearTimeout(timeoutId);
        waiting.removeEventListener('statechange', onStateChange);
        reject(new Error('activate_redundant'));
      }
    };
    waiting.addEventListener('statechange', onStateChange);

    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (err) {
      window.clearTimeout(timeoutId);
      waiting.removeEventListener('statechange', onStateChange);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

type IframeSmokeOutcome = { ok: true; payload: VersionPayload } | { ok: false; reason: string };

/**
 * Spawn an offscreen iframe at `/?smoke=1` and wait for a structured smoke
 * result message back. Validates origin + source so a same-origin opener can't
 * spoof a pass. Cleans up the iframe and listener regardless of outcome.
 */
function runIframeSmoke(): Promise<IframeSmokeOutcome> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // No sandbox attribute set on purpose. We considered
    // `sandbox="allow-scripts allow-same-origin"`, but per the HTML spec that
    // combination is equivalent to no sandbox at all (the same-origin script
    // can call out to its parent and remove the sandbox via document mutation).
    // The iframe loads our own bundle from our own origin under our own SW,
    // so there's no security boundary a stricter sandbox could enforce. A
    // sandbox that omitted `allow-same-origin` would also break the smoke
    // boot, which uses localStorage for locale.
    iframe.style.position = 'absolute';
    iframe.style.width = '1280px';
    iframe.style.height = '720px';
    iframe.style.left = '-10000px';
    iframe.style.top = '-10000px';
    iframe.style.border = '0';
    iframe.src = '/?smoke=1';

    let settled = false;
    const finish = (outcome: IframeSmokeOutcome): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', onMessage);
      iframe.remove();
      resolve(outcome);
    };

    const timeoutId = window.setTimeout(
      () => finish({ ok: false, reason: 'timeout' }),
      SMOKE_ATTEMPT_TIMEOUT_MS
    );

    const onMessage = (event: MessageEvent): void => {
      // Strict source/origin gating — without these any same-origin window could spoof.
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframe.contentWindow) return;

      const data = event.data as Partial<SmokeResultMessage> | undefined;
      if (!data || data.type !== SMOKE_MESSAGE_TYPE) return;

      if (data.smokeOk === true && data.version && data.gitSha && data.buildTime) {
        finish({
          ok: true,
          payload: { version: data.version, gitSha: data.gitSha, buildTime: data.buildTime },
        });
      } else {
        finish({ ok: false, reason: `iframe_reported:${data.reason ?? 'unknown'}` });
      }
    };
    window.addEventListener('message', onMessage);

    iframe.addEventListener('error', () => finish({ ok: false, reason: 'iframe_load_error' }), {
      once: true,
    });

    document.body.appendChild(iframe);
  });
}
