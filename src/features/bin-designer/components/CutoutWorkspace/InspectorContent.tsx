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
import { CHAMFER_SHAPES, MAX_CUTOUT_CHAMFER, maxEntryChamfer } from '@/features/bin-designer/types';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import type { GrowTarget } from '../panel/CutoutsSection/growBinToFit';
import { alignSelection, distributeSelection } from '../panel/CutoutsSection/geometryAlign';
import { expandSelectionToGroups } from '../panel/CutoutsSection/cutoutGroups';
import { CutoutArrayControls } from '../panel/CutoutsSection/CutoutArrayControls';
import { arrayInstanceCount, canGroupArray, groupRepeatBox } from '@/shared/utils/cutoutArray';
import { useDesignerStore } from '@/features/bin-designer/store';
import { Collapsible } from '@/design-system';
import type { AlignMode, DistributeAxis } from '../panel/CutoutsSection/geometryAlign';
import { SingleCutoutInspector } from './SingleCutoutInspector';
import { CutoutColorControls } from './CutoutColorControls';
import { CutoutBoardSettings } from './CutoutBoardSettings';
import { BinSizeSection } from './BinSizeSection';
import { BinFeaturesSection } from './BinFeaturesSection';
import { FitTestButton } from './FitTestButton';
import { AlignControls } from './AlignControls';
import { RepeatSuggestion } from './RepeatSuggestion';
import { useRepeatSuggestion } from '@/features/bin-designer/hooks/useRepeatSuggestion';

/** Matches the per-cutout minimum the single-cutout inspector enforces. */
const MIN_CUTOUT_SIZE_MM = 2;

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
  /**
   * The host cuts clean through, so `cutDepth` and the scoop fillets are inert on
   * a lid's plate: there is no floor for a pocket to stop at or a fillet to curve
   * against. Hidden rather than disabled, because a disabled stepper still shows a
   * number the geometry does not use.
   */
  readonly throughOnly?: boolean;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly disabled?: boolean;
  readonly onFitCue?: (cue: FitCue) => void;
  readonly onFlattenArray?: (id: string) => void;
  /** Bakes a repeated group into one independent group per copy. */
  readonly onFlattenGroupArray?: (id: string) => void;
  readonly board?: BoardSettings;
  /** Count of cutouts stranded past the board after a resize (0 = none). */
  readonly offBoardCount?: number;
  /** Count of cutouts the generator will cut shallower than requested. */
  readonly depthShortfallCount?: number;
  /** Clamp every off-board cutout back inside the board. */
  readonly onClampOffBoard?: () => void;
  /** Center every off-board cutout as one block. */
  readonly onCenterOffBoard?: () => void;
  /** Bin size that would fit every stray, or `null` when growing can't clear it. */
  readonly growTarget?: GrowTarget | null;
  /** Resize the bin to {@link growTarget}. */
  readonly onGrowToFit?: () => void;
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

/**
 * Shared value of a non-numeric field. Returns the common value, or `null` when
 * the selection is mixed. The field's own `undefined` (e.g. all uncolored) is a
 * legitimate shared value and is distinct from mixed.
 */
function getSharedField<K extends keyof Cutout>(
  cutouts: readonly Cutout[],
  preview: ReadonlyMap<string, Partial<Cutout>>,
  key: K
): Cutout[K] | null {
  if (cutouts.length === 0) return null;
  const first = getEffective(cutouts[0], preview, key);
  for (let i = 1; i < cutouts.length; i++) {
    if (getEffective(cutouts[i], preview, key) !== first) return null;
  }
  return first;
}

/**
 * The group a selection covers exactly, or null.
 *
 * "Exactly" is both directions: every selected cutout is in the same group, and
 * every member of that group is selected. Clicking a member on the canvas
 * produces this, while ctrl-picking two of a group's three members from the
 * shape list does not, and setting a shared repeat from that partial selection
 * would write it onto a member the user cannot see they are editing.
 */
function selectedWholeGroup(
  all: readonly Cutout[],
  selected: readonly Cutout[]
): readonly Cutout[] | null {
  if (selected.length < 2) return null;
  const groupId = selected[0].groupId;
  if (groupId === null) return null;
  if (selected.some((c) => c.groupId !== groupId)) return null;
  const members = all.filter((c) => c.groupId === groupId);
  return members.length === selected.length ? members : null;
}

export function InspectorContent({
  cutouts,
  selection,
  preview,
  binWidth,
  binDepth,
  maxCutDepth,
  throughOnly = false,
  onUpdate,
  onUpdateBatch,
  disabled = false,
  onFitCue,
  onFlattenArray,
  onFlattenGroupArray,
  board,
  offBoardCount = 0,
  depthShortfallCount = 0,
  onClampOffBoard,
  onCenterOffBoard,
  growTarget,
  onGrowToFit,
}: InspectorContentProps) {
  const t = useTranslation();

  const selectedCutouts = useMemo(
    () => cutouts.filter((c) => selection.has(c.id)),
    [cutouts, selection]
  );

  // Align/distribute treat a group as one rigid body, so a partially-selected
  // group is pulled in whole before the math runs.
  const arrangeTargets = useMemo(
    () => expandSelectionToGroups(cutouts, selectedCutouts),
    [cutouts, selectedCutouts]
  );

  // Called above the empty-selection early return so hook order stays stable;
  // it returns null for selections that are not a pattern anyway.
  const repeatSuggestion = useRepeatSuggestion(cutouts, selection, binWidth, binDepth, 'inspector');

  // Same reason: the group Repeat section renders far below the early return,
  // but its hook cannot.
  const setCutoutArray = useDesignerStore((st) => st.setCutoutArray);

  // Bin-level controls stay visible across every selection state so the user can
  // resize the board and clear the stacking lip without leaving the editor.
  const binControls = (
    <>
      <BinSizeSection
        offBoardCount={offBoardCount}
        onClampOffBoard={onClampOffBoard}
        onCenterOffBoard={onCenterOffBoard}
        depthShortfallCount={depthShortfallCount}
        growTarget={growTarget}
        onGrowToFit={onGrowToFit}
      />
      <BinFeaturesSection />
      <FitTestButton />
    </>
  );

  if (selectedCutouts.length === 0) {
    return (
      <div className="space-y-1.5">
        {binControls}
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
  // The group the selection IS, or null when it is a loose set or only part of
  // a group. A repeat belongs to the whole assembly, so a partial selection
  // must not be able to set one for members it does not include.
  const wholeGroup = selectedWholeGroup(cutouts, selectedCutouts);
  const groupArray = wholeGroup?.find((m) => m.array !== undefined)?.array;

  const sharedCutDepth = getSharedValue(selectedCutouts, preview, 'cutDepth');
  const sharedRotation = getSharedValue(selectedCutouts, preview, 'rotation');
  const sharedScoopRadiusW = getSharedValue(selectedCutouts, preview, 'scoopRadiusW');
  const sharedScoopRadiusD = getSharedValue(selectedCutouts, preview, 'scoopRadiusD');
  const sharedX = getSharedValue(selectedCutouts, preview, 'x');
  const sharedY = getSharedValue(selectedCutouts, preview, 'y');
  const sharedWidth = getSharedValue(selectedCutouts, preview, 'width');
  const sharedDepth = getSharedValue(selectedCutouts, preview, 'depth');
  const chamferCutouts = selectedCutouts.filter((c) => CHAMFER_SHAPES.includes(c.shape));
  const sharedChamfer = getSharedValue(chamferCutouts, preview, 'chamferWidth');

  // `transformOnly` fields fall under the lock contract ("cannot be moved,
  // resized, or rotated"); cut depth and colour do not, so they still apply to
  // locked shapes.
  const handleBatchUpdate = (key: keyof Cutout, value: number, transformOnly = false) => {
    if (!onUpdateBatch || selectedCutouts.length <= 1) return;
    const updates = new Map<string, Partial<Cutout>>();
    for (const c of selectedCutouts) {
      if (transformOnly && c.locked) continue;
      updates.set(c.id, { [key]: value });
    }
    if (updates.size > 0) onUpdateBatch(updates);
  };

  // Position is per-cutout clamped: an X that fits a 10mm hole runs a 40mm one
  // past the wall, so each shape gets its own ceiling rather than the control
  // refusing the whole edit. Size is not — a typed W/H is a measurement, and it
  // is kept past the board for the grow-to-fit action to resolve.
  const handleGeometryBatch = (key: 'x' | 'y' | 'width' | 'depth', value: number) => {
    if (!onUpdateBatch || selectedCutouts.length <= 1) return;
    const updates = new Map<string, Partial<Cutout>>();
    for (const c of selectedCutouts) {
      if (c.locked) continue;
      if (key === 'width' || key === 'depth') {
        // Meshes carry baked geometry — resizing them would desync the asset.
        if (c.shape === 'mesh') continue;
        updates.set(c.id, { [key]: Math.max(MIN_CUTOUT_SIZE_MM, value) });
        continue;
      }
      // An oversize cutout leaves no valid offset on this axis; pin it to 0.
      const limit = Math.max(0, key === 'x' ? binWidth - c.width : binDepth - c.depth);
      updates.set(c.id, { [key]: Math.max(0, Math.min(value, limit)) });
    }
    if (updates.size > 0) onUpdateBatch(updates);
  };

  // Chamfer headroom depends on each cutout's own cut depth, and not every
  // shape takes one — so ineligible shapes are skipped rather than blocking the
  // control for the whole selection.
  const handleChamferBatch = (value: number) => {
    if (!onUpdateBatch || selectedCutouts.length <= 1) return;
    const updates = new Map<string, Partial<Cutout>>();
    for (const c of selectedCutouts) {
      if (!CHAMFER_SHAPES.includes(c.shape)) continue;
      updates.set(c.id, { chamferWidth: Math.min(value, maxEntryChamfer(c.cutDepth)) });
    }
    if (updates.size > 0) onUpdateBatch(updates);
  };

  const applySelectionUpdates = (updates: ReadonlyMap<string, Partial<Cutout>>) => {
    if (onUpdateBatch && updates.size > 0) onUpdateBatch(updates);
  };

  const handleAlign = (mode: AlignMode) =>
    applySelectionUpdates(alignSelection(arrangeTargets, mode));

  const handleDistribute = (axis: DistributeAxis) =>
    applySelectionUpdates(distributeSelection(arrangeTargets, axis));

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
      {binControls}
      {singleCutout && (
        <SingleCutoutInspector
          cutout={singleCutout}
          preview={preview}
          binWidth={binWidth}
          binDepth={binDepth}
          maxCutDepth={maxCutDepth}
          throughOnly={throughOnly}
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
          {/* Above the align controls: if the selection is already a pattern,
              the offer to make it parametric beats aligning it by hand. */}
          {repeatSuggestion && (
            <RepeatSuggestion suggestion={repeatSuggestion} disabled={disabled} />
          )}
          <AlignControls
            selectedCount={selectedCutouts.length}
            onAlign={handleAlign}
            onDistribute={handleDistribute}
            disabled={disabled}
          />
          {/* Clicking any member selects the whole group, so this is where a
              user who wants to array a boolean result actually lands. The
              layout is measured against the group's own box, not one member's,
              or Fill bin would run the assembly off the board. */}
          {wholeGroup && (
            <Collapsible
              title={t('binDesigner.cutouts.section.repeat')}
              size="sm"
              summary={
                groupArray
                  ? t('binDesigner.cutouts.repeat.instances', {
                      count: arrayInstanceCount(groupArray),
                    })
                  : t('binDesigner.cutouts.repeat.empty')
              }
            >
              <CutoutArrayControls
                box={groupRepeatBox(wholeGroup)}
                array={groupArray}
                binWidth={binWidth}
                binDepth={binDepth}
                onChange={(config) => setCutoutArray(wholeGroup[0].id, config)}
                onFlatten={() => onFlattenGroupArray?.(wholeGroup[0].id)}
                disabled={disabled}
                blockedReason={canGroupArray(wholeGroup) ? null : 'path'}
                canRotateToCenter={false}
              />
            </Collapsible>
          )}
          <div className="grid grid-cols-2 gap-1">
            <CompactNumberInput
              label="X"
              value={sharedX ?? 0}
              indeterminate={sharedX === null}
              onChange={(x) => handleGeometryBatch('x', x)}
              min={0}
              max={binWidth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="Y"
              value={sharedY ?? 0}
              indeterminate={sharedY === null}
              onChange={(y) => handleGeometryBatch('y', y)}
              min={0}
              max={binDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="W"
              value={sharedWidth ?? 0}
              indeterminate={sharedWidth === null}
              onChange={(width) => handleGeometryBatch('width', width)}
              min={MIN_CUTOUT_SIZE_MM}
              max={binWidth}
              softMax
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="H"
              value={sharedDepth ?? 0}
              indeterminate={sharedDepth === null}
              onChange={(depth) => handleGeometryBatch('depth', depth)}
              min={MIN_CUTOUT_SIZE_MM}
              max={binDepth}
              softMax
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label={t('binDesigner.cutouts.rotation')}
              value={sharedRotation ?? 0}
              indeterminate={sharedRotation === null}
              onChange={(rotation) => handleBatchUpdate('rotation', rotation, true)}
              min={0}
              max={359}
              step={1}
              unit="°"
              disabled={disabled}
            />
            {!throughOnly && (
              <>
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
              </>
            )}
            {chamferCutouts.length > 0 && (
              <CompactNumberInput
                label={t('binDesigner.cutouts.chamfer')}
                value={sharedChamfer ?? 0}
                indeterminate={sharedChamfer === null}
                onChange={handleChamferBatch}
                min={0}
                max={MAX_CUTOUT_CHAMFER}
                step={0.2}
                unit="mm"
                disabled={disabled}
              />
            )}
          </div>
          {/* Gated exactly as the single-select inspector gates it: a lid hole
              is tagged with the flat CUTOUT tag and takes no colour, so the
              swatch would only flip the whole design into multi-colour mode
              for a zone nothing paints. */}
          {!throughOnly && (
            <div className="pt-1">
              <CutoutColorControls
                ids={selectedCutouts.map((c) => c.id)}
                color={getSharedField(selectedCutouts, preview, 'color')}
                colorScope={getSharedField(selectedCutouts, preview, 'colorScope')}
                disabled={disabled}
              />
            </div>
          )}
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
