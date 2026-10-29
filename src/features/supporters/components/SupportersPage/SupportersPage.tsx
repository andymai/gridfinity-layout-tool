import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
// Side-effect: must run before any <Text> mounts under this Canvas.
import '@/shared/webgl/configureTroikaText';
import { useSettingsStore } from '@/core/store';
import { Button, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useResolvedTheme } from '@/shared/hooks/useThemeEffect';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import { buildSupporterBins, getSupporterCount, joinedThisMonth } from '../../utils/supportersData';
import { DEPARTMENT_TITLE_KEYS, buildCreditsPlan, departmentOf } from '../../utils/creditsPlan';
import { computeZonedLayout } from '../../utils/supportersLayout';
import { INTRO_SECONDS, type RollSchedule } from '../../utils/rollSchedule';
import type { CreditsClock } from '../../utils/creditsClock';
import { hasSeenCredits, markCreditsSeen } from '../../utils/creditsSeen';
import { findSupporter } from '../../utils/findSupporter';
import { useSupportersData } from '../../hooks/useSupportersData';
import { useSupporterStatus } from '../../hooks/useSupporterStatus';
import { useCreditsClock } from '../../hooks/useCreditsClock';
import { NO_SCRUB_ATTR, useRollScrub } from '../../hooks/useRollScrub';
import { useProfileOverlay } from '../../hooks/useProfileOverlay';
import { getSupportersPalette } from '../../scene/palette';
import { SupportersScene, type FlyToRequest } from '../SupportersScene';
import { FULL_STAGE, type StageFrame } from '../SupportersScene/supportersSceneStage';
import { SupporterPanel } from '../SupporterPanel';
import { CreditsRoll } from '../CreditsRoll';
import { CreditsTitleCard } from '../CreditsTitleCard';
import { CreditsControls } from '../CreditsControls';
import { CreditsFinale } from '../CreditsFinale';
import { useCountUp } from './useCountUp';
import { CtaBurst } from './SupportersFlourishes';

/** Roll speed outside quotes, px/s. Phones read one narrow column, so they go a touch slower. */
const BASE_SPEED = { side: 125, stacked: 105 };
const HINT_MS = 9000;
/** Past a bin's landing, so pausing on its credit shows it seated rather than about to drop. */
const SEATED_AFTER = 0.75;
/** Width of the credits column beside the plate, matching `CreditsRoll`. */
const columnWidth = (viewport: number) => Math.max(340, Math.min(viewport * 0.44, 600));

/**
 * /supporters as the end credits of a game: names roll up beside a baseplate
 * that starts empty, each bin dropping into its department's zone as its name
 * passes, ending on the full plate with one empty socket left for the next
 * supporter. A first visit rolls; a return visit (or reduced motion) opens on
 * the finale.
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
  const finish = useCallback(() => {
    setPhase('finale');
    markCreditsSeen();
  }, []);

  const [schedule, setSchedule] = useState<RollSchedule | null>(null);
  const rolling = phase === 'roll' && !reducedMotion && settled && schedule !== null;
  const { clock, paused, setPaused } = useCreditsClock(rolling, finish);
  const onSchedule = useCallback(
    (next: RollSchedule) => {
      setSchedule(next);
      clock.setDuration(next.timeline.duration);
    },
    [clock]
  );

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToRequest | null>(null);
  const flyNonce = useRef(0);
  const [findQuery, setFindQuery] = useState('');
  const [findStatus, setFindStatus] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; seed: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const endTagRef = useRef<HTMLDivElement>(null);

  // Bins set document.body.cursor on hover; reset it if we unmount mid-hover.
  useEffect(() => () => void (document.body.style.cursor = ''), []);
  const clearBurst = useCallback(() => setBurst(null), []);

  useEffect(() => {
    if (phase !== 'roll') return;
    const id = setTimeout(() => setShowHint(false), HINT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const togglePause = useCallback(() => {
    const next = !clock.isPaused;
    setPaused(next);
    if (!next) setFocusedId(null);
  }, [clock, setPaused]);

  const skip = useCallback(() => {
    if (clock.duration > 0) clock.seek(clock.duration);
    setPaused(false);
    setFocusedId(null);
    finish();
  }, [clock, setPaused, finish]);

  const replay = useCallback(() => {
    clock.seek(0);
    setPaused(false);
    setFocusedId(null);
    setShowHint(true);
    setPhase('roll');
  }, [clock, setPaused]);

  useRollScrub({
    enabled: phase === 'roll' && !reducedMotion,
    target: mainRef,
    clock,
    timeline: schedule?.timeline ?? null,
    baseSpeed: stacked ? BASE_SPEED.stacked : BASE_SPEED.side,
    onTogglePause: togglePause,
    onSkip: skip,
  });

  /**
   * Point at one supporter: mid-roll, pause with their bin seated (jumping to
   * their credit when found by name, nudging forward only as far as the drop
   * when clicked); otherwise fly to their bin.
   */
  const showSupporter = useCallback(
    (id: string, jump: boolean) => {
      setFocusedId(id);
      if (phase === 'roll' && !reducedMotion) {
        const seated = schedule?.seatTimes.get(id);
        if (seated !== undefined) {
          clock.seek(jump ? seated + SEATED_AFTER : Math.max(clock.time, seated + SEATED_AFTER));
        }
        setPaused(true);
      } else {
        flyNonce.current += 1;
        setFlyTo({ id, nonce: flyNonce.current });
      }
    },
    [phase, reducedMotion, schedule, clock, setPaused]
  );

  const onCredit = useCallback(
    (id: string) => {
      if (phase === 'roll' && clock.isPaused && focusedId === id) togglePause();
      else showSupporter(id, false);
    },
    [phase, clock, focusedId, togglePause, showSupporter]
  );

  const onKeyboardFocus = useCallback(
    (id: string) => {
      const at = schedule?.creditTimes.get(id);
      if (at !== undefined) clock.seek(at);
      setPaused(true);
      // An earlier selection would keep the camera and card on someone else.
      setFocusedId((current) => (current === id ? current : null));
    },
    [schedule, clock, setPaused]
  );

  const count = useCountUp(total, !reducedMotion && settled && phase === 'finale');

  const roll = phase === 'roll' && !reducedMotion;
  const besidePlateEarly = roll || reducedMotion;
  const scrimRef = useRef<HTMLDivElement>(null);
  // Fully opaque beside the plate: at anything less, the bright grid lines show through the text.
  const scrimOpacity = besidePlateEarly ? 1 : theme === 'dark' ? 0.92 : 0.88;
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

  const handleFind = () => {
    const found = findSupporter(bins, findQuery);
    if (!found) {
      setFindStatus(
        findQuery.trim() ? t('supporters.find.notFound', { name: findQuery.trim() }) : null
      );
      return;
    }
    showSupporter(found.bin.id, true);
    setFindStatus(
      found.exactMatches > 1
        ? t('supporters.find.multiple', { count: found.exactMatches, name: found.bin.name })
        : t('supporters.find.department', {
            name: found.bin.name,
            department: departmentLabels[departmentOf(found.bin)],
          })
    );
  };

  // The caller's bin is found by NAME, the only handle the public list carries,
  // so an anonymous supporter has no findable bin and the affordance is absent.
  const myBin =
    supporter.status.supporter && supporter.status.name !== null
      ? (bins.find((b) => b.name === supporter.status.name) ?? null)
      : null;

  const besidePlate = besidePlateEarly;
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
        onPointerMissed={() => phase === 'finale' && setFocusedId(null)}
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
            onSelect={phase === 'roll' ? onCredit : setFocusedId}
            anonymousLabel={t('supporters.anonymous')}
            departmentLabels={departmentLabels}
            flyTo={flyTo}
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
        onCredit={onCredit}
        onKeyboardFocus={onKeyboardFocus}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-5">
        <Button
          variant="ghost"
          onClick={navigateHome}
          className="pointer-events-auto flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-sm"
          style={{ color: 'inherit' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t('supporters.back')}
        </Button>
        <div className="flex flex-col items-end gap-2" {...{ [NO_SCRUB_ATTR]: '' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFind();
            }}
            className="pointer-events-auto flex items-center gap-2"
          >
            <div className="w-28 sm:w-44">
              <Input
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                placeholder={t('supporters.find.placeholder')}
                aria-label={t('supporters.find.placeholder')}
                size="sm"
                fullWidth
              />
            </div>
            <Button type="submit" variant="secondary" className="px-3 py-1.5 text-sm">
              {t('supporters.find.submit')}
            </Button>
          </form>
          {findStatus && (
            <p
              className="pointer-events-none max-w-[16rem] rounded-md bg-black/55 px-2.5 py-1 text-right text-xs text-white/90 backdrop-blur-sm"
              role="status"
            >
              {findStatus}
            </p>
          )}
        </div>
      </div>

      {focused && (
        <div
          className="pointer-events-none absolute bottom-[20%] right-0 z-20 flex justify-center px-6"
          style={{ left: stageInset }}
        >
          <div
            className="max-w-sm rounded-md px-5 py-3 text-center text-sm shadow-lg motion-safe:animate-fade-in"
            style={{
              background: palette.tape,
              color: palette.tapeInk,
              border: `1px solid ${palette.accent}66`,
              boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            }}
          >
            <p className="font-semibold">
              {focused.name
                ? t('supporters.thanksNamed', { name: focused.name })
                : t('supporters.thanksAnon')}
            </p>
            {focused.message && <q className="mt-1 block italic opacity-80">{focused.message}</q>}
            <p className="mt-1.5 text-micro uppercase tracking-wider opacity-60">
              {departmentLabels[departmentOf(focused)]}
            </p>
          </div>
        </div>
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
            supporter.status.supporter
              ? t('supporters.panel.yoursTitle')
              : t('supporters.panel.title')
          }
          endTagRef={endTagRef}
          onKofi={handleKofiClick('supporters_page')}
          onReplay={reducedMotion ? undefined : replay}
          onOpenPanel={() => setPanelOpen(true)}
        />
      )}

      <SupporterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        status={supporter.status}
        settled={supporter.settled}
        save={saveProfile}
        onFindMyBin={
          myBin
            ? () => {
                showSupporter(myBin.id, true);
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
