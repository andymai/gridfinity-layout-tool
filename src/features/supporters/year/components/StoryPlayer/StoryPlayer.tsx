import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useCreditsClock } from '../../../hooks/useCreditsClock';
import { BEAT } from '../../look/motion';
import { STAGE_COLOURS, cardColours } from '../../look/palettes';
import { DISSOLVE_BEATS, ENTRANCE_BEATS, type YearCard } from '../../utils/yearCards';
import {
  buildTimeline,
  nextTime,
  positionAt,
  previousTime,
  startOf,
  transitionAt,
  type StoryPosition,
} from '../../utils/storyTimeline';
import { CardFrame } from '../CardFrame';
import { TileFill } from '../TileFill';
import { YearStage } from '../YearStage';

export interface StoryPlayerProps {
  readonly cards: readonly YearCard[];
  readonly initialIndex?: number;
  readonly reducedMotion?: boolean;
  readonly onClose: () => void;
  /** Called once, when the last card first shows. */
  readonly onReachEnd: () => void;
  /** Called each time a different card shows. */
  readonly onCardChange?: (card: YearCard) => void;
  /** Called once a card's entrance has finished, when it is ready to share. */
  readonly onCardSettled?: (card: YearCard) => void;
  /** Called when the viewer pauses or resumes; a held press is not a pause. */
  readonly onPausedChange?: (paused: boolean) => void;
  /** Controls beside the pause button, such as the sound toggle. */
  readonly extraControls?: ReactNode;
  /**
   * The card in its 1080 × 1920 layout. `entering` is true while the first
   * card's colour fills the empty stage, before the card shows.
   */
  readonly renderCard: (card: YearCard, position: StoryPosition, entering: boolean) => ReactNode;
  /**
   * The card's final words, announced once when it shows. The card itself
   * counts its numbers up, which a live region would read frame by frame.
   */
  readonly describeCard?: (card: YearCard) => string;
}

const ENTRANCE_S = ENTRANCE_BEATS * BEAT;
const DISSOLVE_S = DISSOLVE_BEATS * BEAT;
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
  reducedMotion = false,
  onClose,
  onReachEnd,
  onCardChange,
  onCardSettled,
  onPausedChange,
  extraControls,
  renderCard,
  describeCard,
}: StoryPlayerProps) {
  const t = useTranslation();
  const timeline = useMemo(
    () =>
      buildTimeline(
        cards.map((card) => card.duration),
        ENTRANCE_S
      ),
    [cards]
  );
  // The first card arrives as a fill of its colour on an empty stage; a story
  // opened on a later card cuts straight to it.
  const openAt = initialIndex === 0 ? 0 : startOf(timeline, initialIndex);
  const ignoreEnd = useCallback(() => {}, []);
  const { clock, paused, setPaused } = useCreditsClock(true, ignoreEnd);
  const [time, setTime] = useState(openAt);
  const hiddenPause = useRef(false);
  const press = useRef<{
    pointerId: number;
    x: number;
    y: number;
    at: number;
    wasPaused: boolean;
  } | null>(null);
  const reachedEnd = useRef(false);

  useEffect(() => {
    clock.setDuration(timeline.total);
    clock.seek(openAt);
    return clock.subscribe((c) => setTime(c.time));
  }, [clock, timeline, openAt]);

  const position = positionAt(timeline, time);
  const lastIndex = cards.length - 1;

  useEffect(() => {
    if (position.index !== lastIndex || reachedEnd.current) return;
    reachedEnd.current = true;
    onReachEnd();
  }, [position.index, lastIndex, onReachEnd]);

  const card = cards.at(position.index);
  useEffect(() => {
    if (card) onCardChange?.(card);
  }, [card, onCardChange]);
  const settledNow = card !== undefined && position.elapsed >= card.settle - 0.01;
  useEffect(() => {
    if (card && settledNow) onCardSettled?.(card);
  }, [card, settledNow, onCardSettled]);

  useEffect(() => {
    onPausedChange?.(paused);
  }, [paused, onPausedChange]);

  // A paused step lands where the card has settled; at its start the entrance
  // has not run, and the card would sit empty until play resumes.
  const settled = useCallback(
    (index: number) => startOf(timeline, index) + (cards.at(index)?.settle ?? 0),
    [timeline, cards]
  );
  const goNext = useCallback(() => {
    const { index } = positionAt(timeline, clock.time);
    if (clock.isPaused && index < timeline.starts.length - 1) clock.seek(settled(index + 1));
    else clock.seek(nextTime(timeline, clock.time));
  }, [clock, timeline, settled]);
  const goPrevious = useCallback(() => {
    const { index } = positionAt(timeline, clock.time);
    if (clock.isPaused) clock.seek(settled(Math.max(0, index - 1)));
    else clock.seek(previousTime(timeline, clock.time));
  }, [clock, timeline, settled]);
  const togglePause = useCallback(() => setPaused(!clock.isPaused), [clock, setPaused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (ownsInput(event.target) && (event.key === ' ' || event.key === 'Enter')) return;
      // A held Space repeats keydown; only the first press toggles.
      if (event.key === ' ' && event.repeat) {
        event.preventDefault();
        return;
      }
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
    // One press at a time: a second finger must not take over the first.
    if (press.current || ownsInput(event.target) || event.button !== 0) return;
    // Capture, so a press dragged off the card still ends here and resumes.
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      wasPaused: clock.isPaused,
    };
    clock.setPaused(true);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current;
    if (start?.pointerId !== event.pointerId) return;
    press.current = null;
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

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current;
    if (start?.pointerId !== event.pointerId) return;
    press.current = null;
    clock.setPaused(start.wasPaused);
  };

  const pauseLabel = paused ? t('your2026.controls.play') : t('your2026.controls.pause');
  const entering = time < (timeline.starts[0] ?? 0);
  const transition = transitionAt(
    timeline,
    cards.map((item) => item.beats * BEAT),
    time,
    DISSOLVE_S
  );
  const colours = entering || !card ? STAGE_COLOURS : cardColours(card.kind);
  const target = transition ? cards.at(transition.target) : undefined;
  const track = `${colours.ink}40`;

  return (
    <YearStage
      colours={colours}
      onClose={onClose}
      header={
        <div className="flex gap-[0.3em]" aria-hidden="true">
          {cards.map((item, index) => (
            <div
              key={item.kind}
              className="h-[0.22em] flex-1 overflow-hidden rounded-full"
              style={{ background: track }}
            >
              <div
                className="h-full w-full origin-left rounded-full"
                style={{
                  background: colours.ink,
                  transform: `scaleX(${index < position.index ? 1 : index === position.index && !entering ? position.progress : 0})`,
                }}
              />
            </div>
          ))}
        </div>
      }
      controls={
        <>
          {extraControls}
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={pauseLabel}
            title={pauseLabel}
            onClick={togglePause}
            className="opacity-85 hover:bg-black/10 hover:opacity-100"
            style={{ color: 'inherit' }}
          >
            <PauseIcon paused={paused} />
          </IconButton>
        </>
      }
    >
      <p className="sr-only">{t('your2026.controls.hint')}</p>
      <p className="sr-only" aria-live="polite">
        {card && describeCard ? describeCard(card) : ''}
      </p>
      <div
        className="flex min-h-0 flex-1 touch-pan-y select-none flex-col"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
      >
        <CardFrame
          background={colours.bg}
          overlay={
            <TileFill
              transition={transition}
              background={target ? cardColours(target.kind).bg : colours.bg}
              reduced={reducedMotion}
            />
          }
        >
          {card && (
            <section
              key={card.kind}
              aria-roledescription="slide"
              aria-label={t('your2026.controls.slide', {
                index: position.index + 1,
                total: cards.length,
              })}
              className="absolute inset-0"
            >
              {renderCard(card, position, entering)}
            </section>
          )}
        </CardFrame>
      </div>
    </YearStage>
  );
}
