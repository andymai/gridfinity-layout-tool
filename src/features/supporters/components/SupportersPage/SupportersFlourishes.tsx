import { useEffect, useRef, useState } from 'react';
import type { SupportBucket } from '../../utils/supportersData';

/** How long each rotating message holds before the next. */
const MESSAGE_ROTATE_MS = 6000;

/** Self-contained particle burst on a full-screen canvas; no-ops without 2D canvas. */
export function CtaBurst({
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
export function Sparkline({ buckets, color }: { buckets: SupportBucket[]; color: string }) {
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
export function RotatingMessage({
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
