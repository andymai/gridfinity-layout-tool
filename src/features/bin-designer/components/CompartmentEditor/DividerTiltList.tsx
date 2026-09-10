import { Button } from '@/design-system';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { DividerMiniDiagram } from './DividerDiagrams';
import type { TiltRow, useDividerTiltSubsection } from './useDividerTiltSubsection';

type Hook = ReturnType<typeof useDividerTiltSubsection>;
type Handlers = Hook['handlers'];
type Translate = Hook['t'];

interface DividerTiltListProps {
  readonly rows: readonly TiltRow[];
  readonly compartments: CompartmentConfig;
  readonly hoveredKey: string | null;
  readonly hasAnyOverride: boolean;
  readonly handlers: Handlers;
  readonly t: Translate;
}

export function DividerTiltList({
  rows,
  compartments,
  hoveredKey,
  hasAnyOverride,
  handlers,
  t,
}: DividerTiltListProps) {
  // Present in display-number order so the list scans like the numbers on the
  // grid. Display-only: the hook's row order (stable ID pairs) is what the
  // Bento dock and the hit targets key off, and stays untouched.
  const sorted = [...rows].sort(
    (a, b) =>
      Math.min(a.numberA, a.numberB) - Math.min(b.numberA, b.numberB) ||
      Math.max(a.numberA, a.numberB) - Math.max(b.numberA, b.numberB)
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {sorted.map((row) => (
          <DividerRow
            key={row.key}
            row={row}
            compartments={compartments}
            isHovered={hoveredKey === row.key}
            handlers={handlers}
            t={t}
          />
        ))}
      </div>
      {hasAnyOverride && (
        <Button
          type="button"
          variant="ghost"
          onClick={handlers.resetAll}
          className="self-end px-0 py-0 text-label font-medium text-accent transition-colors hover:bg-transparent hover:text-accent/80"
        >
          {t('binDesigner.angledDividers.resetAll')}
        </Button>
      )}
    </div>
  );
}

interface DividerRowProps {
  readonly row: TiltRow;
  readonly compartments: CompartmentConfig;
  readonly isHovered: boolean;
  readonly handlers: Handlers;
  readonly t: Translate;
}

function DividerRow({ row, compartments, isHovered, handlers, t }: DividerRowProps) {
  // Ascending display numbers: the ID-canonical pair order can put the higher
  // number first (bottom-row IDs display as high numbers), which reads as noise.
  const lo = String(Math.min(row.numberA, row.numberB));
  const hi = String(Math.max(row.numberA, row.numberB));
  const rowLabel = t('binDesigner.angledDividers.rowLabel', { a: lo, b: hi });
  const hasPlanTilt = row.offsetStart !== 0 || row.offsetEnd !== 0;
  const leanRounded = Math.round(row.leanDeg);

  return (
    <div
      onPointerEnter={() => handlers.hoverDivider(row.key)}
      onPointerLeave={() => handlers.hoverDivider(null)}
      onFocusCapture={() => handlers.hoverDivider(row.key)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) handlers.hoverDivider(null);
      }}
      className={`flex items-center rounded-md border bg-surface-elevated transition-colors ${
        isHovered
          ? 'border-accent/60 bg-accent/5'
          : 'border-stroke-subtle hover:border-stroke-subtle/80'
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={() => handlers.selectDivider(row.key)}
        aria-label={t('binDesigner.angledDividers.editRowLabel', { a: lo, b: hi })}
        className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
      >
        <DividerMiniDiagram compartments={compartments} row={row} />
        <span className="text-xs font-medium text-content-secondary tabular-nums">{rowLabel}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {row.hasTilt && hasPlanTilt && (
            <span className="text-label font-medium tabular-nums text-accent">
              {t('binDesigner.angledDividers.badgeAngle', {
                angle: String(Math.round(row.angleDeg)),
              })}
            </span>
          )}
          {leanRounded !== 0 && (
            <span className="text-label font-medium tabular-nums text-content-secondary">
              {t('binDesigner.angledDividers.rowBadgeLean', { angle: String(leanRounded) })}
            </span>
          )}
        </span>
      </Button>
    </div>
  );
}
