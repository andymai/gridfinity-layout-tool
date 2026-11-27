import type { LayoutPreview } from '@/core/types';
import { PIXEL_FONT } from '../../../components/CreditsRoll/creditsRollItems';
import { fraction } from './cardMotion';

interface MotionProps {
  readonly elapsed: number;
  readonly reduced: boolean;
  readonly accent: string;
}

/** Shown one at a time, every `step` seconds after `start`. */
function staggered(index: number, elapsed: number, reduced: boolean, start = 0.2, step = 0.08) {
  return fraction(elapsed, start + index * step, 0.45, reduced);
}

/** Few items get big tiles and many get small ones, so the card never looks empty. */
function tileLayout(count: number): { readonly cols: number; readonly size: number } {
  if (count <= 1) return { cols: 1, size: 9 };
  if (count <= 4) return { cols: 2, size: 6 };
  if (count <= 9) return { cols: 3, size: 4.2 };
  return { cols: 4, size: 3.4 };
}

export function IntroVisual({
  year,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly year: number }) {
  return (
    <div
      className="flex text-[4.2em] leading-none"
      style={{ fontFamily: PIXEL_FONT, color: accent, textShadow: `0 0 0.4em ${accent}88` }}
      aria-hidden="true"
    >
      {String(year)
        .split('')
        .map((digit, index) => {
          const shown = staggered(index, elapsed, reduced, 0.2, 0.18);
          return (
            <span
              key={index}
              style={{ opacity: shown, transform: `translateY(${(1 - shown) * -0.6}em)` }}
            >
              {digit}
            </span>
          );
        })}
    </div>
  );
}

/** A cabinet of drawer fronts, one per drawer, up to twelve. */
export function DrawerStack({
  count,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly count: number }) {
  const shown = Math.min(count, 12);
  const cols = shown <= 3 ? 1 : 2;
  const height = shown <= 3 ? 4 : 2.6;
  return (
    <div
      className="grid w-[15em] gap-[0.6em] rounded-[0.8em] border border-white/10 bg-white/[0.03] p-[0.7em]"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      aria-hidden="true"
    >
      {Array.from({ length: shown }, (_, index) => {
        const on = staggered(index, elapsed, reduced);
        return (
          <div
            key={index}
            className="flex items-center justify-center rounded-[0.45em] border"
            style={{
              height: `${height}em`,
              opacity: on,
              transform: `translateX(${(1 - on) * -1.2}em)`,
              borderColor: `${accent}88`,
              background: `linear-gradient(180deg, ${accent}33, ${accent}14)`,
            }}
          >
            <div className="h-[0.3em] w-[2.8em] rounded-full" style={{ background: accent }} />
          </div>
        );
      })}
    </div>
  );
}

/** An 8 × 8 grid that lights one cell per bin, or every cell for 64 and more. */
export function BinGrid({
  count,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly count: number }) {
  const cells = 64;
  const lit = Math.round(Math.min(count, cells) * fraction(elapsed, 0.3, 1.5, reduced));
  return (
    <div className="grid w-[16em] grid-cols-8 gap-[0.35em]" aria-hidden="true">
      {Array.from({ length: cells }, (_, index) => (
        <div
          key={index}
          className="aspect-square rounded-[0.3em]"
          style={{
            background: index < lit ? accent : 'rgba(255,255,255,0.07)',
            boxShadow: index < lit ? `0 0 0.6em ${accent}44` : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Pizza boxes, as squares, up to twenty. */
export function BoxGrid({
  count,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly count: number }) {
  const shown = Math.min(count, 20);
  const { cols, size } = tileLayout(shown);
  return (
    <div
      className="grid gap-[0.5em]"
      style={{ gridTemplateColumns: `repeat(${cols}, ${size}em)` }}
      aria-hidden="true"
    >
      {Array.from({ length: shown }, (_, index) => {
        const on = staggered(index, elapsed, reduced, 0.3, 0.06);
        return (
          <div
            key={index}
            className="aspect-square rounded-[0.35em] border"
            style={{
              opacity: on,
              transform: `scale(${0.6 + 0.4 * on})`,
              borderColor: `${accent}99`,
              background: `linear-gradient(135deg, ${accent}55, ${accent}0d)`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Exported files, as sheets with a down arrow, up to twelve. */
export function FileStack({
  count,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly count: number }) {
  const shown = Math.min(count, 12);
  const { cols, size } = tileLayout(shown);
  return (
    <div
      className="grid gap-[0.6em]"
      style={{ gridTemplateColumns: `repeat(${cols}, ${size * 0.8}em)` }}
      aria-hidden="true"
    >
      {Array.from({ length: shown }, (_, index) => {
        const on = staggered(index, elapsed, reduced, 0.3, 0.07);
        return (
          <svg
            key={index}
            viewBox="0 0 20 24"
            style={{ opacity: on, transform: `translateY(${(1 - on) * -0.8}em)` }}
          >
            <path
              d="M3 1h10l5 5v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
              fill={`${accent}26`}
              stroke={accent}
              strokeWidth={1.2}
            />
            <path
              d="M10 9v8m-3.5-3.5L10 17l3.5-3.5"
              fill="none"
              stroke={accent}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}

/** The drawer's own plan, bins dropping in. Grid y runs up, so rows flip for the SVG. */
export function DrawerPlan({
  preview,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly preview: LayoutPreview }) {
  const w = preview.drawerWidth;
  const d = preview.drawerDepth;
  const bins = preview.binMap ?? [];
  const step = Math.min(0.05, 1.2 / Math.max(1, bins.length));
  return (
    <svg
      viewBox={`-0.2 -0.2 ${w + 0.4} ${d + 0.4}`}
      className="max-h-[19em] w-[16em]"
      aria-hidden="true"
    >
      <rect
        x={0}
        y={0}
        width={w}
        height={d}
        rx={0.3}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={0.06}
      />
      {bins.map((bin, index) => {
        const on = staggered(index, elapsed, reduced, 0.3, step);
        return (
          <rect
            key={index}
            x={bin.x + 0.06}
            y={d - bin.y - bin.d + 0.06}
            width={Math.max(0.1, bin.w - 0.12)}
            height={Math.max(0.1, bin.d - 0.12)}
            rx={0.15}
            fill={accent}
            opacity={on * (0.55 + (0.45 * ((index * 37) % 10)) / 10)}
          />
        );
      })}
    </svg>
  );
}

export function Footprint({
  width,
  depth,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly width: number; readonly depth: number }) {
  const on = fraction(elapsed, 0.3, 0.8, reduced);
  const cols = Math.ceil(width);
  const rows = Math.ceil(depth);
  return (
    <svg
      viewBox={`-0.1 -0.1 ${cols + 0.2} ${rows + 0.2}`}
      className="max-h-[13em] w-[13em]"
      aria-hidden="true"
    >
      {Array.from({ length: cols * rows }, (_, index) => (
        <rect
          key={index}
          x={index % cols}
          y={Math.floor(index / cols)}
          width={1}
          height={1}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={0.02}
        />
      ))}
      <rect
        x={0.05}
        y={0.05}
        width={width - 0.1}
        height={depth - 0.1}
        rx={0.12}
        fill={accent}
        opacity={0.85 * on}
        style={{
          transformOrigin: 'center',
          transformBox: 'fill-box',
          transform: `scale(${0.7 + 0.3 * on})`,
        }}
      />
    </svg>
  );
}

/** A drawn bin, for a design whose thumbnail is not saved yet. */
function BinGlyph({ accent }: { readonly accent: string }) {
  return (
    <svg viewBox="0 0 48 40" className="h-[55%] w-[55%]" aria-hidden="true">
      <path d="M6 14 24 6l18 8-18 8z" fill={`${accent}40`} stroke={accent} strokeWidth={1.4} />
      <path d="M6 14v16l18 8V22z" fill={`${accent}26`} stroke={accent} strokeWidth={1.4} />
      <path d="M42 14v16l-18 8V22z" fill={`${accent}14`} stroke={accent} strokeWidth={1.4} />
      <path d="M11 20.5l9 4" stroke={accent} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

export function ThumbGrid({
  thumbnails,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly thumbnails: readonly (string | null)[] }) {
  const shown = thumbnails.slice(0, 6);
  const cols = shown.length <= 2 ? shown.length : 3;
  return (
    <div
      className="grid w-[16em] gap-[0.6em]"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, 1fr)` }}
      aria-hidden="true"
    >
      {shown.map((src, index) => (
        <div
          key={index}
          className="flex aspect-square items-center justify-center overflow-hidden rounded-[0.7em] border border-white/10 bg-white/5"
          style={{ opacity: staggered(index, elapsed, reduced, 0.3, 0.12) }}
        >
          {src ? (
            <img src={src} alt="" className="h-full w-full object-contain" />
          ) : (
            <BinGlyph accent={accent} />
          )}
        </div>
      ))}
    </div>
  );
}

export function MonthBars({
  counts,
  busiest,
  locale,
  year,
  elapsed,
  reduced,
  accent,
}: MotionProps & {
  readonly counts: readonly number[];
  readonly busiest: number;
  readonly locale: string;
  readonly year: number;
}) {
  const max = Math.max(1, ...counts);
  const letter = new Intl.DateTimeFormat(locale, { month: 'narrow' });
  return (
    <div className="flex h-[12em] w-[17em] items-end gap-[0.35em]" aria-hidden="true">
      {counts.map((count, month) => {
        const grow = staggered(month, elapsed, reduced, 0.2, 0.05);
        return (
          <div
            key={month}
            className="flex h-full flex-1 flex-col items-center justify-end gap-[0.4em]"
          >
            <div
              className="w-full rounded-t-[0.3em]"
              style={{
                height: `${Math.max(4, (count / max) * 100) * grow}%`,
                background: month === busiest ? accent : 'rgba(255,255,255,0.22)',
                boxShadow: month === busiest ? `0 0 0.8em ${accent}99` : undefined,
              }}
            />
            <span className="text-[0.65em] text-white/50">
              {letter.format(new Date(year, month, 15))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SpoolRow({
  count,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly count: number }) {
  const shown = Math.min(count, 8);
  const size = shown <= 2 ? 6 : shown <= 4 ? 4.5 : 3.4;
  return (
    <div className="flex max-w-[17em] flex-wrap justify-center gap-[0.6em]" aria-hidden="true">
      {Array.from({ length: shown }, (_, index) => {
        const on = staggered(index, elapsed, reduced, 0.3, 0.12);
        return (
          <svg
            key={index}
            viewBox="0 0 24 24"
            style={{
              width: `${size}em`,
              height: `${size}em`,
              opacity: on,
              transform: `rotate(${(1 - on) * -120}deg)`,
            }}
          >
            <circle cx={12} cy={12} r={11} fill={`${accent}33`} stroke={accent} strokeWidth={1.2} />
            <circle
              cx={12}
              cy={12}
              r={7.5}
              fill="none"
              stroke={accent}
              strokeWidth={0.6}
              strokeDasharray="1.5 1.2"
            />
            <circle cx={12} cy={12} r={3} fill="#0d0d14" stroke={accent} strokeWidth={1} />
          </svg>
        );
      })}
    </div>
  );
}

export function HeroThumb({
  src,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly src: string | null }) {
  const on = fraction(elapsed, 0.2, 0.9, reduced);
  return (
    <div
      className="flex h-[16em] w-[16em] items-center justify-center rounded-[1.4em] border border-white/10 bg-white/5"
      style={{
        opacity: on,
        transform: `scale(${0.9 + 0.1 * on})`,
        boxShadow: `0 0 3em ${accent}33`,
      }}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : (
        <BinGlyph accent={accent} />
      )}
    </div>
  );
}

export function TypeBadge({
  name,
  elapsed,
  reduced,
  accent,
}: MotionProps & { readonly name: string }) {
  const on = fraction(elapsed, 0.6, 0.8, reduced);
  return (
    <p
      className="max-w-[13em] rounded-[0.7em] border px-[1em] py-[0.9em] text-center text-[1.2em] uppercase leading-[1.7]"
      style={{
        fontFamily: PIXEL_FONT,
        color: accent,
        borderColor: `${accent}99`,
        opacity: on,
        transform: `scale(${1.2 - 0.2 * on})`,
        boxShadow: `0 0 ${2 * on}em ${accent}55`,
      }}
    >
      {name}
    </p>
  );
}
