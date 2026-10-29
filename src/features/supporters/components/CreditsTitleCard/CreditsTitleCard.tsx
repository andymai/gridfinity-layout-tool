import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import type { CreditsClock } from '../../utils/creditsClock';
import { INTRO_SECONDS } from '../../utils/rollSchedule';
import { PIXEL_FONT } from '../CreditsRoll/creditsRollItems';

const TYPE_START = 0.5;
const CHARS_PER_SECOND = 22;
const NAME_IN = [3.7, 4.4] as const;
const COUNT_IN = [4.8, 5.6] as const;
const CARD_OUT = [INTRO_SECONDS - 0.9, INTRO_SECONDS] as const;

const ramp = (time: number, [from, to]: readonly [number, number]): number =>
  Math.min(1, Math.max(0, (time - from) / (to - from)));

interface TitleCardProps {
  clock: CreditsClock;
  count: number;
  accent: string;
}

/**
 * The game-over screen that opens the roll. Everything is a function of the
 * shared playhead, so scrubbing back retypes it. The visible text is written
 * through refs each frame; screen readers get the whole card at once.
 */
export function CreditsTitleCard({ clock, count, accent }: TitleCardProps) {
  const t = useTranslation();
  const lines = [t('supporters.credits.victoryLine1'), t('supporters.credits.victoryLine2')];
  const people =
    count === 1 ? t('supporters.credits.people.one') : t('supporters.credits.people.other');

  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const typedRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const restRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const caretRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [first, second] = lines;

  useEffect(() => {
    const texts = [first, second];
    const total = texts[0].length + texts[1].length;
    const draw = (c: CreditsClock) => {
      const typedCount = Math.floor(Math.max(0, c.time - TYPE_START) * CHARS_PER_SECOND);
      const activeLine = typedCount < total ? (typedCount < texts[0].length ? 0 : 1) : -1;
      let shown = typedCount;
      texts.forEach((text, i) => {
        const n = Math.min(text.length, shown);
        shown -= n;
        const typed = typedRefs.current[i];
        const rest = restRefs.current[i];
        if (typed && typed.textContent !== text.slice(0, n)) typed.textContent = text.slice(0, n);
        if (rest && rest.textContent !== text.slice(n)) rest.textContent = text.slice(n);
      });
      caretRefs.current.forEach((caret, i) => {
        if (caret) caret.style.opacity = i === activeLine ? '1' : '0';
      });
      if (nameRef.current) nameRef.current.style.opacity = String(ramp(c.time, NAME_IN));
      if (countRef.current) countRef.current.style.opacity = String(ramp(c.time, COUNT_IN));
      if (cardRef.current) {
        const out = ramp(c.time, CARD_OUT);
        cardRef.current.style.opacity = String(1 - out);
        cardRef.current.style.visibility = out >= 1 ? 'hidden' : 'visible';
      }
    };
    draw(clock);
    return clock.subscribe(draw);
  }, [clock, first, second]);

  return (
    <div
      ref={cardRef}
      className="pointer-events-none absolute inset-x-0 top-[12%] z-20 flex flex-col items-center px-6 text-center"
    >
      <p className="sr-only">
        {lines.join(' ')} {t('sidebar.appName')} {t('supporters.credits.madePossibleBy')} {count}{' '}
        {people}
      </p>
      <div aria-hidden="true" className="flex flex-col items-center">
        <div
          className="flex flex-col gap-3 text-sm uppercase leading-relaxed sm:text-lg"
          style={{ fontFamily: PIXEL_FONT, color: accent }}
        >
          {lines.map((_, i) => (
            <span key={i}>
              <span ref={(el) => void (typedRefs.current[i] = el)} />
              <span
                ref={(el) => void (caretRefs.current[i] = el)}
                className="ml-1 inline-block h-[1em] w-[0.6em] translate-y-[0.12em] bg-current motion-safe:animate-pulse"
              />
              <span ref={(el) => void (restRefs.current[i] = el)} className="invisible" />
            </span>
          ))}
        </div>
        <p
          ref={nameRef}
          className="mt-10 text-xs uppercase tracking-[0.3em] opacity-0 sm:text-sm"
          style={{ fontFamily: PIXEL_FONT }}
        >
          {t('sidebar.appName')}
        </p>
        <div ref={countRef} className="mt-6 flex flex-col items-center opacity-0">
          <span className="text-sm opacity-75">{t('supporters.credits.madePossibleBy')}</span>
          <span
            className="mt-2 text-6xl font-bold tabular-nums leading-none tracking-tighter sm:text-7xl"
            style={{ color: accent }}
          >
            {count}
          </span>
          <span className="mt-2 text-sm uppercase tracking-[0.28em] opacity-80">{people}</span>
        </div>
      </div>
    </div>
  );
}
