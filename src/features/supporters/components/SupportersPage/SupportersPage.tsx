import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSettingsStore } from '@/core/store';
import { Button, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useResolvedTheme } from '@/shared/hooks/useThemeEffect';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import {
  buildSupporterBins,
  getSupporterCount,
  joinedThisMonth,
  supportHistogram,
  type SupportBucket,
  type SupporterBin,
} from '../../utils/supportersData';
import { useSupportersData } from '../../hooks/useSupportersData';
import { getSupportersPalette } from '../../scene/palette';
import { SupportersScene, type FlyToRequest } from '../SupportersScene';

/** Months of history the sparkline plots. */
const SPARKLINE_MONTHS = 6;
/** The sparkline only earns its space once support spans a few distinct months. */
const SPARKLINE_MIN_ACTIVE_MONTHS = 3;
/** How long each rotating message holds before the next. */
const MESSAGE_ROTATE_MS = 6000;

function useCountUp(target: number, animate: boolean): number {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / 1600, 1);
      setAnimated(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return animate ? animated : target;
}

/** Self-contained particle burst on a full-screen canvas; no-ops without 2D canvas. */
function CtaBurst({
  origin,
  accent,
  seed,
  onDone,
}: {
  origin: { x: number; y: number };
  accent: string;
  seed: number;
  onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      onDone();
      return;
    }
    // Scale the backing store for crisp particles on high-DPI displays.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const particles = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2 + seed;
      const speed = 3 + (i % 5);
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 2,
        life: 1,
        rot: a,
      };
    });
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = false;
      for (const p of particles) {
        p.vy += 0.12;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.rot += 0.1;
        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = accent;
          ctx.fillRect(-4, -4, 8, 8);
          ctx.restore();
        }
      }
      if (alive) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [origin, accent, seed, onDone]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-30 h-full w-full"
      aria-hidden="true"
    />
  );
}

/**
 * Muted line chart of new supporters per month. The SVG itself is aria-hidden
 * (the shapes carry no meaning to a screen reader); the labeled `<figure>`
 * wrapper in the page is what conveys the chart to assistive tech.
 */
function Sparkline({ buckets, color }: { buckets: SupportBucket[]; color: string }) {
  const width = 104;
  const height = 30;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const step = buckets.length > 1 ? width / (buckets.length - 1) : 0;
  const points = buckets.map((b, i) => {
    const x = i * step;
    const y = height - (b.count / max) * (height - 5) - 3;
    return { x, y };
  });
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1] ?? { x: width, y: height };
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      {/* Soft area under the line so a sparse series still reads as a chart. */}
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={color} opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.95}
      />
      <circle cx={last.x} cy={last.y} r={2.4} fill={color} />
    </svg>
  );
}

/**
 * Cycles slowly through supporters' public messages near the CTA, so the warmth
 * on the wall is visible without hunting for a bin to click. Holds still under
 * reduced motion.
 */
function RotatingMessage({
  items,
  reducedMotion,
  attribution,
}: {
  items: { message: string; name: string | null }[];
  reducedMotion: boolean;
  attribution: (name: string) => string;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reducedMotion || items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), MESSAGE_ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length, reducedMotion]);

  if (items.length === 0) return null;
  const item = items[index % items.length];
  return (
    <p key={index} className="max-w-md text-sm italic opacity-70 motion-safe:animate-fade-in">
      <span>{item.message}</span>
      {item.name && <span className="opacity-60"> {attribution(item.name)}</span>}
    </p>
  );
}

/**
 * Immersive standalone /supporters experience: an orbitable WebGL baseplate
 * where each Ko-fi supporter is a bin. DOM overlays carry the copy, the
 * animated count, the CTA, and an accessible name list (the canvas itself is
 * inert to assistive tech). Falls back to a calm static render for
 * prefers-reduced-motion and lightens on mobile.
 */
export function SupportersPage() {
  const t = useTranslation();
  const theme = useResolvedTheme();
  const { isMobile } = useResponsive();
  const reducedMotion = usePrefersReducedMotion();
  const { navigateHome } = useSupportersRouting();

  const accent = useSettingsStore((state) => state.settings.accentColor);
  const { data: supporters, settled } = useSupportersData();
  const bins = useMemo(() => buildSupporterBins(supporters), [supporters]);
  const total = getSupporterCount(supporters);
  const palette = useMemo(() => getSupportersPalette(theme, accent), [theme, accent]);
  // Gated on `settled` so the count-up starts when the scene actually appears,
  // rather than having already run to the bundled total behind the hold.
  const count = useCountUp(total, !reducedMotion && settled);

  const thisMonth = useMemo(() => joinedThisMonth(supporters), [supporters]);
  const history = useMemo(() => supportHistogram(supporters, SPARKLINE_MONTHS), [supporters]);
  const activeMonths = history.filter((b) => b.count > 0).length;
  const messages = useMemo(
    () =>
      bins.filter((b) => b.message).map((b) => ({ message: b.message as string, name: b.name })),
    [bins]
  );

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToRequest | null>(null);
  const [findQuery, setFindQuery] = useState('');
  const [findStatus, setFindStatus] = useState<string | null>(null);
  const flyNonce = useRef(0);
  const [burst, setBurst] = useState<{ x: number; y: number; seed: number } | null>(null);

  // Bins set document.body.cursor on hover; reset it if we unmount mid-hover.
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  // Stable so CtaBurst's effect doesn't restart the animation on unrelated re-renders.
  const clearBurst = useCallback(() => setBurst(null), []);

  const focused = focusedId ? bins.find((b) => b.id === focusedId) : null;

  // Hold the whole scene until the supporter list settles (a fetch, or the
  // hook's timeout falling back to the bundled list). Rendering early would
  // count up to the bundled total, then restart from zero at the real one, and
  // re-frame the camera — which sizes itself on bin count. The wait is a fetch
  // the page already covers with its lazy-chunk fallback.
  if (!settled) {
    return <main className="h-screen w-screen" style={{ background: palette.background }} />;
  }

  const handleKofiClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    trackEvent('kofi_clicked', { source: 'supporters_page' });
    if (!reducedMotion) {
      const r = e.currentTarget.getBoundingClientRect();
      setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2, seed: Math.random() * 6.28 });
    }
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  const handleFind = () => {
    const query = findQuery.trim();
    if (!query) {
      // Clear any lingering "not found"/"multiple" message from a prior search.
      setFindStatus(null);
      return;
    }
    const needle = query.toLowerCase();
    const named = bins.filter((b): b is SupporterBin & { name: string } => b.name !== null);

    // Exact (case-insensitive) name wins; only if none matches do we fall back to
    // a substring. Both pools are sorted so the pick is stable across the shuffle.
    const exact = named.filter((b) => b.name.toLowerCase() === needle);
    const pool =
      exact.length > 0
        ? exact
        : named
            .filter((b) => b.name.toLowerCase().includes(needle))
            .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));

    if (pool.length === 0) {
      setFindStatus(t('supporters.find.notFound', { name: query }));
      return;
    }
    const target = pool[0];
    setFocusedId(target.id);
    flyNonce.current += 1;
    setFlyTo({ id: target.id, nonce: flyNonce.current });
    // "1 of N named X" only makes sense for genuine duplicate names (exact matches).
    setFindStatus(
      exact.length > 1
        ? t('supporters.find.multiple', { count: exact.length, name: target.name })
        : null
    );
  };

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: palette.background, color: theme === 'dark' ? '#ffffff' : '#1c1b18' }}
    >
      <Canvas
        className="absolute inset-0"
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        frameloop={reducedMotion ? 'demand' : 'always'}
        camera={{ fov: 38, near: 0.1, far: 160, position: [2, 10, 14] }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => setFocusedId(null)}
      >
        <Suspense fallback={null}>
          <SupportersScene
            bins={bins}
            theme={theme}
            accent={accent}
            reducedMotion={reducedMotion}
            focusedId={focusedId}
            onSelect={setFocusedId}
            anonymousLabel={t('supporters.anonymous')}
            flyTo={flyTo}
          />
        </Suspense>
      </Canvas>

      {/* Top scrim — keeps hero copy legible over the bright baseplate */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-10 h-1/2"
        aria-hidden="true"
        style={{
          background: `linear-gradient(to bottom, ${palette.background} 8%, transparent 100%)`,
          opacity: theme === 'dark' ? 0.9 : 0.85,
        }}
      />
      {/* Top bar: back control (left) + find-your-bin (right) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-5">
        <Button
          variant="ghost"
          onClick={navigateHome}
          className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 text-sm"
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

        <div className="flex flex-col items-end gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFind();
            }}
            className="pointer-events-auto flex items-center gap-2"
          >
            <div className="w-36 sm:w-44">
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
              className="pointer-events-none max-w-[15rem] text-right text-xs opacity-80"
              role="status"
            >
              {findStatus}
            </p>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="pointer-events-none absolute inset-x-0 top-[5%] z-20 flex flex-col items-center px-6 text-center">
        <h1 className="flex flex-col items-center">
          {/* Static total for AT (avoids announcing the count-up animation). */}
          <span className="sr-only">{total} </span>
          <span
            aria-hidden="true"
            className="text-7xl font-bold tabular-nums leading-none tracking-tighter sm:text-9xl"
            style={{
              color: palette.accent,
              textShadow:
                theme === 'dark' ? `0 0 48px ${palette.accent}55` : `0 1px 0 rgba(255,255,255,0.6)`,
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
            style={{ color: palette.accent, opacity: 0.85 }}
          >
            {t('supporters.thisMonth', { count: thisMonth })}
          </p>
        )}
        <p
          className="mt-3 max-w-md text-sm leading-relaxed opacity-65 sm:text-base"
          style={{ textWrap: 'balance' }}
        >
          {t('supporters.subheading')}
        </p>
      </div>

      {/* Support-over-time sparkline, tucked in a corner (desktop only) */}
      {activeMonths >= SPARKLINE_MIN_ACTIVE_MONTHS && (
        <figure
          className="pointer-events-none absolute bottom-6 left-6 z-20 m-0 hidden flex-col gap-1 opacity-90 sm:flex"
          aria-label={t('supporters.sparklineLabel', { count: SPARKLINE_MONTHS })}
        >
          <Sparkline buckets={history} color={palette.accent} />
          <figcaption className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-55">
            {t('supporters.sparklineCaption')}
          </figcaption>
        </figure>
      )}

      {/* Focused thank-you card */}
      {focused && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[22%] z-20 flex justify-center px-6">
          {/* Styled like the printed label tape on the bins */}
          <div
            className="rounded-md px-5 py-2 text-sm font-semibold shadow-lg motion-safe:animate-fade-in"
            style={{
              background: palette.tape,
              color: palette.tapeInk,
              border: `1px solid ${palette.accent}66`,
              boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            }}
          >
            {focused.isNewest && (
              <span
                className="mr-2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: palette.accent, color: '#fff' }}
              >
                {t('supporters.justJoined')}
              </span>
            )}
            {focused.name
              ? t('supporters.thanksNamed', { name: focused.name })
              : t('supporters.thanksAnon')}
          </div>
        </div>
      )}

      {/* CTA + opt-out */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-6 pb-8 text-center">
        {/* Hidden while a bin is focused so it doesn't collide with the thank-you card. */}
        {messages.length > 0 && !focused && (
          <RotatingMessage
            items={messages}
            reducedMotion={reducedMotion}
            attribution={(name) => t('supporters.messageBy', { name })}
          />
        )}
        <p className="text-sm opacity-70">{t('supporters.cta.text')}</p>
        <Button
          variant="primary"
          onClick={handleKofiClick}
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
        <p className="max-w-md text-xs opacity-55" style={{ textWrap: 'balance' }}>
          {t('supporters.purpose')}
        </p>
        <p className="max-w-md text-xs opacity-50">
          {t('supporters.optOut')}{' '}
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto underline-offset-2 hover:underline"
          >
            {t('supporters.optOutLink')}
          </a>
        </p>
      </div>

      {/* Accessible, screen-reader-only supporter list (the canvas is inert to AT) */}
      <div className="sr-only">
        <h2>{t('supporters.heading')}</h2>
        <ul aria-label={t('supporters.listAria', { count: total })}>
          {bins.map((bin) => (
            <li key={bin.id}>{bin.name ?? t('supporters.anonymous')}</li>
          ))}
        </ul>
      </div>

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
