import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import '@fontsource/press-start-2p/400.css';
import { useTranslation } from '@/i18n';
import { useLatestRef } from '@/shared/hooks';
import type { CreditsClock } from '../../utils/creditsClock';
import type { CreditsPlan } from '../../utils/creditsPlan';
import {
  buildRollSchedule,
  type MeasuredCredit,
  type RollSchedule,
} from '../../utils/rollSchedule';
import type { SupporterBin } from '../../utils/supportersData';
import { CreditItemView, type ItemContext } from './creditsRollItems';

/** Where credits are read, as a fraction of the region's height from the top. */
const READING_LINE = { side: 0.56, stacked: 0.62 };

const EDGE_FADE = 'linear-gradient(to bottom, transparent 0, #000 14%, #000 80%, transparent 100%)';

export interface CreditsRollProps {
  plan: CreditsPlan;
  binsById: Map<string, SupporterBin>;
  clock: CreditsClock;
  /** `scroll` is the reduced-motion page: nothing moves unless the visitor scrolls it. */
  mode: 'roll' | 'scroll';
  /** Phones: one column across the top instead of a column beside the plate. */
  stacked: boolean;
  baseSpeed: number;
  accent: string;
  /** Faded out for the finale, but kept in the document for screen readers. */
  hidden: boolean;
  focusedId: string | null;
  onSchedule: (schedule: RollSchedule) => void;
  onCredit: (binId: string) => void;
}

/**
 * The credits as real text: a list of departments, names and quotes that the
 * shared clock slides upward. The list is measured after layout (and again
 * whenever fonts or the viewport change its size), and those positions become
 * the schedule the plate and camera follow.
 */
export function CreditsRoll({
  plan,
  binsById,
  clock,
  mode,
  stacked,
  baseSpeed,
  accent,
  hidden,
  focusedId,
  onSchedule,
  onCredit,
}: CreditsRollProps) {
  const t = useTranslation();
  const regionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<RollSchedule | null>(null);
  const onScheduleRef = useLatestRef(onSchedule);

  useLayoutEffect(() => {
    const region = regionRef.current;
    const list = listRef.current;
    if (mode !== 'roll' || !region || !list) return;

    const measure = () => {
      const measured: MeasuredCredit[] = [];
      for (const el of list.querySelectorAll<HTMLElement>('[data-credit-id]')) {
        const id = el.dataset.creditId;
        if (id)
          measured.push({
            id,
            center: el.offsetTop + el.offsetHeight / 2,
            height: el.offsetHeight,
          });
      }
      const height = region.clientHeight;
      const schedule = buildRollSchedule(
        plan,
        binsById,
        measured,
        { height, readingLine: height * (stacked ? READING_LINE.stacked : READING_LINE.side) },
        baseSpeed
      );
      scheduleRef.current = schedule;
      onScheduleRef.current(schedule);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    observer.observe(list);
    return () => observer.disconnect();
  }, [mode, plan, binsById, stacked, baseSpeed, onScheduleRef]);

  useEffect(() => {
    const list = listRef.current;
    if (mode !== 'roll' || !list) {
      if (list) list.style.transform = '';
      return;
    }
    const follow = (c: CreditsClock) => {
      const schedule = scheduleRef.current;
      if (!schedule) return;
      list.style.transform = `translate3d(0, ${-schedule.timeline.offsetAt(c.time)}px, 0)`;
    };
    follow(clock);
    return clock.subscribe(follow);
  }, [clock, mode]);

  const ctx: ItemContext = useMemo(
    () => ({ binsById, t, accent, stacked, focusedId, hidden, onCredit }),
    [binsById, t, accent, stacked, focusedId, hidden, onCredit]
  );

  const placement = stacked
    ? 'inset-x-0 top-16 h-[calc(46%-4rem)]'
    : 'bottom-0 left-0 top-[72px] w-[min(44%,600px)] min-w-[340px]';

  return (
    <section
      ref={regionRef}
      aria-label={t('supporters.credits.listLabel')}
      className={`absolute z-20 ${placement} ${
        mode === 'scroll' ? 'overflow-y-auto' : 'overflow-hidden'
      } transition-opacity duration-700 ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={mode === 'roll' ? { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE } : undefined}
    >
      <div
        ref={listRef}
        className={`relative will-change-transform ${mode === 'scroll' ? 'pb-24 pt-20' : ''}`}
      >
        {plan.items.map((item) => (
          <div key={item.id} data-credit-id={item.id}>
            <CreditItemView item={item} ctx={ctx} />
          </div>
        ))}
      </div>
    </section>
  );
}
