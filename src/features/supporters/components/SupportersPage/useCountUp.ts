import { useEffect, useState } from 'react';

export function useCountUp(target: number, animate: boolean): number {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / 1600, 1);
      setAnimated(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return animate ? animated : target;
}
