import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useResolvedTheme } from '@/shared/hooks/useThemeEffect';
import { hasSeenStamp, markStampSeen } from '../../utils/creditsSeen';

/** Stamp-pad orange, light enough on the dark panel and dark enough on the light one for 4.5:1. */
const INK = { dark: '#fb923c', light: '#c2410c' };

/**
 * Slams down the first time it is actually shown in this browser, then just
 * sits there. Tracking display here, not in the panel, means closing the
 * panel before the status loads never uses the stamp up.
 */
export function DepartmentStamp({ department }: { department: string }) {
  const t = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const ink = INK[useResolvedTheme()];
  const ref = useRef<HTMLDivElement>(null);
  const [animate] = useState(() => !hasSeenStamp());

  useEffect(() => markStampSeen(), []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animate || reducedMotion || typeof el.animate !== 'function') return;
    const stamp = el.animate(
      [
        { transform: 'scale(2.4) rotate(-14deg)', opacity: 0 },
        { transform: 'scale(0.94) rotate(-7deg)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1) rotate(-6deg)', opacity: 1 },
      ],
      { duration: 420, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' }
    );
    return () => stamp.cancel();
  }, [animate, reducedMotion]);

  return (
    <div
      ref={ref}
      className="self-start rounded-sm border-[3px] border-double px-3 py-1.5 uppercase"
      style={{ color: ink, borderColor: ink, transform: 'rotate(-6deg)' }}
    >
      <p className="text-micro font-semibold tracking-[0.2em]">
        {t('supporters.panel.assignedTo')}
      </p>
      <p className="text-sm font-extrabold tracking-wider">{department}</p>
    </div>
  );
}
