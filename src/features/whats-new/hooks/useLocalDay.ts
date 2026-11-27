import { useEffect, useState } from 'react';
import { localDay, msUntilNextDay } from '../schedule';

/** Lands just past midnight, so the timer never reads the old day. */
const MIDNIGHT_MARGIN_MS = 1_000;

/**
 * The local day, refreshed at midnight and whenever the tab comes back into
 * view: a timer in a sleeping laptop or a background tab can fire late.
 */
export function useLocalDay(): string {
  const [day, setDay] = useState(localDay);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (): void => {
      setDay(localDay());
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilNextDay() + MIDNIGHT_MARGIN_MS);
    };
    timer = setTimeout(refresh, msUntilNextDay() + MIDNIGHT_MARGIN_MS);
    const onVisibility = (): void => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return day;
}
