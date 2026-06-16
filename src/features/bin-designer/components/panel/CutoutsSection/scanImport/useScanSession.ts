/**
 * Desktop side of the phone-scan handoff.
 *
 * While active, opens a scan session, exposes its `/scan/<token>` URL (for the
 * QR code), and polls until the phone uploads a traced outline — then hands the
 * SVG to `onSvg`. Falls back to an `unavailable` phase when the backend can't
 * relay (e.g. no Redis), so the dialog can still offer manual upload.
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
    let delivered = false;
    const stopPolling = (): void => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    const poll = async (token: string): Promise<void> => {
      try {
        const res = await fetch(`/api/scan-session/${token}`, { signal });
        if (aborted()) return;
        if (res.status === 404) {
          stopPolling();
          // Don't flip to "expired" if the outline was already delivered (a late
          // in-flight poll can 404 once the session expires post-pickup).
          if (!delivered) setPhase('expired');
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; svg?: string };
        if (aborted()) return;
        if (data.status === 'ready' && data.svg && !delivered) {
          // Guard against overlapping polls delivering the (idempotent) result twice.
          delivered = true;
          stopPolling();
          onSvgRef.current(data.svg);
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
