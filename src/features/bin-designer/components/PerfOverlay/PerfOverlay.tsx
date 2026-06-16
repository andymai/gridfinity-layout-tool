/* eslint-disable i18next/no-literal-string -- Dev-only overlay (Labs flag); strings are technical metric labels, not user-facing copy. */
/**
 * Dev-only performance overlay for bin generation.
 *
 * Visible when the `show_generation_perf` labs flag is on. Renders the
 * latest snapshot's per-stage timings, wall-pattern substeps, and a
 * sparkline of the last N generations so regressions are obvious during
 * iterative editing.
 *
 * Hidden when no snapshots have been captured yet (e.g., before the
 * first generation completes).
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import type { PerfSnapshot, PerfSubstepEntry } from '@/shared/types/generation';

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 24;

export function PerfOverlay() {
  const enabled = useFeatureFlag('show_generation_perf');
  const { perfHistory, clearPerfHistory } = useDesignerStore(
    useShallow((s) => ({
      perfHistory: s.generation.perfHistory,
      clearPerfHistory: s.clearPerfHistory,
    }))
  );

  if (!enabled || perfHistory.length === 0) return null;

  const latest = perfHistory[perfHistory.length - 1];
  return (
    <div
      className="pointer-events-auto absolute right-3 top-3 z-20 w-72 rounded-lg border border-stroke-subtle bg-surface-primary/95 p-3 text-[11px] font-mono shadow-lg backdrop-blur-sm"
      aria-label="Generation performance overlay"
    >
      <Header
        totalMs={latest.totalMs}
        sampleCount={perfHistory.length}
        onClear={clearPerfHistory}
      />
      <Sparkline history={perfHistory} />
      <Counts hexCenters={latest.hexCenterCount} patternTools={latest.patternCutToolCount} />
      <StageTable label="Pipeline stages" entries={latest.stages} totalMs={latest.totalMs} />
      {latest.featureBuilders.length > 0 && (
        <SubstepTable label="Feature builders" entries={latest.featureBuilders} />
      )}
      {latest.wallPatternSubsteps.length > 0 && (
        <SubstepTable label="Wall pattern substeps" entries={latest.wallPatternSubsteps} />
      )}
    </div>
  );
}

function Header({
  totalMs,
  sampleCount,
  onClear,
}: {
  totalMs: number;
  sampleCount: number;
  onClear: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <div className="flex items-baseline gap-1.5">
        <span className="text-text-primary font-semibold">Gen</span>
        <span className="text-text-primary text-sm">{fmtMs(totalMs)}</span>
        <span className="text-text-tertiary">({sampleCount})</span>
      </div>
      <Button
        variant="ghost"
        type="button"
        onClick={onClear}
        className="text-text-tertiary hover:text-text-primary hover:bg-transparent underline underline-offset-2"
      >
        clear
      </Button>
    </div>
  );
}

function Sparkline({ history }: { history: readonly PerfSnapshot[] }) {
  const points = useMemo(() => {
    if (history.length < 2) return '';
    const recent = history.slice(-20);
    const values = recent.map((s) => s.totalMs);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = Math.max(max - min, 1);
    const step = SPARKLINE_WIDTH / Math.max(recent.length - 1, 1);
    return recent
      .map((s, i) => {
        const x = i * step;
        const y = SPARKLINE_HEIGHT - ((s.totalMs - min) / range) * SPARKLINE_HEIGHT;
        return `${x},${y}`;
      })
      .join(' ');
  }, [history]);

  if (!points) return null;
  return (
    <svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      className="mb-2 block"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        className="text-info"
      />
    </svg>
  );
}

function Counts({ hexCenters, patternTools }: { hexCenters: number; patternTools: number }) {
  if (hexCenters === 0 && patternTools === 0) return null;
  return (
    <div className="mb-2 flex gap-3 text-text-tertiary">
      {hexCenters > 0 && <span>hex centers: {hexCenters}</span>}
      {patternTools > 0 && <span>pattern tools: {patternTools}</span>}
    </div>
  );
}

function StageTable({
  label,
  entries,
  totalMs,
}: {
  label: string;
  entries: readonly { name: string; ms: number }[];
  totalMs: number;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="text-text-tertiary mb-0.5 uppercase tracking-wide">{label}</div>
      {entries.map((e) => (
        <div key={e.name} className="flex items-center gap-1.5">
          <span className="text-text-primary w-24 truncate">{e.name}</span>
          <span className="w-12 text-right tabular-nums">{fmtMs(e.ms)}</span>
          <BarFill pct={Math.min(1, e.ms / Math.max(totalMs, 1))} />
        </div>
      ))}
    </div>
  );
}

function SubstepTable({ label, entries }: { label: string; entries: readonly PerfSubstepEntry[] }) {
  const maxMs = entries.reduce((acc, e) => Math.max(acc, e.ms), 0);
  return (
    <div className="mb-2">
      <div className="text-text-tertiary mb-0.5 uppercase tracking-wide">{label}</div>
      {entries.map((e) => (
        <div key={e.name} className="flex items-center gap-1.5">
          <span className="text-text-primary w-32 truncate">
            {e.name}
            {e.count !== undefined ? ` (${e.count})` : ''}
          </span>
          <span className="w-12 text-right tabular-nums">{fmtMs(e.ms)}</span>
          <BarFill pct={maxMs > 0 ? e.ms / maxMs : 0} />
        </div>
      ))}
    </div>
  );
}

function BarFill({ pct }: { pct: number }) {
  return (
    <div className="bg-surface-secondary h-1.5 flex-1 overflow-hidden rounded">
      <div className="bg-info h-full" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

function fmtMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${Math.round(ms)}ms`;
}
