import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLatestRef } from '@/shared/hooks';
import type { Blip } from '../audio/chipSynth';
import { CreditsSoundtrack, crossedAny } from '../audio/creditsSoundtrack';
import type { CreditsClock } from '../utils/creditsClock';
import type { RollSchedule } from '../utils/rollSchedule';

const TICK_MS = 25;
/** A clock step bigger than this between ticks is a scrub or a fast-forward, not a bin landing in time. */
const PLAYING_STEP = 0.06;
const SEAT_BLIP_GAP_MS = 80;

interface SoundtrackOptions {
  enabled: boolean;
  clock: CreditsClock;
  schedule: RollSchedule | null;
  rolling: boolean;
}

/**
 * The opt-in soundtrack. Nothing touches Web Audio until sound is turned on,
 * and browsers keep a context suspended until a user gesture, so a choice
 * remembered from an earlier visit starts on the first click or key.
 */
export function useCreditsSoundtrack({ enabled, clock, schedule, rolling }: SoundtrackOptions): {
  blip: (kind: Blip) => void;
} {
  const track = useRef<CreditsSoundtrack | null>(null);
  const rollingRef = useLatestRef(rolling);
  const seats = useMemo(
    () => Float64Array.from([...(schedule?.seatTimes.values() ?? [])].sort((a, b) => a - b)),
    [schedule]
  );
  const seatsRef = useLatestRef(seats);

  useEffect(() => {
    if (!enabled || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    track.current = new CreditsSoundtrack(ctx);
    const resume = () => void ctx.resume();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    resume();

    let previous = clock.time;
    let lastSeatBlip = 0;
    const timer = setInterval(() => {
      const current = track.current;
      if (!current) return;
      current.tick(clock.time, clock.rate, rollingRef.current);
      const step = clock.time - previous;
      const now = performance.now();
      if (
        step > 0 &&
        step < PLAYING_STEP &&
        now - lastSeatBlip > SEAT_BLIP_GAP_MS &&
        crossedAny(seatsRef.current, previous, clock.time)
      ) {
        current.blip('seat');
        lastSeatBlip = now;
      }
      previous = clock.time;
    }, TICK_MS);

    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      track.current = null;
      void ctx.close();
    };
  }, [enabled, clock, rollingRef, seatsRef]);

  const blip = useCallback((kind: Blip) => track.current?.blip(kind), []);
  return { blip };
}
