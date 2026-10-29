import { useCallback, useEffect, useState } from 'react';
import { CreditsClock } from '../utils/creditsClock';

/** Longest frame step, so a backgrounded tab does not leap the roll forward on return. */
const MAX_FRAME_SECONDS = 0.1;

export interface CreditsClockHandle {
  clock: CreditsClock;
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

export function useCreditsClock(running: boolean, onEnd: () => void): CreditsClockHandle {
  const [clock] = useState(() => new CreditsClock(0));
  const [paused, setPausedState] = useState(false);

  useEffect(() => clock.setEndHandler(onEnd), [clock, onEnd]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.advance(Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - last) / 1000)));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, running]);

  const setPaused = useCallback(
    (next: boolean) => {
      clock.setPaused(next);
      setPausedState(next);
    },
    [clock]
  );

  return { clock, paused, setPaused };
}
