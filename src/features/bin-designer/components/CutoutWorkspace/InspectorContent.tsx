/**
 * Property surface for the cutout inspector dock — selection-aware body with
 * no positioning concerns. Renders the single-cutout sections, the multi-select
 * shared fields, or an empty placeholder. The docked shell (InspectorDock)
 * owns width, collapse, and persistence.
 */

import { useMemo } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import { SingleCutoutInspector } from './SingleCutoutInspector';
import { CutoutBoardSettings } from './CutoutBoardSettings';
import { BinSizeSection } from './BinSizeSection';

/** Editor-level settings surfaced in the empty (no-selection) state. */
export interface BoardSettings {
  readonly gridSize: number;
  readonly onGridSizeChange: (size: number) => void;
  readonly snapEnabled: boolean;
  readonly onSnapToggle: (enabled: boolean) => void;
}

interface InspectorContentProps {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly preview: ReadonlyMap<string, Partial<Cutout>>;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly maxCutDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly disabled?: boolean;
  readonly onFitCue?: (cue: FitCue) => void;
  readonly onFlattenArray?: (id: string) => void;
  readonly board?: BoardSettings;
  /** Count of cutouts stranded past the board after a resize (0 = none). */
  readonly offBoardCount?: number;
  /** Clamp every off-board cutout back inside the board. */
  readonly onClampOffBoard?: () => void;
}

/** Effective field value, merging this cutout's live preview override. */
function getEffective<K extends keyof Cutout>(
  cutout: Cutout,
  preview: ReadonlyMap<string, Partial<Cutout>>,
  key: K
): Cutout[K] {
  const override = preview.get(cutout.id);
  if (override && key in override) return override[key] as Cutout[K];
  return cutout[key];
}

/** Shared value across multiple cutouts for a field; null when mixed. */
function getSharedValue(
  cutouts: readonly Cutout[],
  preview: ReadonlyMap<string, Partial<Cutout>>,
  key: keyof Cutout
): number | null {
  if (cutouts.length === 0) return null;
  const first = getEffective(cutouts[0], preview, key) as number;
  for (let i = 1; i < cutouts.length; i++) {
    if ((getEffective(cutouts[i], preview, key) as number) !== first) return null;
  }
  return first;
}

export function InspectorContent({
  cutouts,
  selection,
  preview,
  binWidth,
  binDepth,
  maxCutDepth,
  onUpdate,
  onUpdateBatch,
  disabled = false,
  onFitCue,
  onFlattenArray,
  board,
  offBoardCount = 0,
  onClampOffBoard,
}: InspectorContentProps) {
  const t = useTranslation();

  const selectedCutouts = useMemo(
    () => cutouts.filter((c) => selection.has(c.id)),
    [cutouts, selection]
  );

  // Bin-size controls stay visible across every selection state so the user can
  // resize without leaving the editor.
  const binSize = (
    <BinSizeSection offBoardCount={offBoardCount} onClampOffBoard={onClampOffBoard} />
  );

  if (selectedCutouts.length === 0) {
    return (
      <div className="space-y-1.5">
        {binSize}
        {board ? (
          <CutoutBoardSettings
            gridSize={board.gridSize}
            onGridSizeChange={board.onGridSizeChange}
            snapEnabled={board.snapEnabled}
            onSnapToggle={board.onSnapToggle}
            binWidth={binWidth}
            binDepth={binDepth}
            cutoutCount={cutouts.length}
          />
        ) : (
          <div className="flex flex-col gap-1 px-1 pt-3 text-center">
            <p className="text-xs text-content-secondary">
              {t('binDesigner.cutoutEditor.inspectorEmptyTitle')}
            </p>
            <p className="text-xs text-content-tertiary">
              {t('binDesigner.cutoutEditor.inspectorEmptyHint')}
            </p>
          </div>
        )}
      </div>
    );
  }

  const isSingle = selectedCutouts.length === 1;
  const singleCutout = isSingle ? selectedCutouts[0] : null;

  const sharedCutDepth = getSharedValue(selectedCutouts, preview, 'cutDepth');
  const sharedRotation = getSharedValue(selectedCutouts, preview, 'rotation');
  const sharedScoopRadiusW = getSharedValue(selectedCutouts, preview, 'scoopRadiusW');
  const sharedScoopRadiusD = getSharedValue(selectedCutouts, preview, 'scoopRadiusD');

  const handleBatchUpdate = (key: keyof Cutout, value: number) => {
    if (onUpdateBatch && selectedCutouts.length > 1) {
      const updates = new Map<string, Partial<Cutout>>();
      for (const c of selectedCutouts) updates.set(c.id, { [key]: value });
      onUpdateBatch(updates);
    }
  };

  // Non-rectangle cutouts collapse W/D to a single value via max() in the
  // generator, so writing only one axis would silently no-op when the other is
  // larger. Write both axes for circles/paths to keep the slider meaningful.
  const handleScoopAxisBatch = (axis: 'scoopRadiusW' | 'scoopRadiusD', value: number) => {
    if (onUpdateBatch && selectedCutouts.length > 1) {
      const updates = new Map<string, Partial<Cutout>>();
      for (const c of selectedCutouts) {
        updates.set(
          c.id,
          c.shape === 'rectangle' ? { [axis]: value } : { scoopRadiusW: value, scoopRadiusD: value }
        );
      }
      onUpdateBatch(updates);
    }
  };

  return (
    <div className="space-y-1.5">
      {binSize}
      {singleCutout && (
        <SingleCutoutInspector
          cutout={singleCutout}
          preview={preview}
          binWidth={binWidth}
          binDepth={binDepth}
          maxCutDepth={maxCutDepth}
          onUpdate={onUpdate}
          onFitCue={onFitCue}
          onFlattenArray={onFlattenArray}
          disabled={disabled}
        />
      )}

      {!isSingle && selectedCutouts.length > 1 && (
        <>
          <div className="text-[10px] font-medium uppercase tracking-wide text-content-tertiary">
            {t('binDesigner.cutoutEditor.selectedCount', { count: selectedCutouts.length })}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <CompactNumberInput
              label={t('binDesigner.cutouts.rotation')}
              value={sharedRotation ?? 0}
              indeterminate={sharedRotation === null}
              onChange={(rotation) => handleBatchUpdate('rotation', rotation)}
              min={0}
              max={359}
              step={1}
              unit="°"
              disabled={disabled}
            />
            <CompactNumberInput
              label={t('binDesigner.cutouts.cutDepth')}
              value={sharedCutDepth ?? 5}
              indeterminate={sharedCutDepth === null}
              onChange={(cutDepth) => handleBatchUpdate('cutDepth', cutDepth)}
              min={0.5}
              max={maxCutDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label={t('binDesigner.cutouts.scoopW')}
              value={sharedScoopRadiusW ?? 0}
              indeterminate={sharedScoopRadiusW === null}
              onChange={(scoopRadiusW) => handleScoopAxisBatch('scoopRadiusW', scoopRadiusW)}
              min={0}
              max={sharedCutDepth ?? maxCutDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label={t('binDesigner.cutouts.scoopD')}
              value={sharedScoopRadiusD ?? 0}
              indeterminate={sharedScoopRadiusD === null}
              onChange={(scoopRadiusD) => handleScoopAxisBatch('scoopRadiusD', scoopRadiusD)}
              min={0}
              max={sharedCutDepth ?? maxCutDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
          </div>
        </>
      )}

      {singleCutout?.locked && (
        <div className="flex gap-1.5 text-[10px] text-content-tertiary">
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
            {t('binDesigner.cutoutEditor.locked')}
          </span>
        </div>
      )}
    </div>
  );
}
