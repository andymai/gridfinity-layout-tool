/**
 * Desktop side of the phone-scan handoff.
 *
 * While active, opens a scan session, exposes its `/scan/<token>` URL (for the
 * QR code), and polls continuously, handing each newly-uploaded outline to
 * `onSvg` (deduped by the record's `createdAt` so the same scan isn't ingested
 * twice). This lets the phone scan several tools against one session. Falls back
 * to an `unavailable` phase when the backend can't relay (e.g. no Redis), so the
 * dialog can still offer manual upload.
 */

import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 1500;

export type ScanSessionPhase = 'idle' | 'creating' | 'waiting' | 'unavailable' | 'expired';

export interface ScanSessionState {
  readonly phase: ScanSessionPhase;
  readonly url: string | null;
}

export function useScanSession(active: boolean, onSvg: (svg: string) => void): ScanSessionState {
  const [phase, setPhase] = useState<ScanSessionPhase>('idle');
  const [url, setUrl] = useState<string | null>(null);

  // Hold the latest callback in a ref so the effect depends only on `active`.
  const onSvgRef = useRef(onSvg);
  useEffect(() => {
    onSvgRef.current = onSvg;
  }, [onSvg]);

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const { signal } = controller;
    // Read through a function so control-flow analysis doesn't narrow it to a
    // constant `false` across the awaits below (it is flipped on cleanup).
    const aborted = (): boolean => signal.aborted;
    let interval: ReturnType<typeof setInterval> | null = null;
    // Keyed by createdAt so overlapping/out-of-order polls can't re-deliver an
    // already-seen outline; everDelivered covers the no-createdAt fallback.
    const deliveredStamps = new Set<string>();
    let everDelivered = false;
    const stopPolling = (): void => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    const poll = async (token: string): Promise<void> => {
      try {
        const res = await fetch(`/api/scan-session/${token}`, { signal });
        if (aborted()) return;
        if (res.status === 404) {
          // The session lives until its TTL; a 404 means it's gone, so reflect
          // that even after delivering — the QR is dead and can't take more.
          stopPolling();
          setPhase('expired');
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; svg?: string; createdAt?: string };
        if (aborted()) return;
        // Each new upload overwrites the record with a fresh createdAt; deliver
        // once per createdAt and keep polling so the phone can scan more. With no
        // createdAt (older API), fall back to delivering a single outline.
        if (data.status === 'ready' && data.svg) {
          const stamp = data.createdAt ?? null;
          const isNew = stamp ? !deliveredStamps.has(stamp) : !everDelivered;
          if (isNew) {
            if (stamp) deliveredStamps.add(stamp);
            everDelivered = true;
            onSvgRef.current(data.svg);
          }
        }
      } catch {
        // Aborted or a transient network blip — keep polling until cancelled.
      }
    };

    const start = async (): Promise<void> => {
      setUrl(null);
      setPhase('creating');
      try {
        const res = await fetch('/api/scan-session', { method: 'POST', signal });
        if (aborted()) return;
        if (!res.ok) {
          setPhase('unavailable');
          return;
        }
        const data = (await res.json()) as { token: string; url: string };
        if (aborted()) return;
        setUrl(data.url);
        setPhase('waiting');
        interval = setInterval(() => void poll(data.token), POLL_INTERVAL_MS);
      } catch {
        if (!aborted()) setPhase('unavailable');
      }
    };

    void start();

    return () => {
      controller.abort();
      stopPolling();
      // Reset so reopening doesn't briefly show the previous session's QR/link.
      setPhase('idle');
      setUrl(null);
    };
  }, [active]);

  return { phase, url };
}
