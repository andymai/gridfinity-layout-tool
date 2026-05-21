/**
 * Angled-dividers section: tilt the divider between two adjacent compartments
 * to produce a wedge-shaped slot (the silverware-drawer use case, #1822).
 *
 * Each eligible interior divider gets a row with two numeric mm inputs
 * (offsetStart / offsetEnd) and a reset button. Geometry, validation, and
 * scoop/label-tab compat already shipped in the foundation PRs; this is
 * the user-facing surface. Canvas drag handles ship in the next update.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { RotateCcwIcon } from '@/design-system/Icon';
import {
  useAngledDividersSection,
  ANGLED_DIVIDER_UI_MAX,
  ANGLED_DIVIDER_UI_STEP,
  type AngledDividerRow,
} from './useAngledDividersSection';

export function AngledDividersSection() {
  const { state, handlers, meta, t } = useAngledDividersSection();

  if (!state.flagEnabled) return null;

  return (
    <FeatureToggle
      label={t('binDesigner.angledDividers.title')}
      checked={state.hasAnyOverride}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
    >
      {!state.isUnavailable && (
        <div className="flex flex-col gap-2">
          {state.rows.map((row) => (
            <DividerRow
              key={`${row.compartmentA}-${row.compartmentB}`}
              row={row}
              onSetOffset={handlers.setOffset}
              onReset={handlers.resetRow}
              t={t}
            />
          ))}
        </div>
      )}
    </FeatureToggle>
  );
}

interface DividerRowProps {
  readonly row: AngledDividerRow;
  readonly onSetOffset: (row: AngledDividerRow, which: 'start' | 'end', value: number) => void;
  readonly onReset: (row: AngledDividerRow) => void;
  readonly t: ReturnType<typeof useAngledDividersSection>['t'];
}

function DividerRow({ row, onSetOffset, onReset, t }: DividerRowProps) {
  const hasTilt = row.offsetStart !== 0 || row.offsetEnd !== 0;
  const startLabel = t('binDesigner.angledDividers.offsetStart');
  const endLabel = t('binDesigner.angledDividers.offsetEnd');
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-stroke-subtle bg-surface-elevated p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-content-secondary tabular-nums">
          {t('binDesigner.angledDividers.rowLabel', {
            a: String(row.compartmentA + 1),
            b: String(row.compartmentB + 1),
          })}
        </span>
        {hasTilt && (
          <button
            type="button"
            onClick={() => onReset(row)}
            aria-label={t('binDesigner.angledDividers.resetRow')}
            className="text-content-tertiary hover:text-content-secondary transition-colors"
          >
            <RotateCcwIcon size="xs" />
          </button>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">{startLabel}</span>
          <StepperControl
            value={row.offsetStart}
            onChange={(v) => onSetOffset(row, 'start', v)}
            onStep={(delta) =>
              onSetOffset(row, 'start', row.offsetStart + delta * ANGLED_DIVIDER_UI_STEP)
            }
            min={-ANGLED_DIVIDER_UI_MAX}
            max={ANGLED_DIVIDER_UI_MAX}
            step={ANGLED_DIVIDER_UI_STEP}
            variant="desktop"
            ariaLabel={startLabel}
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">{endLabel}</span>
          <StepperControl
            value={row.offsetEnd}
            onChange={(v) => onSetOffset(row, 'end', v)}
            onStep={(delta) =>
              onSetOffset(row, 'end', row.offsetEnd + delta * ANGLED_DIVIDER_UI_STEP)
            }
            min={-ANGLED_DIVIDER_UI_MAX}
            max={ANGLED_DIVIDER_UI_MAX}
            step={ANGLED_DIVIDER_UI_STEP}
            variant="desktop"
            ariaLabel={endLabel}
          />
        </div>
      </div>
    </div>
  );
}
