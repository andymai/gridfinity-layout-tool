import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useResolvedTheme } from '@/shared/hooks/useThemeEffect';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import { buildSupporterBins, getSupporterCount } from '../../utils/supportersData';
import { getSupportersPalette } from '../../scene/palette';
import { SupportersScene } from '../SupportersScene';

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

  const bins = useMemo(() => buildSupporterBins(), []);
  const total = getSupporterCount();
  const palette = useMemo(() => getSupportersPalette(theme), [theme]);
  const count = useCountUp(total, !reducedMotion);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; seed: number } | null>(null);

  // Bins set document.body.cursor on hover; reset it if we unmount mid-hover.
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  // Stable so CtaBurst's effect doesn't restart the animation on unrelated re-renders.
  const clearBurst = useCallback(() => setBurst(null), []);

  const focused = focusedId ? bins.find((b) => b.id === focusedId) : null;

  const handleKofiClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    trackEvent('kofi_clicked', { source: 'supporters_page' });
    if (!reducedMotion) {
      const r = e.currentTarget.getBoundingClientRect();
      setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2, seed: Math.random() * 6.28 });
    }
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: palette.background, color: theme === 'dark' ? '#f4f1ea' : '#1b1b1b' }}
    >
      <Canvas
        className="absolute inset-0"
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        frameloop={reducedMotion ? 'demand' : 'always'}
        camera={{ fov: 38, near: 0.1, far: 60, position: [-3, 13.5, 16.5] }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => setFocusedId(null)}
      >
        <Suspense fallback={null}>
          <SupportersScene
            bins={bins}
            theme={theme}
            reducedMotion={reducedMotion}
            quality={isMobile ? 'low' : 'high'}
            focusedId={focusedId}
            onSelect={setFocusedId}
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
      {/* Film grain */}
      <svg
        className="pointer-events-none fixed inset-0 z-10 h-full w-full opacity-[0.05] mix-blend-soft-light"
        aria-hidden="true"
      >
        <filter id="supporters-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#supporters-grain)" />
      </svg>
      {/* Vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        aria-hidden="true"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(125% 105% at 50% 38%, transparent 52%, rgba(0,0,0,0.62) 100%)'
              : 'radial-gradient(125% 105% at 50% 38%, transparent 60%, rgba(60,50,30,0.18) 100%)',
        }}
      />

      {/* Back control */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-5">
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
      </div>

      {/* Hero */}
      <div className="pointer-events-none absolute inset-x-0 top-[8%] z-20 flex flex-col items-center px-6 text-center">
        <h1 className="flex flex-col items-center">
          {/* Static total for AT (avoids announcing the count-up animation). */}
          <span className="sr-only">{total} </span>
          <span
            aria-hidden="true"
            className="text-6xl font-bold tabular-nums leading-none tracking-tight sm:text-8xl"
            style={{ color: palette.accent }}
          >
            {count}
          </span>
          <span className="mt-3 text-lg font-medium tracking-tight sm:text-2xl">
            {t('supporters.countLabel')}
          </span>
        </h1>
        <p
          className="mt-4 max-w-md text-sm leading-relaxed opacity-70 sm:text-base"
          style={{ textWrap: 'balance' }}
        >
          {t('supporters.subheading')}
        </p>
      </div>

      {/* Focused thank-you card */}
      {focused && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[22%] z-20 flex justify-center px-6">
          <div
            className="rounded-full px-5 py-2 text-sm font-medium shadow-lg backdrop-blur-md motion-safe:animate-fade-in"
            style={{
              background: theme === 'dark' ? 'rgba(20,22,30,0.7)' : 'rgba(255,255,255,0.8)',
              border: `1px solid ${palette.accent}55`,
            }}
          >
            {focused.name
              ? t('supporters.thanksNamed', { name: focused.name })
              : t('supporters.thanksAnon')}
          </div>
        </div>
      )}

      {/* CTA + opt-out */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-6 pb-8 text-center">
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
