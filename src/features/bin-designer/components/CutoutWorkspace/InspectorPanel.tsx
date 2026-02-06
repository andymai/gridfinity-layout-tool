/**
 * Unified inspector panel for the cutout workspace.
 *
 * Combines transform fields (compact number inputs), cut depth,
 * alignment actions, and shape actions into a single right-side panel.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { clampRotationToBounds } from '../panel/CutoutsSection/geometry';
import { AlignmentToolbar } from '../panel/CutoutsSection/AlignmentToolbar';

interface InspectorPanelProps {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly maxCutDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onRemove: (id: string) => void;
  readonly onDuplicate: (ids: readonly string[]) => void;
  readonly onGroup: (ids: readonly string[]) => void;
  readonly onUngroup: (ids: readonly string[]) => void;
  readonly onClearAll: () => void;
  readonly disabled?: boolean;
}

export function InspectorPanel({
  cutouts,
  selection,
  binWidth,
  binDepth,
  maxCutDepth,
  onUpdate,
  onRemove,
  onDuplicate,
  onGroup,
  onUngroup,
  onClearAll,
  disabled = false,
}: InspectorPanelProps) {
  const t = useTranslation();
  const selectedIds = [...selection];
  const selectedCutout =
    selection.size === 1 ? (cutouts.find((c) => selection.has(c.id)) ?? null) : null;

  // No selection: show instructions
  if (selection.size === 0) {
    return (
      <div className="text-xs text-content-tertiary leading-relaxed">
        {t('binDesigner.cutoutEditor.noSelection')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Transform section — single selection */}
      {selectedCutout && (
        <section>
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
            {t('binDesigner.cutoutEditor.transform')}
          </h3>
          <div className="grid grid-cols-2 gap-1">
            <CompactNumberInput
              label="X"
              value={selectedCutout.x}
              onChange={(x) => onUpdate(selectedCutout.id, { x })}
              min={0}
              max={binWidth - selectedCutout.width}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="Y"
              value={selectedCutout.y}
              onChange={(y) => onUpdate(selectedCutout.id, { y })}
              min={0}
              max={binDepth - selectedCutout.depth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="W"
              value={selectedCutout.width}
              onChange={(width) => onUpdate(selectedCutout.id, { width })}
              min={2}
              max={binWidth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="H"
              value={selectedCutout.depth}
              onChange={(depth) => onUpdate(selectedCutout.id, { depth })}
              min={2}
              max={binDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="R"
              value={selectedCutout.rotation}
              onChange={(rotation) => {
                const clamped = clampRotationToBounds(selectedCutout, rotation, binWidth, binDepth);
                onUpdate(selectedCutout.id, { rotation: clamped });
              }}
              min={0}
              max={359}
              step={1}
              unit="°"
              disabled={disabled}
            />
            {selectedCutout.shape === 'rectangle' && (
              <CompactNumberInput
                label="CR"
                value={selectedCutout.cornerRadius}
                onChange={(cornerRadius) => onUpdate(selectedCutout.id, { cornerRadius })}
                min={0}
                max={Math.min(selectedCutout.width, selectedCutout.depth) / 2}
                step={0.5}
                unit="mm"
                disabled={disabled}
              />
            )}
          </div>
        </section>
      )}

      {/* Cut depth section */}
      {selectedCutout && (
        <section>
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
            {t('binDesigner.cutoutEditor.cutDepth')}
          </h3>
          <CompactNumberInput
            label="D"
            value={selectedCutout.cutDepth}
            onChange={(cutDepth) => onUpdate(selectedCutout.id, { cutDepth })}
            min={0.5}
            max={maxCutDepth}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
        </section>
      )}

      {/* Alignment section — multi-select */}
      {selectedIds.length >= 2 && (
        <section>
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
            {t('binDesigner.cutoutEditor.alignment')}
          </h3>
          <AlignmentToolbar
            selectedIds={selectedIds}
            cutouts={cutouts}
            binWidth={binWidth}
            binDepth={binDepth}
            onUpdate={onUpdate}
            onGroup={onGroup}
            onUngroup={onUngroup}
            onDuplicate={onDuplicate}
          />
        </section>
      )}

      {/* Actions section */}
      <section>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
          {t('binDesigner.cutoutEditor.actions')}
        </h3>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors"
            onClick={() => onDuplicate(selectedIds)}
            disabled={disabled}
          >
            {t('binDesigner.cutouts.duplicate')}
          </button>
          {selectedCutout && (
            <button
              type="button"
              className="rounded border border-red-500/30 bg-surface-elevated px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={() => onRemove(selectedCutout.id)}
              disabled={disabled}
            >
              {t('binDesigner.cutouts.delete')}
            </button>
          )}
          {cutouts.length > 0 && (
            <button
              type="button"
              className="rounded border border-red-500/30 bg-surface-elevated px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={onClearAll}
            >
              {t('binDesigner.cutouts.clearAll')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
