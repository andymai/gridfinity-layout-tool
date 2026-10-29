import { useTranslation } from '@/i18n';
import { ACHIEVEMENT_TITLE_KEYS, type AchievementId } from '../../utils/achievements';
import { PIXEL_FONT } from '../CreditsRoll/creditsRollItems';

const TROPHY =
  'M6 3h12v2h3v3a4 4 0 0 1-4 4h-.3A6 6 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A6 6 0 0 1 7.3 12H7a4 4 0 0 1-4-4V5h3V3zm0 4H5v1a2 2 0 0 0 1 1.7V7zm12 0v2.7A2 2 0 0 0 19 8V7h-1z';

export function AchievementToast({ id, accent }: { id: AchievementId | null; accent: string }) {
  const t = useTranslation();
  return (
    <div role="status" className="pointer-events-none absolute left-5 top-[4.5rem] z-40">
      {id && (
        <div
          key={id}
          className="flex items-center gap-3 rounded-lg bg-black/70 px-3.5 py-2.5 text-white shadow-lg backdrop-blur-sm motion-safe:animate-fade-in"
          style={{ boxShadow: `0 0 0 1px ${accent}66, 0 8px 24px rgba(0,0,0,0.4)` }}
        >
          <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill={accent} aria-hidden="true">
            <path d={TROPHY} />
          </svg>
          <div className="flex flex-col gap-1">
            <span
              className="text-[9px] uppercase tracking-[0.08em]"
              style={{ fontFamily: PIXEL_FONT, color: accent }}
            >
              {t('supporters.achievements.unlocked')}
            </span>
            <span className="text-sm font-medium">{t(ACHIEVEMENT_TITLE_KEYS[id])}</span>
          </div>
        </div>
      )}
    </div>
  );
}
