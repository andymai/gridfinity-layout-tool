import { useEffect } from 'react';
import { useLatestRef } from '@/shared/hooks';
import { YearSoundtrack } from '../audio/yearSoundtrack';

const TICK_MS = 25;

/**
 * The opt-in Your 2026 tune. Nothing touches Web Audio until sound is on, and
 * a browser keeps a context suspended until a gesture, so a choice remembered
 * from an earlier visit starts on the first click or key.
 */
export function useYearSoundtrack(enabled: boolean, paused: boolean): void {
  const pausedRef = useLatestRef(paused);

  useEffect(() => {
    if (!enabled || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const track = new YearSoundtrack(ctx);
    const resume = () => void ctx.resume();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    resume();
    const timer = setInterval(() => track.tick(pausedRef.current), TICK_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      track.stop();
      void ctx.close();
    };
  }, [enabled, pausedRef]);
}
