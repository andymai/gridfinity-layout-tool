import type { ReactNode } from 'react';
import '@fontsource/press-start-2p/400.css';
import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { PIXEL_FONT } from '../../../components/CreditsRoll/creditsRollItems';
import { headerBackground, readableAccent } from '../../utils/readableAccent';

export const STAGE_BACKGROUND = '#07070b';

export interface YearStageProps {
  readonly accent: string;
  readonly onClose: () => void;
  /** Rendered above the card body, inside the frame: progress and controls. */
  readonly header?: ReactNode;
  /** Extra controls beside the close button. */
  readonly controls?: ReactNode;
  readonly children: ReactNode;
}

/**
 * A full-screen dark stage with one 9:16 card on it. The card is the same shape
 * as the share image, so what the user sees is what they save. Font sizes in
 * the card are in `em` of a base that follows the card's height.
 */
export function YearStage({ accent, onClose, header, controls, children }: YearStageProps) {
  const t = useTranslation();
  return (
    <main
      className="fixed inset-0 flex items-center justify-center overflow-hidden text-white"
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${accent}22 0%, transparent 60%), ${STAGE_BACKGROUND}`,
      }}
    >
      <div
        className="relative flex h-[100dvh] w-screen flex-col overflow-hidden md:aspect-[9/16] md:h-[min(calc(100dvh-2rem),calc((100vw-2rem)*16/9))] md:w-auto md:rounded-[1.75rem] md:border md:border-white/10 md:shadow-2xl"
        style={{
          fontSize: 'clamp(12px, 2dvh, 20px)',
          background: `radial-gradient(circle at 85% 0%, ${accent}40 0%, transparent 45%), linear-gradient(160deg, #16161f 0%, #0d0d14 60%, #0a0a0f 100%)`,
        }}
      >
        <div className="relative z-10 flex flex-col gap-[0.8em] px-[1.4em] pt-[1.2em]">
          {header}
          <div className="flex items-center justify-between">
            <span
              className="text-[0.7em] uppercase tracking-[0.2em]"
              style={{
                fontFamily: PIXEL_FONT,
                color: readableAccent(accent, headerBackground(accent)),
              }}
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
                className="text-white/80 hover:text-white"
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
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </main>
  );
}
