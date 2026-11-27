import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/design-system';
import { useLibraryStore, useSettingsStore } from '@/core/store';
import { useCurrentLocale, useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import { useYour2026Routing } from '@/shared/hooks/useYour2026Routing';
import { markYearReviewSeen } from '@/shared/yearReview/dockRow';
import { isYearReviewOpen, YEAR_REVIEW_YEAR } from '@/shared/yearReview/window';
import { useSupportersData } from '../../../hooks/useSupportersData';
import { getSupportersPalette } from '../../../scene/palette';
import { getSupporterCount } from '../../../utils/supportersData';
import { SoundToggle } from '../../../components/SoundToggle';
import { readSoundOn, saveSoundOn } from '../../../utils/soundPreference';
import { useShareImage } from '../../hooks/useShareImage';
import { useYearMeshes } from '../../hooks/useYearMeshes';
import { useYearSoundtrack } from '../../hooks/useYearSoundtrack';
import { useYearReviewData } from '../../hooks/useYearReviewData';
import { meshCandidates, pickComplicated, type ComplicatedPick } from '../../utils/complicatedPick';
import type { YearCard } from '../../utils/yearCards';
import { readableAccent } from '../../utils/readableAccent';
import { ShareButton } from '../ShareButton';
import { shareSpecFor } from '../YearCardView/shareSpec';
import { buildYearCards } from '../../utils/yearCards';
import { hasYearActivity } from '../../utils/yearStats';
import { StoryPlayer } from '../StoryPlayer';
import { YearCardView, describeCard } from '../YearCardView';
import { YearStage } from '../YearStage';

/**
 * The most complicated bin, fixed the first time its card shows, so a mesh that
 * lands later cannot change the answer, and a replay names the same bin.
 */
let frozenComplicated: ComplicatedPick | null = null;

const SITE_HOST = 'gridfinitylayouttool.com';

/** Doors that pass `?from=`; anything else is a direct visit. */
function openSource(from: string | null): 'dock' | 'whats_new' | 'direct' {
  return from === 'dock' || from === 'whats_new' ? from : 'direct';
}

interface StatusCardProps {
  readonly title: string;
  readonly line?: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
}

function StatusCard({ title, line, action }: StatusCardProps) {
  return (
    <div className="flex flex-1 flex-col justify-end px-[1.6em] pb-[1.8em]">
      <h2 className="text-[1.8em] font-bold leading-[1.15] tracking-tight">{title}</h2>
      {line && <p className="mt-[0.6em] text-white/70">{line}</p>}
      {action && (
        <Button variant="primary" size="lg" onClick={action.onClick} className="mt-[1.4em] w-full">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function Your2026Page() {
  const t = useTranslation();
  const locale = useCurrentLocale();
  const reducedMotion = usePrefersReducedMotion();
  const { navigateHome, replaceWithHome } = useYour2026Routing();
  const { navigateToSupporters } = useSupportersRouting();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const allowed = params.has('preview') || isYearReviewOpen();
  const startOnThanks = params.get('card') === 'thanks';

  const data = useYearReviewData(YEAR_REVIEW_YEAR, allowed);
  const accentName = useSettingsStore((s) => s.settings.accentColor);
  const unit = useSettingsStore((s) => s.settings.measureUnit);
  const entries = useLibraryStore((s) => s.library.entries);
  const { data: supporters, settled: supportersSettled } = useSupportersData();
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const accent = getSupportersPalette('dark', accentName).accent;

  useEffect(() => {
    if (!allowed) replaceWithHome();
  }, [allowed, replaceWithHome]);

  useEffect(() => {
    // A preview before the window must not clear the dot the user sees on the day.
    if (isYearReviewOpen()) markYearReviewSeen();
  }, []);

  useEffect(() => {
    if (!allowed || startOnThanks) return;
    trackEvent('your_2026_opened', { source: openSource(params.get('from')), demo: false });
  }, [allowed, startOnThanks, params]);

  const stats = data.status === 'ready' ? data.stats : null;
  const cards = useMemo(() => (stats ? buildYearCards(stats) : []), [stats]);
  const drawerPreview = useMemo(() => {
    const id = stats?.biggestDrawer?.layoutId;
    return entries.find((entry) => entry.id === id)?.preview ?? null;
  }, [entries, stats]);
  const candidates = useMemo(() => (stats ? meshCandidates(stats) : []), [stats]);
  const meshes = useYearMeshes(candidates, nozzleSizeMm, stats !== null && hasYearActivity(stats));
  const [complicated, setComplicated] = useState(() => frozenComplicated);
  const liveComplicated = useMemo(
    () =>
      stats ? pickComplicated(stats.complexityShortlist, (id) => meshes.get(id)?.triangles) : null,
    [stats, meshes]
  );
  const shownComplicated = complicated ?? liveComplicated;
  const [settledCard, setSettledCard] = useState<YearCard | null>(null);
  const onCardChange = useCallback(
    (card: YearCard) => {
      setSettledCard(null);
      if (card.kind !== 'complicated' || frozenComplicated) return;
      frozenComplicated = liveComplicated;
      setComplicated(liveComplicated);
    },
    [liveComplicated]
  );
  const supporterCount = getSupporterCount(supporters);
  const shareSpec = useMemo(
    () =>
      settledCard && stats
        ? shareSpecFor(settledCard, {
            t,
            stats,
            locale,
            unit,
            supporterCount,
            complicated: complicated ?? liveComplicated,
            drawerPreview,
            meshes,
          })
        : null,
    [
      settledCard,
      stats,
      t,
      locale,
      unit,
      supporterCount,
      complicated,
      liveComplicated,
      drawerPreview,
      meshes,
    ]
  );
  const shareTheme = useMemo(() => {
    // Canvas fonts cannot read CSS variables, so the families are resolved here.
    const appFont = getComputedStyle(document.body).fontFamily;
    return {
      accent,
      accentText: readableAccent(accent),
      appFont,
      pixelFont: `"Press Start 2P", ${appFont}`,
      kicker: t('your2026.kicker'),
      site: SITE_HOST,
    };
  }, [accent, t]);
  const shareBlob = useShareImage(shareSpec, shareTheme);

  const onReachEnd = useCallback(() => trackEvent('your_2026_finished'), []);

  // One sound choice for Your 2026 and the credits, so sound stays on into the roll.
  const [soundOn, setSoundOn] = useState(readSoundOn);
  const [paused, setPaused] = useState(false);
  useYearSoundtrack(soundOn && stats !== null && hasYearActivity(stats), paused);
  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      saveSoundOn(!on);
      return !on;
    });
  }, []);

  const rollCredits = useCallback(() => {
    // Back from the credits should land on this card, not on the first one.
    const here = new URLSearchParams(window.location.search);
    here.set('card', 'thanks');
    window.history.replaceState(null, '', `/your-2026?${here.toString()}`);
    navigateToSupporters('?from=your-2026');
  }, [navigateToSupporters]);

  const support = useCallback(() => {
    trackEvent('kofi_clicked', { source: 'your_2026' });
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const retry = useCallback(() => window.location.reload(), []);

  if (!allowed) return null;

  if (data.status === 'error') {
    return (
      <YearStage accent={accent} onClose={navigateHome}>
        <StatusCard
          title={t('your2026.error.title')}
          action={{ label: t('your2026.error.retry'), onClick: retry }}
        />
      </YearStage>
    );
  }

  // The thank-you card's count is its final word, so it waits for the live list.
  if (!stats || (startOnThanks && !supportersSettled)) {
    return (
      <YearStage accent={accent} onClose={navigateHome}>
        <div className="flex flex-1 items-center justify-center text-white/60" role="status">
          {t('your2026.counting')}
        </div>
      </YearStage>
    );
  }

  if (!hasYearActivity(stats)) {
    return (
      <YearStage accent={accent} onClose={navigateHome}>
        <StatusCard
          title={t('your2026.empty.title')}
          line={t('your2026.empty.line')}
          action={{ label: t('your2026.empty.start'), onClick: navigateHome }}
        />
      </YearStage>
    );
  }

  return (
    <StoryPlayer
      cards={cards}
      initialIndex={startOnThanks ? cards.length - 1 : 0}
      accent={accent}
      onClose={navigateHome}
      onReachEnd={onReachEnd}
      onCardChange={onCardChange}
      onCardSettled={setSettledCard}
      onPausedChange={setPaused}
      extraControls={
        <>
          <ShareButton blob={shareBlob} fileName={`your-2026-${settledCard?.kind ?? 'card'}.png`} />
          <SoundToggle on={soundOn} onToggle={toggleSound} />
        </>
      }
      describeCard={(card) =>
        describeCard(card, {
          t,
          stats,
          locale,
          unit,
          supporterCount: getSupporterCount(supporters),
          complicated: shownComplicated,
        })
      }
      renderCard={(card, position) => (
        <YearCardView
          card={card}
          elapsed={position.elapsed}
          stats={stats}
          accent={accent}
          locale={locale}
          unit={unit}
          reducedMotion={reducedMotion}
          supporterCount={getSupporterCount(supporters)}
          drawerPreview={drawerPreview}
          meshes={meshes}
          complicated={shownComplicated}
          onRollCredits={rollCredits}
          onSupport={support}
        />
      )}
    />
  );
}
