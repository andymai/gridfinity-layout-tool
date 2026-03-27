import { useState, useEffect, useRef } from 'react';

/** Track elapsed seconds during generation, returning null until 2s have passed. */
export function useGenerationElapsed(isGenerating: boolean): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (!isGenerating) return undefined;

    startRef.current = performance.now();

    const interval = setInterval(() => {
      const sec = Math.floor((performance.now() - startRef.current) / 1000);
      if (sec >= 2) setElapsed(sec);
    }, 500);

    return () => {
      clearInterval(interval);
      setElapsed(null);
    };
  }, [isGenerating]);

  return isGenerating ? elapsed : null;
}
