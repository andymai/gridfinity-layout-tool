import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';

const INK = '#c2410c';

interface DepartmentStampProps {
  department: string;
  /** Slam it down; otherwise it just sits there, already stamped. */
  animate: boolean;
}

export function DepartmentStamp({ department, animate }: DepartmentStampProps) {
  const t = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

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
      style={{ color: INK, borderColor: INK, transform: 'rotate(-6deg)' }}
    >
      <p className="text-micro font-semibold tracking-[0.2em] opacity-80">
        {t('supporters.panel.assignedTo')}
      </p>
      <p className="text-sm font-extrabold tracking-wider">{department}</p>
    </div>
  );
}
