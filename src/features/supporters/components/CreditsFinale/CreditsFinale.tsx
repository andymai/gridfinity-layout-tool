import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { PIXEL_FONT } from '../CreditsRoll/creditsRollItems';

interface CreditsFinaleProps {
  total: number;
  /** The count-up value shown; `total` is what screen readers hear. */
  count: number;
  thisMonth: number;
  accent: string;
  theme: 'light' | 'dark';
  /** Left edge of the plate's part of the screen, when credits sit beside it. */
  stageInset: string;
  panelLabel: string;
  /** Moved every frame by the scene to sit over the vacant socket. */
  endTagRef: React.RefObject<HTMLDivElement | null>;
  onKofi: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onReplay?: () => void;
  onOpenPanel: () => void;
}

export function CreditsFinale({
  total,
  count,
  thisMonth,
  accent,
  theme,
  stageInset,
  panelLabel,
  endTagRef,
  onKofi,
  onReplay,
  onOpenPanel,
}: CreditsFinaleProps) {
  const t = useTranslation();
  return (
    <>
      <div
        className="pointer-events-none absolute right-0 top-[max(5%,4.5rem)] z-20 flex flex-col items-center px-6 text-center motion-safe:animate-fade-in"
        style={{ left: stageInset }}
      >
        <h1 className="flex flex-col items-center">
          <span className="sr-only">{total} </span>
          <span
            aria-hidden="true"
            className="text-7xl font-bold tabular-nums leading-none tracking-tighter sm:text-9xl"
            style={{
              color: accent,
              textShadow:
                theme === 'dark' ? `0 0 48px ${accent}55` : '0 1px 0 rgba(255,255,255,0.6)',
            }}
          >
            {count}
          </span>
          <span className="mt-3 text-base font-semibold uppercase tracking-[0.28em] opacity-90 sm:text-lg">
            {t('supporters.countLabel')}
          </span>
        </h1>
        {thisMonth > 0 && (
          <p
            className="mt-2 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: accent, opacity: 0.85 }}
          >
            {t('supporters.thisMonth', { count: thisMonth })}
          </p>
        )}
      </div>

      <div
        ref={endTagRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-20 flex flex-col items-center whitespace-nowrap rounded-md bg-black/55 px-3 py-1.5 text-white backdrop-blur-sm"
        style={{ visibility: 'hidden' }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.08em] sm:text-sm"
          style={{ fontFamily: PIXEL_FONT, color: accent, textShadow: `0 0 18px ${accent}66` }}
        >
          {t('supporters.credits.theEnd')}
        </span>
        <span className="mt-1 text-xs opacity-75">{t('supporters.credits.yourBinHere')}</span>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 right-0 z-20 flex flex-col items-center gap-2 px-6 pb-8 text-center sm:flex-row sm:justify-center"
        style={{ left: stageInset }}
      >
        <Button
          variant="primary"
          onClick={onKofi}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 text-sm"
          style={{ color: '#fff', textShadow: '0 1px 1px rgba(34,34,34,0.15)' }}
        >
          <img
            src="/kofi-cup.png"
            alt=""
            aria-hidden="true"
            className="kofi-cup-wiggle h-4 w-auto"
          />
          {t('supporters.cta.button')}
        </Button>
        {onReplay && (
          <Button
            variant="ghost"
            onClick={onReplay}
            className="pointer-events-auto px-3 py-2 text-sm"
            style={{ color: 'inherit' }}
          >
            {t('supporters.credits.replay')}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={onOpenPanel}
          className="pointer-events-auto px-3 py-2 text-sm underline-offset-2 hover:underline"
          style={{ color: 'inherit' }}
        >
          {panelLabel}
        </Button>
      </div>
    </>
  );
}
