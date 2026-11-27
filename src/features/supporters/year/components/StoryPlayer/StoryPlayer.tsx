import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useCreditsClock } from '../../../hooks/useCreditsClock';
import type { YearCard } from '../../utils/yearCards';
import {
  buildTimeline,
  nextTime,
  positionAt,
  previousTime,
  startOf,
  type StoryPosition,
} from '../../utils/storyTimeline';
import { YearStage } from '../YearStage';

export interface StoryPlayerProps {
  readonly cards: readonly YearCard[];
  readonly initialIndex?: number;
  readonly accent: string;
  readonly onClose: () => void;
  /** Called once, when the last card first shows. */
  readonly onReachEnd: () => void;
  readonly renderCard: (card: YearCard, position: StoryPosition) => ReactNode;
}

/** A press shorter than this is a tap; longer is a hold that only pauses. */
const TAP_MS = 300;
const SWIPE_PX = 50;
const TAP_SLOP_PX = 10;

/** Inside the card, these handle their own pointer and key events. */
function ownsInput(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, a, input, [data-no-tap]') !== null;
}

function PauseIcon({ paused }: { readonly paused: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
    </svg>
  );
}

export function StoryPlayer({
  cards,
  initialIndex = 0,
  accent,
  onClose,
  onReachEnd,
  renderCard,
}: StoryPlayerProps) {
  const t = useTranslation();
  const timeline = useMemo(() => buildTimeline(cards.map((card) => card.duration)), [cards]);
  const ignoreEnd = useCallback(() => {}, []);
  const { clock, paused, setPaused } = useCreditsClock(true, ignoreEnd);
  const [time, setTime] = useState(() => startOf(timeline, initialIndex));
  const hiddenPause = useRef(false);
  const press = useRef<{ x: number; y: number; at: number; wasPaused: boolean } | null>(null);
  const reachedEnd = useRef(false);

  useEffect(() => {
    clock.setDuration(timeline.total);
    clock.seek(startOf(timeline, initialIndex));
    return clock.subscribe((c) => setTime(c.time));
  }, [clock, timeline, initialIndex]);

  const position = positionAt(timeline, time);
  const lastIndex = cards.length - 1;

  useEffect(() => {
    if (position.index !== lastIndex || reachedEnd.current) return;
    reachedEnd.current = true;
    onReachEnd();
  }, [position.index, lastIndex, onReachEnd]);

  const goNext = useCallback(() => clock.seek(nextTime(timeline, clock.time)), [clock, timeline]);
  const goPrevious = useCallback(
    () => clock.seek(previousTime(timeline, clock.time)),
    [clock, timeline]
  );
  const togglePause = useCallback(() => setPaused(!clock.isPaused), [clock, setPaused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (ownsInput(event.target) && (event.key === ' ' || event.key === 'Enter')) return;
      if (event.key === 'ArrowRight') goNext();
      else if (event.key === 'ArrowLeft') goPrevious();
      else if (event.key === ' ') togglePause();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrevious, togglePause, onClose]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && !clock.isPaused) {
        hiddenPause.current = true;
        setPaused(true);
      } else if (!document.hidden && hiddenPause.current) {
        hiddenPause.current = false;
        setPaused(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [clock, setPaused]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (ownsInput(event.target) || event.button !== 0) return;
    press.current = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      wasPaused: clock.isPaused,
    };
    clock.setPaused(true);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current;
    press.current = null;
    if (!start) return;
    clock.setPaused(start.wasPaused);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrevious();
      return;
    }
    const tap = performance.now() - start.at < TAP_MS && Math.hypot(dx, dy) < TAP_SLOP_PX;
    if (!tap) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left + box.width / 3) goPrevious();
    else goNext();
  };

  const onPointerCancel = () => {
    const start = press.current;
    press.current = null;
    if (start) clock.setPaused(start.wasPaused);
  };

  const card = cards.at(position.index);
  const pauseLabel = paused ? t('your2026.controls.play') : t('your2026.controls.pause');

  return (
    <YearStage
      accent={accent}
      onClose={onClose}
      header={
        <div className="flex gap-[0.3em]" aria-hidden="true">
          {cards.map((item, index) => (
            <div
              key={item.kind}
              className="h-[0.22em] flex-1 overflow-hidden rounded-full bg-white/20"
            >
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${(index < position.index ? 1 : index === position.index ? position.progress : 0) * 100}%`,
                }}
              />
            </div>
          ))}
        </div>
      }
      controls={
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={pauseLabel}
          title={pauseLabel}
          onClick={togglePause}
          className="text-white/80 hover:text-white"
        >
          <PauseIcon paused={paused} />
        </IconButton>
      }
    >
      <p className="sr-only">{t('your2026.controls.hint')}</p>
      <div
        className="flex min-h-0 flex-1 touch-pan-y select-none flex-col"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {card && (
          <section
            key={card.kind}
            aria-roledescription="slide"
            aria-label={t('your2026.controls.slide', {
              index: position.index + 1,
              total: cards.length,
            })}
            aria-live="polite"
            className="flex min-h-0 flex-1 flex-col"
          >
            {renderCard(card, position)}
          </section>
        )}
      </div>
    </YearStage>
  );
}
