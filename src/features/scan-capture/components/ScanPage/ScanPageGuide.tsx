/** The scan page's guidance chrome: progress steps, capture guide, example photo and privacy note. */

import type { useTranslation } from '@/i18n';

export type Step = 'capture' | 'review' | 'done';

// In public/ so the lightweight scan bundle isn't bloated by the asset.
const SCAN_EXAMPLE_SRC = '/images/scan/scan-example.webp';

const TONE_DOT: Record<'accent' | 'success', string> = {
  accent: 'bg-accent',
  success: 'bg-success',
};

export function ProgressSteps({
  current,
  labels,
}: {
  readonly current: Step;
  readonly labels: readonly [string, string, string] | string[];
}) {
  const order: Step[] = ['capture', 'review', 'done'];
  const activeIndex = order.indexOf(current);
  return (
    <ol
      className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-2"
      aria-label={labels.join(' · ')}
    >
      {order.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-label font-semibold ${
                active
                  ? 'bg-accent text-on-accent'
                  : done
                    ? 'bg-success/20 text-success'
                    : 'bg-surface-elevated text-content-tertiary'
              }`}
            >
              {done ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`text-xs ${active ? 'text-content-primary' : 'text-content-tertiary'}`}
            >
              {labels[i]}
            </span>
            {i < order.length - 1 && <span className="h-px w-4 bg-stroke-subtle" />}
          </li>
        );
      })}
    </ol>
  );
}

export function CaptureGuide({ t }: { readonly t: ReturnType<typeof useTranslation> }) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <ScanExamplePhoto t={t} />
      <h2 className="text-center text-base font-medium">{t('scan.capture.heading')}</h2>
      <ul className="flex w-full flex-col gap-3">
        <GuideTip text={t('scan.capture.tip.surface')} />
        <GuideTip text={t('scan.capture.tip.card')} />
        <GuideTip text={t('scan.capture.tip.sheet')} />
        <GuideTip text={t('scan.capture.tip.topDown')} />
      </ul>
      <PrivacyNote text={t('scan.capture.privacy')} />
    </div>
  );
}

/** Success check or warning triangle, matching the card-status banner intent. */
export function CardStatusIcon({ ok }: { readonly ok: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`mt-0.5 shrink-0 ${ok ? 'text-success' : 'text-warning'}`}
    >
      {ok ? (
        <path d="M20 6L9 17l-5-5" />
      ) : (
        <>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}

/** Pointing-hand cue that the photo is tappable to re-select the tool. */
export function TapIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-accent"
    >
      <path d="M8 13V5a2 2 0 0 1 4 0v6" />
      <path d="M12 11V4a2 2 0 0 1 4 0v7" />
      <path d="M16 11V6a2 2 0 0 1 4 0v8a8 8 0 0 1-8 8 8 8 0 0 1-7-4l-2.5-4a2 2 0 0 1 3.4-2.1L8 13" />
    </svg>
  );
}

function GuideTip({ text }: { readonly text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-content-secondary">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <span>{text}</span>
    </li>
  );
}

function ScanExamplePhoto({ t }: { readonly t: ReturnType<typeof useTranslation> }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-stroke bg-surface-elevated shadow-sm">
      <img
        src={SCAN_EXAMPLE_SRC}
        alt={t('scan.capture.exampleAlt')}
        className="block h-auto w-full select-none"
        draggable={false}
        decoding="async"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-surface/55 to-transparent" />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <line
          x1="22"
          y1="14"
          x2="28"
          y2="23"
          className="stroke-accent"
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="80"
          y1="14"
          x2="80"
          y2="30"
          className="stroke-success"
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <AnchorDot leftPct={28} topPct={23} tone="accent" />
      <AnchorDot leftPct={80} topPct={30} tone="success" />

      <OverlayChip leftPct={50} topPct={3} tone="neutral" label={t('scan.capture.label.topDown')} />
      <OverlayChip leftPct={22} topPct={8.5} tone="accent" label={t('scan.capture.label.tool')} />
      <OverlayChip leftPct={80} topPct={8.5} tone="success" label={t('scan.capture.label.card')} />
    </div>
  );
}

function AnchorDot({
  leftPct,
  topPct,
  tone,
}: {
  readonly leftPct: number;
  readonly topPct: number;
  readonly tone: 'accent' | 'success';
}) {
  return (
    <span
      aria-hidden="true"
      className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow ring-2 ring-surface ${TONE_DOT[tone]}`}
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    />
  );
}

function StraightDownGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-content-tertiary"
    >
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function OverlayChip({
  leftPct,
  topPct,
  tone,
  label,
}: {
  readonly leftPct: number;
  readonly topPct: number;
  readonly tone: 'accent' | 'success' | 'neutral';
  readonly label: string;
}) {
  return (
    <span
      className="absolute flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface/95 px-2.5 py-1 text-label font-medium text-content-primary shadow-md ring-1 ring-black/[0.06] backdrop-blur-sm"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {tone === 'neutral' ? (
        <StraightDownGlyph />
      ) : (
        <span className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function PrivacyNote({ text }: { readonly text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-center text-label text-content-tertiary">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {text}
    </p>
  );
}
