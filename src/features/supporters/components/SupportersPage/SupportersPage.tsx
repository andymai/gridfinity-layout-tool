import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
// Side-effect: must run before any <Text> mounts under this Canvas.
import '@/shared/webgl/configureTroikaText';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useResolvedTheme } from '@/shared/hooks/useThemeEffect';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import { buildSupporterBins, getSupporterCount, joinedThisMonth } from '../../utils/supportersData';
import type { SupporterBin } from '../../utils/supportersData';
import {
  DEPARTMENT_TITLE_KEYS,
  REDACTED_DEPARTMENT,
  buildCreditsPlan,
  departmentOf,
  fallbackDepartment,
} from '../../utils/creditsPlan';
import { computeZonedLayout } from '../../utils/supportersLayout';
import { INTRO_SECONDS, type RollSchedule } from '../../utils/rollSchedule';
import type { CreditsClock } from '../../utils/creditsClock';
import { hasSeenCredits, markCreditsSeen } from '../../utils/creditsSeen';
import { creditFromSearch, creditLinkFor } from '../../utils/creditLink';
import { isSupporterDepartment } from '../../constants';
import { useSupportersData } from '../../hooks/useSupportersData';
import { useSupporterStatus } from '../../hooks/useSupporterStatus';
import { useCreditsClock } from '../../hooks/useCreditsClock';
import { useRollScrub } from '../../hooks/useRollScrub';
import { useProfileOverlay } from '../../hooks/useProfileOverlay';
import { useSupporterFocus } from '../../hooks/useSupporterFocus';
import { useAchievements } from '../../hooks/useAchievements';
import { getSupportersPalette } from '../../scene/palette';
import { SupportersScene } from '../SupportersScene';
import { FULL_STAGE, type StageFrame } from '../SupportersScene/supportersSceneStage';
import { SupporterPanel } from '../SupporterPanel';
import { CreditsRoll } from '../CreditsRoll';
import { CreditsTitleCard } from '../CreditsTitleCard';
import { CreditsControls } from '../CreditsControls';
import { CreditsFinale } from '../CreditsFinale';
import { SupportersHeader } from '../SupportersHeader';
import { ThanksCard } from '../ThanksCard';
import { CreditSpotlight } from '../CreditSpotlight';
import { AchievementToast } from '../AchievementToast';
import { useCountUp } from './useCountUp';
import { CtaBurst } from './SupportersFlourishes';

/** Roll speed outside quotes, px/s. Phones read one narrow column, so they go a touch slower. */
const BASE_SPEED = { side: 125, stacked: 105 };
const HINT_MS = 9000;
/** Skipping sooner than this after the roll starts earns the speedrunner achievement. */
const SPEEDRUN_MS = 3000;
const POKES_FOR_ACHIEVEMENT = 10;
/** Width of the credits column beside the plate, matching `CreditsRoll`. */
const columnWidth = (viewport: number) => Math.max(340, Math.min(viewport * 0.44, 600));

/**
 * /supporters as the end credits of a game: names roll up beside a baseplate
 * that starts empty, each bin dropping into its department's zone as its name
 * passes, ending on the full plate with one empty socket left for the next
 * supporter. A first visit rolls; a return visit (or reduced motion) opens on
 * the finale, and a shared credit link opens paused on its supporter.
 */
export function SupportersPage() {
  const t = useTranslation();
  const theme = useResolvedTheme();
  const { isMobile, viewportWidth: viewport } = useResponsive();
  const reducedMotion = usePrefersReducedMotion();
  const { navigateHome } = useSupportersRouting();
  const accent = useSettingsStore((state) => state.settings.accentColor);
  const { data: supporters, settled } = useSupportersData();
  const supporter = useSupporterStatus();
  const { effective, saveProfile } = useProfileOverlay(supporters, supporter);
  const { toast, unlock } = useAchievements();

  const bins = useMemo(() => buildSupporterBins(effective), [effective]);
  const binsById = useMemo(() => new Map(bins.map((b) => [b.id, b])), [bins]);
  const plan = useMemo(() => buildCreditsPlan(bins), [bins]);
  const layout = useMemo(() => computeZonedLayout(plan.zoneSizes), [plan.zoneSizes]);
  const departmentLabels = useMemo(() => DEPARTMENT_TITLE_KEYS.map((key) => t(key)), [t]);
  const palette = useMemo(() => getSupportersPalette(theme, accent), [theme, accent]);
  const total = getSupporterCount(supporters);
  const thisMonth = useMemo(() => joinedThisMonth(supporters), [supporters]);
  const stacked = isMobile;

  const [rollPhase, setPhase] = useState<'roll' | 'finale'>(() =>
    hasSeenCredits() ? 'finale' : 'roll'
  );
  const phase = reducedMotion ? 'finale' : rollPhase;
  const roll = phase === 'roll';
  const finish = useCallback(
    (played: boolean) => {
      setPhase('finale');
      markCreditsSeen();
      if (played) unlock('satThrough');
    },
    [unlock]
  );
  const openRoll = useCallback(() => setPhase('roll'), []);

  const [schedule, setSchedule] = useState<RollSchedule | null>(null);
  const { clock, paused, setPaused } = useCreditsClock(
    roll && settled && schedule !== null,
    finish
  );

  const status = supporter.status;
  const onShown = useCallback(
    (bin: SupporterBin) => {
      if (status.supporter && status.name !== null && bin.name === status.name) {
        unlock('foundOwnBin');
      }
    },
    [status, unlock]
  );
  const [creditName] = useState(() => creditFromSearch(window.location.search));
  const focus = useSupporterFocus({
    bins,
    rolling: roll,
    schedule,
    clock,
    setPaused,
    departmentLabels,
    creditName,
    openRoll,
    onShown,
  });
  const { focusedId, setFocusedId, togglePause, landCreditLink } = focus;

  const onSchedule = useCallback(
    (next: RollSchedule | null) => {
      if (next) {
        setSchedule(next);
        clock.setDuration(next.timeline.duration);
      }
      landCreditLink(next);
    },
    [clock, landCreditLink]
  );

  const [burst, setBurst] = useState<{ x: number; y: number; seed: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const endTagRef = useRef<HTMLDivElement>(null);
  const pokes = useRef(0);
  // Wall time, not the playhead: rewinding to the start or pausing there must
  // not make a later skip look fast.
  const rollStartedAt = useRef(0);
  useEffect(() => {
    if (roll) rollStartedAt.current = performance.now();
  }, [roll]);

  // Bins set document.body.cursor on hover; reset it if we unmount mid-hover.
  useEffect(() => () => void (document.body.style.cursor = ''), []);
  const clearBurst = useCallback(() => setBurst(null), []);

  useEffect(() => {
    if (phase !== 'roll') return;
    const id = setTimeout(() => setShowHint(false), HINT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const skip = useCallback(() => {
    if (performance.now() - rollStartedAt.current < SPEEDRUN_MS) unlock('speedrunner');
    if (clock.duration > 0) clock.seek(clock.duration);
    setPaused(false);
    setFocusedId(null);
    finish(false);
  }, [clock, setPaused, setFocusedId, finish, unlock]);

  const replay = useCallback(() => {
    clock.seek(0);
    setPaused(false);
    setFocusedId(null);
    setShowHint(true);
    setPhase('roll');
  }, [clock, setPaused, setFocusedId]);

  const onPoke = useCallback(() => {
    pokes.current += 1;
    if (pokes.current >= POKES_FOR_ACHIEVEMENT) unlock('poked10');
  }, [unlock]);
  const onPostCredits = useCallback(() => unlock('postCredits'), [unlock]);

  useRollScrub({
    enabled: roll,
    target: mainRef,
    clock,
    timeline: schedule?.timeline ?? null,
    baseSpeed: stacked ? BASE_SPEED.stacked : BASE_SPEED.side,
    onTogglePause: togglePause,
    onSkip: skip,
  });

  const count = useCountUp(total, !reducedMotion && settled && phase === 'finale');

  const besidePlate = roll || reducedMotion;
  const scrimRef = useRef<HTMLDivElement>(null);
  // Fully opaque beside the plate: at anything less, the bright grid lines show through the text.
  const scrimOpacity = besidePlate ? 1 : theme === 'dark' ? 0.92 : 0.88;
  // The title card owns the whole screen, so the column's scrim only rises as
  // the first credits arrive. Driven by the clock so a scrub back undoes it.
  useEffect(() => {
    const el = scrimRef.current;
    if (!el || !roll) return;
    const intro = schedule?.timeline.introSeconds ?? INTRO_SECONDS;
    const fade = (c: CreditsClock) => {
      const t = Math.min(1, Math.max(0, (c.time - (intro - 1.6)) / 1.6));
      el.style.opacity = String(scrimOpacity * t);
    };
    fade(clock);
    return clock.subscribe(fade);
  }, [roll, settled, clock, schedule, scrimOpacity]);

  if (!settled) {
    return <main className="h-screen w-screen" style={{ background: palette.background }} />;
  }

  const handleKofiClick = (source: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    trackEvent('kofi_clicked', { source });
    if (!reducedMotion) {
      const r = e.currentTarget.getBoundingClientRect();
      setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2, seed: Math.random() * 6.28 });
    }
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  // The caller's bin is found by NAME, the only handle the public list carries,
  // so an anonymous supporter has no findable bin and the affordance is absent.
  const myBin =
    status.supporter && status.name !== null
      ? (bins.find((b) => b.name === status.name) ?? null)
      : null;
  const myDepartment = !status.supporter
    ? undefined
    : departmentLabels[
        status.name === null
          ? REDACTED_DEPARTMENT
          : isSupporterDepartment(status.department)
            ? status.department
            : fallbackDepartment(status.name)
      ];

  const column = columnWidth(viewport);
  const stage: StageFrame = !besidePlate
    ? FULL_STAGE
    : stacked
      ? { shiftX: 0, shiftY: 0.18, widthFraction: 1, heightFraction: 0.44 }
      : {
          shiftX: column / viewport / 2,
          shiftY: 0,
          widthFraction: 1 - column / viewport,
          heightFraction: 1,
        };
  const focused = focusedId ? (binsById.get(focusedId) ?? null) : null;
  const stageInset = besidePlate && !stacked ? `${column}px` : '0px';

  return (
    <main
      ref={mainRef}
      className={`relative h-screen w-screen overflow-hidden ${roll ? 'touch-none select-none' : ''}`}
      style={{ background: palette.background, color: theme === 'dark' ? '#ffffff' : '#1c1b18' }}
    >
      <Canvas
        className="absolute inset-0"
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        frameloop={reducedMotion ? 'demand' : 'always'}
        camera={{ fov: 38, near: 0.1, far: 220, position: [2, 10, 14] }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => setFocusedId(null)}
      >
        <Suspense fallback={null}>
          <SupportersScene
            bins={bins}
            plan={plan}
            layout={layout}
            clock={clock}
            schedule={reducedMotion ? null : schedule}
            phase={phase}
            stage={stage}
            theme={theme}
            accent={accent}
            reducedMotion={reducedMotion}
            focusedId={focusedId}
            focusCamera={roll && paused}
            onSelect={focus.selectBin}
            onPoke={onPoke}
            onPostCredits={onPostCredits}
            postCreditsLabel={t('supporters.credits.postCreditsTape')}
            anonymousLabel={t('supporters.anonymous')}
            departmentLabels={departmentLabels}
            flyTo={focus.flyTo}
            endTagRef={endTagRef}
            onVacantSelect={() => {
              trackEvent('kofi_clicked', { source: 'supporters_socket' });
              window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
            }}
          />
        </Suspense>
      </Canvas>

      {/* Scrims keep the copy legible over the bright baseplate. */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          opacity: roll ? undefined : scrimOpacity,
          background: !besidePlate
            ? `linear-gradient(to bottom, ${palette.background} 4%, transparent 45%)`
            : stacked
              ? `linear-gradient(to bottom, ${palette.background} 44%, transparent 60%)`
              : `linear-gradient(to right, ${palette.background} ${column}px, transparent ${column * 1.45}px)`,
        }}
      />

      <h1 className="sr-only">{t('supporters.heading')}</h1>

      {roll && <CreditsTitleCard clock={clock} count={total} accent={palette.accent} />}

      <CreditsRoll
        plan={plan}
        binsById={binsById}
        clock={clock}
        mode={reducedMotion ? 'scroll' : 'roll'}
        stacked={stacked}
        baseSpeed={stacked ? BASE_SPEED.stacked : BASE_SPEED.side}
        accent={palette.accent}
        hidden={!besidePlate}
        focusedId={focusedId}
        onSchedule={onSchedule}
        onCredit={focus.onCredit}
        onKeyboardFocus={focus.onKeyboardFocus}
      />

      <SupportersHeader
        query={focus.findQuery}
        onQueryChange={focus.setFindQuery}
        onFind={focus.findText}
        status={focus.findStatus}
        onBack={navigateHome}
      />

      {focused && (
        <ThanksCard
          bin={focused}
          department={departmentLabels[departmentOf(focused)]}
          palette={palette}
          stageInset={stageInset}
        />
      )}

      {focus.spotlight && (
        <CreditSpotlight name={focus.spotlight} accent={palette.accent} stageInset={stageInset} />
      )}

      {roll && (
        <CreditsControls
          clock={clock}
          paused={paused}
          stacked={stacked}
          showHint={showHint}
          onTogglePause={togglePause}
          onSkip={skip}
          onKofi={handleKofiClick('supporters_credits')}
        />
      )}

      {phase === 'finale' && (
        <CreditsFinale
          total={total}
          count={count}
          thisMonth={thisMonth}
          accent={palette.accent}
          theme={theme}
          stageInset={stageInset}
          panelLabel={
            status.supporter ? t('supporters.panel.yoursTitle') : t('supporters.panel.title')
          }
          endTagRef={endTagRef}
          onKofi={handleKofiClick('supporters_page')}
          onReplay={reducedMotion ? undefined : replay}
          onOpenPanel={() => setPanelOpen(true)}
        />
      )}

      <AchievementToast id={toast} accent={palette.accent} />

      <SupporterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        status={status}
        settled={supporter.settled}
        save={saveProfile}
        department={myDepartment}
        creditLink={
          status.supporter && status.name
            ? creditLinkFor(status.name, window.location.origin)
            : undefined
        }
        onFindMyBin={
          myBin
            ? () => {
                focus.showSupporter(myBin.id, true);
                setPanelOpen(false);
              }
            : undefined
        }
      />

      {burst && (
        <CtaBurst
          key={burst.seed}
          origin={{ x: burst.x, y: burst.y }}
          accent={palette.accent}
          seed={burst.seed}
          onDone={clearBurst}
        />
      )}
    </main>
  );
}
