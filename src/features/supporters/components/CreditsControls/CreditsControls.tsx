import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CreditsClock } from '../../utils/creditsClock';
import { HOLD_RATE, NO_SCRUB_ATTR } from '../../hooks/useRollScrub';

/** A keyboard press on a hold button can't be held, so it jumps this far instead. */
const KEY_JUMP_SECONDS = 8;

interface CreditsControlsProps {
  clock: CreditsClock;
  paused: boolean;
  stacked: boolean;
  showHint: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
  onKofi: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const icon = (d: string) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);
const REWIND = 'M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z';
const FORWARD = 'M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z';
const PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
const PLAY = 'M8 5v14l11-7z';
const SKIP = 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z';

function HoldButton({
  clock,
  direction,
  label,
  path,
}: {
  clock: CreditsClock;
  direction: 1 | -1;
  label: string;
  path: string;
}) {
  const release = () => clock.setHoldRate(null);
  return (
    <Button
      variant="ghost"
      iconOnly
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        clock.setHoldRate(direction * HOLD_RATE);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onClick={(e) => {
        if (e.detail === 0) clock.seek(clock.time + direction * KEY_JUMP_SECONDS);
      }}
      style={{ color: 'inherit' }}
    >
      {icon(path)}
    </Button>
  );
}

/**
 * Tape-deck controls for the roll: hold to rewind or fast-forward, pause,
 * skip to the finale, plus a quiet way to support that never covers a credit.
 */
export function CreditsControls({
  clock,
  paused,
  stacked,
  showHint,
  onTogglePause,
  onSkip,
  onKofi,
}: CreditsControlsProps) {
  const t = useTranslation();
  const pauseLabel = paused ? t('supporters.credits.play') : t('supporters.credits.pause');
  return (
    <div
      {...{ [NO_SCRUB_ATTR]: '' }}
      className={`absolute z-30 flex flex-col gap-2 ${
        stacked ? 'inset-x-0 bottom-4 items-center' : 'bottom-6 right-6 items-end'
      }`}
    >
      {showHint && (
        <p
          className="pointer-events-none rounded-md bg-black/45 px-2.5 py-1 text-xs text-white/85 backdrop-blur-sm motion-safe:animate-fade-in"
          role="note"
        >
          {t('supporters.credits.scrubHint')}
        </p>
      )}
      <div className="flex items-center gap-1 rounded-lg bg-black/25 p-1 backdrop-blur-sm">
        <HoldButton
          clock={clock}
          direction={-1}
          label={t('supporters.credits.rewind')}
          path={REWIND}
        />
        <Button
          variant="ghost"
          iconOnly
          aria-label={pauseLabel}
          title={pauseLabel}
          onClick={onTogglePause}
          style={{ color: 'inherit' }}
        >
          {icon(paused ? PLAY : PAUSE)}
        </Button>
        <HoldButton
          clock={clock}
          direction={1}
          label={t('supporters.credits.fastForward')}
          path={FORWARD}
        />
        <Button
          variant="ghost"
          onClick={onSkip}
          rightIcon={icon(SKIP)}
          className="px-3 text-sm"
          style={{ color: 'inherit' }}
        >
          {t('supporters.credits.skip')}
        </Button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-current opacity-20" />
        <Button
          variant="ghost"
          onClick={onKofi}
          className="gap-1.5 px-2.5 text-xs opacity-75 hover:opacity-100"
          style={{ color: 'inherit' }}
        >
          <img src="/kofi-cup.png" alt="" aria-hidden="true" className="h-3.5 w-auto" />
          {t('supporters.cta.button')}
        </Button>
      </div>
    </div>
  );
}
