import type { ReactNode } from 'react';
import { IconButton } from '@/design-system';
import { useCurrentLocale, useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { TEXT, familyFor } from '../../look/fonts';
import { STAGE_COLOURS, type CardColours } from '../../look/palettes';
import '../../look/year.css';

export interface YearStageProps {
  /** The card on screen: its colour fills the frame and its ink draws the controls. */
  readonly colours: CardColours;
  readonly onClose: () => void;
  /** Above the card, inside the frame: progress. */
  readonly header?: ReactNode;
  /** Extra controls beside the close button. */
  readonly controls?: ReactNode;
  readonly children: ReactNode;
}

/**
 * A full-screen dark stage with one 9:16 card on it. The card is the same shape
 * as the share image, so what the user sees is what they save. The controls
 * float over the card's top margin, which every card keeps clear.
 */
export function YearStage({ colours, onClose, header, controls, children }: YearStageProps) {
  const t = useTranslation();
  const locale = useCurrentLocale();
  return (
    <main
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: STAGE_COLOURS.bg, color: colours.ink }}
    >
      <div
        className="relative flex h-[100dvh] w-screen flex-col overflow-hidden md:aspect-[9/16] md:h-[min(calc(100dvh-2rem),calc((100vw-2rem)*16/9))] md:w-auto md:rounded-[1.75rem] md:shadow-2xl"
        style={{ fontSize: 'clamp(12px, 2dvh, 20px)', background: colours.bg }}
      >
        <div className="y26-controls absolute inset-x-0 top-0 z-20 flex flex-col gap-[0.6em] px-[1.4em] pt-[1.1em]">
          {header}
          <div className="flex items-center justify-between">
            <span
              className="text-[0.8em] font-semibold"
              style={{ fontFamily: familyFor(TEXT, locale) }}
            >
              {t('your2026.kicker')}
            </span>
            <div className="flex items-center gap-[0.3em]">
              {controls}
              <IconButton
                size="sm"
                variant="ghost"
                aria-label={t('your2026.controls.close')}
                title={t('your2026.controls.close')}
                onClick={onClose}
                className="opacity-85 hover:bg-black/10 hover:opacity-100"
                style={{ color: 'inherit' }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {ICON_PATHS.close.map((d) => (
                    <path
                      key={d}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={d}
                    />
                  ))}
                </svg>
              </IconButton>
            </div>
          </div>
        </div>
        {/* After the controls in the DOM, so focus meets them first, as the eye does. */}
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </main>
  );
}
