import { useTranslation } from '@/i18n';
import { PIXEL_FONT } from '../CreditsRoll/creditsRollItems';

interface CreditSpotlightProps {
  name: string;
  accent: string;
  stageInset: string;
}

/** The opening card of a shared credit link: "Now starring" and the supporter's name. */
export function CreditSpotlight({ name, accent, stageInset }: CreditSpotlightProps) {
  const t = useTranslation();
  return (
    <div
      role="status"
      className="pointer-events-none absolute right-0 top-[9%] z-30 flex flex-col items-center px-6 text-center motion-safe:animate-fade-in"
      style={{ left: stageInset }}
    >
      <span
        className="text-xs uppercase tracking-[0.08em] sm:text-sm"
        style={{ fontFamily: PIXEL_FONT, color: accent, textShadow: `0 0 18px ${accent}66` }}
      >
        {t('supporters.credits.nowStarring')}
      </span>
      <span
        className="mt-3 rounded-md bg-black/55 px-4 py-1.5 text-3xl font-bold tracking-tight text-white backdrop-blur-sm sm:text-5xl"
        style={{ textShadow: `0 0 32px ${accent}55` }}
      >
        {name}
      </span>
    </div>
  );
}
