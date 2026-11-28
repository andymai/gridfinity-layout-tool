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
import { detectWebGL } from '@/shared/webgl/detectWebGL';
import { useSupportersData } from '../../../hooks/useSupportersData';
import { getSupporterCount } from '../../../utils/supportersData';
import { SoundToggle } from '../../../components/SoundToggle';
import { readSoundOn, saveSoundOn } from '../../../utils/soundPreference';
import { useSampleYear } from '../../hooks/useSampleYear';
import { useShareImage, type ShareRequest } from '../../hooks/useShareImage';
import { useYearFonts } from '../../hooks/useYearFonts';
import { useYearMeshes } from '../../hooks/useYearMeshes';
import { useYearSoundtrack } from '../../hooks/useYearSoundtrack';
import { useYearReviewData } from '../../hooks/useYearReviewData';
import { meshCandidates, pickComplicated } from '../../utils/complicatedPick';
import type { YearCard } from '../../utils/yearCards';
import { buildScene } from '../../cards/buildScene';
import { DISPLAY, TEXT, familyFor } from '../../look/fonts';
import { PALETTES } from '../../look/palettes';
import { ShareButton } from '../ShareButton';
import { buildYearCards } from '../../utils/yearCards';
import { hasYearActivity } from '../../utils/yearStats';
import { StoryPlayer } from '../StoryPlayer';
import { YearCardView, describeCard, preloadSpinningBin } from '../YearCardView';
import { YearStage } from '../YearStage';
import { canSpin } from '../SpinningBin/assembly';

/** Status screens stand on the opening card's colours. */
const STATUS_COLOURS = { bg: PALETTES.intro.bg, ink: PALETTES.intro.ink };

/** Doors that pass `?from=`; anything else is a direct visit. */
function openSource(from: string | null): 'dock' | 'whats_new' | 'direct' {
  return from === 'dock' || from === 'whats_new' ? from : 'direct';
}

interface StatusAction {
  readonly label: string;
  readonly onClick: () => void;
}

interface StatusCardProps {
  readonly title: string;
  readonly line?: string;
  readonly action?: StatusAction;
  readonly secondary?: StatusAction;
}

/** The thank-you card's keys at status-screen size: lime first, cobalt second. */
const STATUS_KEYS = [
  {
    background: '#D4FF38',
    color: '#121A5C',
    boxShadow: 'inset 0 0.25em 0 #EBFF9A, 0 0.35em 0 #8FB314',
  },
  {
    background: '#4A55F0',
    color: '#FFFFFF',
    boxShadow: 'inset 0 0.25em 0 #6E78FF, 0 0.35em 0 #161E8C',
  },
] as const;

function StatusCard({ title, line, action, secondary }: StatusCardProps) {
  const locale = useCurrentLocale();
  const text = familyFor(TEXT, locale);
  return (
    <div
      className="flex flex-1 flex-col justify-end px-[1.6em] pb-[2.2em]"
      style={{ fontFamily: text }}
    >
      <h2
        className="text-[2.6em] leading-[0.95]"
        style={{ fontFamily: familyFor(DISPLAY, locale), fontWeight: 900 }}
      >
        {title}
      </h2>
      {line && <p className="mt-[0.7em] text-[1.1em] font-semibold leading-snug">{line}</p>}
      {(action || secondary) && (
        <div className="mt-[1.6em] flex flex-col gap-[0.9em]">
          {[action, secondary].map((each, index) =>
            each ? (
              <Button
                key={each.label}
                variant="ghost"
                size="lg"
                onClick={each.onClick}
                className="w-full rounded-[0.9em] text-[1.05em] font-semibold hover:brightness-105 focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-white"
                style={{ ...STATUS_KEYS[index], fontFamily: text }}
              >
                {each.label}
              </Button>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function readDemo(): boolean {
  return new URLSearchParams(window.location.search).has('demo');
}

/**
 * `?demo` plays the sample year at any date. "Watch the sample" stays on this
 * route, so the flag follows the URL, and each mode mounts fresh.
 */
export function Your2026Page() {
  const [demo, setDemo] = useState(readDemo);
  useEffect(() => {
    const onPopState = () => setDemo(readDemo());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  return <YearReview key={demo ? 'sample' : 'year'} demo={demo} />;
}

function YearReview({ demo }: { readonly demo: boolean }) {
  const t = useTranslation();
  const locale = useCurrentLocale();
  const reducedMotion = usePrefersReducedMotion();
  const { navigateHome, replaceWithHome, navigateToYour2026 } = useYour2026Routing();
  const { navigateToSupporters } = useSupportersRouting();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const allowed = demo || params.has('preview') || isYearReviewOpen();
  const startOnThanks = params.get('card') === 'thanks';

  const real = useYearReviewData(YEAR_REVIEW_YEAR, allowed && !demo);
  const sample = useSampleYear(demo);
  const data = demo ? sample.data : real;
  const unit = useSettingsStore((s) => s.settings.measureUnit);
  const entries = useLibraryStore((s) => s.library.entries);
  const { data: supporters, settled: supportersSettled } = useSupportersData();
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);

  useEffect(() => {
    if (!allowed) replaceWithHome();
  }, [allowed, replaceWithHome]);

  useEffect(() => {
    // A preview before the window, or the sample, must not clear the dot the
    // user sees for their own year.
    if (!demo && isYearReviewOpen()) markYearReviewSeen();
  }, [demo]);

  useEffect(() => {
    if (!allowed || startOnThanks) return;
    trackEvent('your_2026_opened', { source: openSource(params.get('from')), demo });
  }, [allowed, startOnThanks, params, demo]);

  const stats = data.status === 'ready' ? data.stats : null;
  const cards = useMemo(() => (stats ? buildYearCards(stats) : []), [stats]);
  const libraryPreview = useMemo(() => {
    const id = stats?.biggestDrawer?.layoutId;
    return entries.find((entry) => entry.id === id)?.preview ?? null;
  }, [entries, stats]);
  const drawerPreview = demo ? sample.drawerPreview : libraryPreview;
  const candidates = useMemo(() => (stats ? meshCandidates(stats) : []), [stats]);
  const liveMeshes = useYearMeshes(
    candidates,
    nozzleSizeMm,
    !demo && stats !== null && hasYearActivity(stats)
  );
  const meshes = demo ? sample.meshes : liveMeshes;
  useEffect(() => {
    if (meshes.size > 0) preloadSpinningBin();
  }, [meshes]);
  // The sample knows its counts before its meshes load, so its pick never waits.
  const triangles = demo ? sample.triangles : null;
  const complicated = useMemo(
    () =>
      stats
        ? pickComplicated(
            stats.complexityShortlist,
            (id) => triangles?.get(id) ?? meshes.get(id)?.triangles
          )
        : null,
    [stats, meshes, triangles]
  );
  const [settledCard, setSettledCard] = useState<YearCard | null>(null);
  const [modelFrames, setModelFrames] = useState(0);
  const onModelDrawn = useCallback(() => setModelFrames((count) => count + 1), []);
  // Stable on purpose: a new handler makes the player call it again with no card
  // change, which would clear the image the settled card prepared.
  const onCardChange = useCallback(() => setSettledCard(null), []);
  const supporterCount = getSupporterCount(supporters);
  // Every word the cards set, so the font load fetches exactly the subsets they need.
  const fontSample = useMemo(
    () =>
      stats
        ? cards
            .map((card) =>
              describeCard(card, { t, stats, locale, unit, supporterCount, complicated })
            )
            .join(' ')
        : null,
    [cards, stats, t, locale, unit, supporterCount, complicated]
  );
  const fonts = useYearFonts(fontSample);
  const shareRequest = useMemo<ShareRequest | null>(() => {
    if (!settledCard || !stats) return null;
    const scene = buildScene({
      card: settledCard,
      t,
      locale,
      unit,
      stats,
      supporterCount,
      complicated,
      drawerPreview,
      measure: fonts.measure,
    });
    if (!scene) return null;
    const design =
      settledCard.kind === 'longest'
        ? stats.longestPrint
        : settledCard.kind === 'complicated'
          ? (complicated?.design ?? null)
          : null;
    const mesh = design ? meshes.get(design.id) : undefined;
    return {
      scene,
      thumbnail: design?.thumbnail ?? null,
      turns: mesh !== undefined && canSpin(mesh) && detectWebGL().available,
      modelFrames,
    };
  }, [
    settledCard,
    stats,
    t,
    locale,
    unit,
    supporterCount,
    complicated,
    drawerPreview,
    fonts.measure,
    meshes,
    modelFrames,
  ]);
  const shareTheme = useMemo(
    () => ({
      kicker: t('your2026.kicker'),
      locale,
      keys: [t('your2026.thanks.rollCredits'), t('your2026.thanks.support')] as const,
    }),
    [t, locale]
  );
  const shareBlob = useShareImage(shareRequest, shareTheme);

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
  const watchSample = useCallback(() => navigateToYour2026('?demo'), [navigateToYour2026]);

  if (!allowed) return null;

  if (data.status === 'error') {
    return (
      <YearStage colours={STATUS_COLOURS} onClose={navigateHome}>
        <StatusCard
          title={t('your2026.error.title')}
          action={{ label: t('your2026.error.retry'), onClick: retry }}
        />
      </YearStage>
    );
  }

  // The thank-you card's count is its final word, so it waits for the live list;
  // the story waits for its faces, so no card wraps against a fallback.
  if (!stats || (startOnThanks && !supportersSettled) || (hasYearActivity(stats) && !fonts.ready)) {
    return (
      <YearStage colours={STATUS_COLOURS} onClose={navigateHome}>
        <div
          className="flex flex-1 items-center justify-center text-[1.1em] font-semibold"
          style={{ fontFamily: familyFor(TEXT, locale) }}
          role="status"
        >
          {t('your2026.counting')}
        </div>
      </YearStage>
    );
  }

  if (!hasYearActivity(stats)) {
    return (
      <YearStage colours={STATUS_COLOURS} onClose={navigateHome}>
        <StatusCard
          title={t('your2026.empty.title')}
          line={t('your2026.empty.line')}
          action={{ label: t('your2026.empty.sample'), onClick: watchSample }}
          secondary={{ label: t('your2026.empty.start'), onClick: navigateHome }}
        />
      </YearStage>
    );
  }

  return (
    <StoryPlayer
      cards={cards}
      initialIndex={startOnThanks ? cards.length - 1 : 0}
      reducedMotion={reducedMotion}
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
          complicated,
        })
      }
      renderCard={(card, position, entering) => (
        <YearCardView
          card={card}
          elapsed={position.elapsed}
          hidden={entering}
          measure={fonts.measure}
          stats={stats}
          locale={locale}
          unit={unit}
          reducedMotion={reducedMotion}
          supporterCount={getSupporterCount(supporters)}
          drawerPreview={drawerPreview}
          meshes={meshes}
          complicated={complicated}
          onRollCredits={rollCredits}
          onSupport={support}
          onModelDrawn={onModelDrawn}
        />
      )}
    />
  );
}
