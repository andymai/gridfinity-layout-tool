/**
 * Section 1 of the baseplate panel: sync toggle, grid steppers, fractional
 * edges, editable mm summary, and the padding schematic with its margin
 * fill / detach controls.
 */

import { useCallback } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { useToastStore } from '@/core/store/toast';
import { isOk } from '@/core/result';
import { FractionalEdgeToggle } from '@/shared/components/FractionalEdgeToggle';
import { CONSTRAINTS } from '@/core/constants';
import { DEFAULT_BASEPLATE_PARAMS, MARGIN_MIN_DETACH_MM } from '@/core/baseplateDefaults';
import { Checkbox } from '@/design-system/Checkbox/Checkbox';
import { RulerIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { CheckboxRow, SegmentedControl } from '@/design-system';
import { EditableDimensions } from '@/shared/components/EditableDimensions';
import { GridAlignmentControls } from '@/shared/components/GridAlignmentControls';
import { PaddingSchematic } from './PaddingSchematic';
import { GridDimensionStepper } from './GridDimensionStepper';
import { resolveOverTileStatus } from '../../utils/overTileStatus';
import { PADDING_MAX, roundMm } from '../PaddingStepper';
import { gridUnits, mm, effectiveGridUnitMmY } from '@/core/types';
import { isMarginSeamStyle } from '@/shared/types/bin';
import { cornerCutsMatchVertices } from '@/shared/utils/cornerCutOutline';
import { fitAxisUnits, halfUnitUpgrade } from '@/shared/utils/drawerFit';
import { padOutline } from '@/shared/utils/padOutline';
import {
  updateBaseplateParam as updateParam,
  updateBaseplateParams as updateParams,
  useBaseplatePanelDerived,
} from './panelState';

/** How the drawer-fit padding margin is filled. */
type MarginFillMode = 'solid' | 'tile' | 'halfGrid';

/** How the sub-21mm leftover after half-grid packing is rendered. */
type LeftoverMode = 'grid' | 'solid';

export function DimensionsSection() {
  const t = useTranslation();
  const {
    baseplateParams,
    drawerOutline,
    drawerFractionalEdgeX,
    drawerFractionalEdgeY,
    gridUnitMm,
    gridUnitMmY,
    synced,
    effectiveWidth,
    effectiveDepth,
    outerWidthMm,
    outerDepthMm,
    hasPadding,
    shapeSetsExtent,
    outlineActive,
    perimeterShaped,
    cornerShaped,
    freeformShaped,
  } = useBaseplatePanelDerived();
  const halfGridMode = useHalfGridModeStore((s) => s.halfGridMode);
  const setHalfGridMode = useHalfGridModeStore((s) => s.setHalfGridMode);
  const toggleHalfGridMode = useHalfGridModeStore((s) => s.toggleHalfGridMode);
  const addToast = useToastStore((s) => s.addToast);

  const handleSyncToggle = useCallback((checked: boolean) => {
    const layoutState = useLayoutStore.getState().layout;
    const current = layoutState.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
    if (checked) {
      useLayoutStore.getState().setBaseplateParams({ ...current, syncWithLayout: true });
    } else {
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        syncWithLayout: false,
        baseplateWidth: layoutState.drawer.width,
        baseplateDepth: layoutState.drawer.depth,
        fractionalEdgeX: layoutState.drawer.fractionalEdgeX ?? 'end',
        fractionalEdgeY: layoutState.drawer.fractionalEdgeY ?? 'end',
      });
    }
  }, []);

  const handleFractionalEdgeChange = useCallback(
    (axis: 'x' | 'y', edge: 'start' | 'end') => {
      if (baseplateParams.syncWithLayout !== false) {
        useLayoutStore
          .getState()
          .updateDrawer(axis === 'x' ? { fractionalEdgeX: edge } : { fractionalEdgeY: edge });
      } else {
        updateParam(axis === 'x' ? 'fractionalEdgeX' : 'fractionalEdgeY', edge);
      }
    },
    [baseplateParams.syncWithLayout]
  );

  const overTileStatus = resolveOverTileStatus(baseplateParams);
  // Derive the toggle from the STORED flags, not a canOverTile-clamped mode, so
  // the user can still turn fill OFF when padding temporarily shrinks below the
  // tile threshold — disabling the whole switch there would strand an enabled
  // flag that silently re-applies once padding grows again.
  const fillOn = baseplateParams.overTile === true;
  const halfGridOn = fillOn && baseplateParams.overTileHalfGrid === true;
  const setMarginFillMode = useCallback((mode: MarginFillMode) => {
    updateParams({
      overTile: mode !== 'solid',
      overTileHalfGrid: mode === 'halfGrid' ? true : undefined,
    });
  }, []);
  const leftoverMode: LeftoverMode =
    halfGridOn && baseplateParams.overTileHalfGridSolidLeftover === true ? 'solid' : 'grid';
  // Whole-cell fitting. Stored undefined (not false) for the default so
  // identical geometry keeps one serialized/cache identity, matching the flags
  // above. Gated on an outline: a rectangle has no crossed cell to drop.
  const wholeCellsOn = baseplateParams.wholeCellsOnly === true;
  const setWholeCells = useCallback((checked: boolean) => {
    updateParam('wholeCellsOnly', checked ? true : undefined);
  }, []);
  const setLeftoverMode = useCallback((mode: LeftoverMode) => {
    // Store undefined (not false) for the default Grid so identical geometry
    // keeps one serialized/cache identity — matches overTileHalfGrid above.
    updateParam('overTileHalfGridSolidLeftover', mode === 'solid' ? true : undefined);
  }, []);

  // Mirror buildFullParams: the shape composes only while the padding stays
  // valid. Padding large enough to fold the loop (a collapsed notch/slot) makes
  // the resolver drop it, so the panel must say the padding is ignored rather
  // than present it as applied.
  const shapedPaddingComposes =
    !freeformShaped ||
    // freeformShaped implies an active outline; the explicit check re-narrows
    // what the extracted hook boundary hides from the compiler.
    drawerOutline === undefined ||
    padOutline(drawerOutline, {
      left: baseplateParams.paddingLeft,
      right: baseplateParams.paddingRight,
      front: baseplateParams.paddingFront,
      back: baseplateParams.paddingBack,
    }) !== null;
  const canDetach =
    baseplateParams.paddingLeft >= MARGIN_MIN_DETACH_MM ||
    baseplateParams.paddingRight >= MARGIN_MIN_DETACH_MM ||
    baseplateParams.paddingFront >= MARGIN_MIN_DETACH_MM ||
    baseplateParams.paddingBack >= MARGIN_MIN_DETACH_MM;
  const detachStored = baseplateParams.detachMargins === true;
  const marginConnectorStored = baseplateParams.detachMarginConnector === true;
  // The seam connector reuses the body's tongue/groove, or — under the puzzle key
  // — a groove on both sides that the same seated key spans. Snap clip
  // stays friction-fit: its top-insert clip has no seated form at a body↔rail
  // seam. `undefined` is the stored default for dovetail, so it counts.
  const marginConnectorStyleOk = isMarginSeamStyle(baseplateParams.connectorStyle);

  const hasFractionalWidth = effectiveWidth % 1 !== 0;
  const hasFractionalDepth = effectiveDepth % 1 !== 0;
  const fractionalEdgeX = synced
    ? drawerFractionalEdgeX
    : (baseplateParams.fractionalEdgeX ?? 'end');
  const fractionalEdgeY = synced
    ? drawerFractionalEdgeY
    : (baseplateParams.fractionalEdgeY ?? 'end');

  const minMm = CONSTRAINTS.GRID_MIN * gridUnitMm;
  const maxMm = CONSTRAINTS.GRID_MAX * gridUnitMm + PADDING_MAX * 2;

  // Names what the figure above the bare cells accounts for. The shape note
  // matters most when padding is zero: a drawer wider than the cells it was
  // given still prints a plate that spans it, and with nothing else to point at
  // the extra millimetres read as a mistake.
  const extentNoteKey = shapeSetsExtent
    ? hasPadding
      ? 'baseplate.inclPaddingShape'
      : 'baseplate.inclShape'
    : hasPadding
      ? 'baseplate.inclPadding'
      : undefined;

  /**
   * When the user enters target mm dimensions:
   * 1. Snap down to the largest valid grid size that fits (half-unit or whole-unit)
   * 2. Distribute remaining mm evenly as padding (left=right, front=back)
   * 3. Auto-uncheck "Sync with layout"
   *
   * Step 1 goes through the same `fitAxisUnits`/`halfUnitUpgrade` pair the
   * layout's measured-drawer card uses, so both entry points agree on what the
   * tightest fit is. Stepping by whole units whenever half-grid mode happened to
   * be off silently discarded a half unit that fits — a 502mm drawer became 11
   * units and 40mm of dead padding instead of 11.5 and 19mm — and
   * pushed users into over-tile to recover a row the grid should have had.
   * Taking a half fit turns half-grid mode on, matching the card's Use button:
   * a fractional dimension with the mode off is a state the steppers and the
   * half-unit edge toggle can't express.
   *
   * Exception: a synced corner-cut shaped plate keeps sync AND its shape —
   * the grid is fixed by the layout, so the whole remainder becomes padding
   * (the basket workflow: measure, type dims, rounded shape persists).
   */
  const handleDimensionCommit = useCallback(
    (targetWidthMm: number, targetDepthMm: number) => {
      const cornerShapeState = useLayoutStore.getState().layout;
      const cornerShapeParams = cornerShapeState.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      const outline = cornerShapeState.drawer.outline;
      const cuts = outline?.authoring?.kind === 'corners' ? outline.authoring.corners : undefined;
      // Derive entirely from the fresh store read — mixing in the captured
      // gridUnitMm could compute padding against a stale drawer size.
      const drawerWidthMm = cornerShapeState.drawer.width * cornerShapeState.gridUnitMm;
      const drawerDepthMm = cornerShapeState.drawer.depth * effectiveGridUnitMmY(cornerShapeState);
      if (
        cornerShapeParams.syncWithLayout !== false &&
        outline !== undefined &&
        cuts !== undefined &&
        cornerCutsMatchVertices(outline.vertices, drawerWidthMm, drawerDepthMm, cuts)
      ) {
        const halfPad = (targetMm: number, gridMm: number): number =>
          Math.min(PADDING_MAX, Math.max(0, Math.floor(((targetMm - gridMm) / 2) * 100) / 100));
        const padW = halfPad(targetWidthMm, drawerWidthMm);
        const padD = halfPad(targetDepthMm, drawerDepthMm);
        useLayoutStore.getState().setBaseplateParams({
          ...cornerShapeParams,
          paddingLeft: mm(padW),
          paddingRight: mm(padW),
          paddingFront: mm(padD),
          paddingBack: mm(padD),
        });
        return;
      }

      const widthFit = fitAxisUnits(targetWidthMm, gridUnitMm, halfGridMode);
      const depthFit = fitAxisUnits(targetDepthMm, gridUnitMmY, halfGridMode);
      const widthUpgrade = halfGridMode
        ? null
        : halfUnitUpgrade(targetWidthMm, gridUnitMm, widthFit.units);
      const depthUpgrade = halfGridMode
        ? null
        : halfUnitUpgrade(targetDepthMm, gridUnitMmY, depthFit.units);
      const snappedWidth = (widthUpgrade ?? widthFit).units;
      const snappedDepth = (depthUpgrade ?? depthFit).units;
      if (widthUpgrade !== null || depthUpgrade !== null) {
        setHalfGridMode(true);
        addToast(t('toast.halfBinModeAutoEnabled'), 'info');
      }

      // Clamp at 0: `slackMm` goes negative when the fit's minimum (1 unit in
      // whole-unit mode, GRID_MIN in half) forced a grid larger than the
      // target, and padding can't absorb a deficit.
      const remainderWidth = Math.max(0, (widthUpgrade ?? widthFit).slackMm);
      const remainderDepth = Math.max(0, (depthUpgrade ?? depthFit).slackMm);

      const halfPadWidth = Math.floor((remainderWidth / 2) * 100) / 100;
      const halfPadDepth = Math.floor((remainderDepth / 2) * 100) / 100;

      const layoutState = useLayoutStore.getState().layout;
      const current = layoutState.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        syncWithLayout: false,
        baseplateWidth: gridUnits(snappedWidth),
        baseplateDepth: gridUnits(snappedDepth),
        fractionalEdgeX: layoutState.drawer.fractionalEdgeX ?? 'end',
        fractionalEdgeY: layoutState.drawer.fractionalEdgeY ?? 'end',
        paddingLeft: mm(halfPadWidth),
        paddingRight: mm(halfPadWidth),
        paddingFront: mm(halfPadDepth),
        paddingBack: mm(halfPadDepth),
      });
    },
    [addToast, gridUnitMm, gridUnitMmY, halfGridMode, setHalfGridMode, t]
  );

  /**
   * The plate page is the only surface that can turn half-grid mode on without
   * offering a way back: the sidebar toggle and the H shortcut both live on the
   * layout route, so mm entry would otherwise strand the mode here.
   *
   * Turning it off reverses that entry's trade. Each fractional axis floors to a
   * whole unit and the millimetres it gives up return to the matching padding
   * pair, so the footprint the user typed survives and the grid re-centers
   * inside it. A synced plate keeps its dimensions — the layout owns those.
   */
  const handleHalfGridToggle = useCallback(
    (checked: boolean) => {
      // Both directions route through the toggle rather than a bare setter, so
      // this checkbox earns the feature-usage mark and the persistence-failure
      // toast the store attaches to a user-driven flip.
      if (checked === useHalfGridModeStore.getState().halfGridMode) return;
      if (!isOk(toggleHalfGridMode())) {
        addToast(t('halfBinBlocked.message'), 'error');
        return;
      }
      if (checked) return;
      const layoutState = useLayoutStore.getState().layout;
      const current = layoutState.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      if (current.syncWithLayout !== false) return;
      const width = current.baseplateWidth ?? layoutState.drawer.width;
      const depth = current.baseplateDepth ?? layoutState.drawer.depth;
      const wholeWidth = Math.max(1, Math.floor(width));
      const wholeDepth = Math.max(1, Math.floor(depth));
      if (wholeWidth === width && wholeDepth === depth) return;
      // Clamp at 0: flooring a sub-unit axis raises it to 1 instead, and a grid
      // that grew has no freed material to hand back.
      const freedWidth = Math.max(0, (width - wholeWidth) * gridUnitMm) / 2;
      const freedDepth = Math.max(0, (depth - wholeDepth) * gridUnitMmY) / 2;
      const grow = (pad: number, by: number): number => Math.min(PADDING_MAX, roundMm(pad + by));
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        baseplateWidth: gridUnits(wholeWidth),
        baseplateDepth: gridUnits(wholeDepth),
        paddingLeft: mm(grow(current.paddingLeft, freedWidth)),
        paddingRight: mm(grow(current.paddingRight, freedWidth)),
        paddingFront: mm(grow(current.paddingFront, freedDepth)),
        paddingBack: mm(grow(current.paddingBack, freedDepth)),
      });
    },
    [addToast, gridUnitMm, gridUnitMmY, t, toggleHalfGridMode]
  );

  return (
    <StickyGroupHeader title={t('baseplate.sectionDimensions')}>
      <div className="space-y-3 px-4 py-3">
        <Checkbox
          checked={synced}
          onChange={handleSyncToggle}
          label={t('baseplate.syncWithLayout')}
        />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <GridDimensionStepper
            label={t('baseplate.gridWidth')}
            value={effectiveWidth}
            onChange={(v) => updateParam('baseplateWidth', gridUnits(v))}
            halfGridMode={halfGridMode}
            disabled={synced}
          />
          <GridDimensionStepper
            label={t('baseplate.gridDepth')}
            value={effectiveDepth}
            onChange={(v) => updateParam('baseplateDepth', gridUnits(v))}
            halfGridMode={halfGridMode}
            disabled={synced}
          />
        </div>
        <Checkbox
          checked={halfGridMode}
          onChange={handleHalfGridToggle}
          label={t('sidebar.halfBinMode')}
        />
        {/* Fractional edge position — shown when the effective dimensions are half-unit */}
        {(hasFractionalWidth || hasFractionalDepth) && (
          <div className="space-y-1.5">
            <div className="text-content-tertiary text-micro mb-1">
              {t('sidebar.halfUnitEdgePosition')}
            </div>
            {hasFractionalWidth && (
              <FractionalEdgeToggle
                axis="x"
                label={t('common.width')}
                value={fractionalEdgeX}
                onChange={handleFractionalEdgeChange}
                startTitle={t('sidebar.halfBinLeft')}
                startLabel={t('sidebar.left')}
                endTitle={t('sidebar.halfBinRight')}
                endLabel={t('sidebar.right')}
              />
            )}
            {hasFractionalDepth && (
              <FractionalEdgeToggle
                axis="y"
                label={t('common.depth')}
                value={fractionalEdgeY}
                onChange={handleFractionalEdgeChange}
                startTitle={t('sidebar.halfBinBottom')}
                startLabel={t('sidebar.bottom')}
                endTitle={t('sidebar.halfBinTop')}
                endLabel={t('sidebar.top')}
              />
            )}
          </div>
        )}

        {/* mm summary under steppers — matches the layout-mode drawer dimensions pattern.
            The figure is the plate's real footprint, so a trailing note names whatever
            put it past the bare cells: padding, the drawer shape, or both. */}
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 pt-1 text-content-tertiary">
          <div className="flex items-center gap-1">
            <RulerIcon size="xs" className="flex-shrink-0" />
            <EditableDimensions
              widthMm={outerWidthMm}
              depthMm={outerDepthMm}
              minMm={minMm}
              maxMm={maxMm}
              onCommit={handleDimensionCommit}
              aria-label={t('baseplate.editDimensions')}
              widthLabel={t('baseplate.editDimensionsWidth')}
              depthLabel={t('baseplate.editDimensionsDepth')}
              variant="secondary"
            />
          </div>
          {extentNoteKey !== undefined && (
            <span className="text-label italic text-content-tertiary">{t(extentNoteKey)}</span>
          )}
        </div>

        {/* Where the lattice sits inside the shape. Padding cannot express this:
            on a synced shaped plate the outer size comes from the drawer, so the
            slack between shape and cells is the only thing left to distribute,
            and moving the grid is what distributes it. Gated on the outline
            rather than on slack existing — a shape that exactly fills its extent
            has none yet, and gating it away there would make the first nudge
            unreachable. */}
        {outlineActive && (
          <div className="space-y-2 border-t border-stroke-subtle pt-3">
            <div className="text-label font-medium uppercase tracking-wide text-content-tertiary">
              {t('baseplate.gridPosition')}
            </div>
            <p className="text-label leading-relaxed text-content-tertiary">
              {t('baseplate.gridPositionHint')}
            </p>
            <GridAlignmentControls />
          </div>
        )}

        {/* Padding — spatial schematic. Padding composes with every shape,
            so the controls stay live; a notice explains the shaped case. */}
        <div className="space-y-2 border-t border-stroke-subtle pt-3">
          <div className="text-label font-medium uppercase tracking-wide text-content-tertiary">
            {t('baseplate.padding')}
          </div>
          {cornerShaped && (
            <p className="text-label leading-relaxed text-content-tertiary">
              {t('baseplate.cornerShapedPaddingNotice')}
            </p>
          )}
          {freeformShaped && (
            <p
              className={
                shapedPaddingComposes
                  ? 'text-label leading-relaxed text-content-tertiary'
                  : 'text-label leading-relaxed text-warning'
              }
            >
              {t(
                shapedPaddingComposes
                  ? 'baseplate.shapedPaddingNotice'
                  : 'baseplate.shapedPaddingTooLarge'
              )}
            </p>
          )}
          {perimeterShaped && (
            <div className="space-y-1">
              <CheckboxRow
                label={t('baseplate.wholeCellsOnly')}
                checked={wholeCellsOn}
                onChange={setWholeCells}
              />
              <p className="text-label leading-relaxed text-content-tertiary">
                {t('baseplate.wholeCellsOnlyHint')}
              </p>
            </div>
          )}
          <PaddingSchematic
            baseplateParams={baseplateParams}
            updateParam={updateParam}
            updateParams={updateParams}
          />
          {hasPadding && (
            <div className="border-t border-stroke-subtle pt-3">
              <FeatureToggle
                label={t('baseplate.overTile')}
                checked={fillOn}
                onChange={() => setMarginFillMode(fillOn ? 'solid' : 'tile')}
                disabledReason={
                  !fillOn && !overTileStatus.canOverTile
                    ? t('baseplate.overTileTooSmall')
                    : undefined
                }
                primaryControls={
                  <div className="space-y-1.5">
                    {overTileStatus.canOverTile ? (
                      <>
                        <CheckboxRow
                          label={t('baseplate.preferHalfGrid')}
                          checked={halfGridOn}
                          onChange={(checked) => setMarginFillMode(checked ? 'halfGrid' : 'tile')}
                          indent
                        />
                        {halfGridOn && (
                          <div className="ml-4 flex items-center justify-between gap-2 border-l border-stroke-subtle pl-3">
                            <span className="text-xs text-content-secondary">
                              {t('baseplate.leftoverLabel')}
                            </span>
                            <SegmentedControl
                              aria-label={t('baseplate.leftoverLabel')}
                              size="sm"
                              options={[
                                { value: 'grid', label: t('baseplate.leftoverGrid') },
                                { value: 'solid', label: t('baseplate.leftoverSolid') },
                              ]}
                              value={leftoverMode}
                              onChange={setLeftoverMode}
                            />
                          </div>
                        )}
                        <div className="space-y-1 text-label leading-relaxed">
                          <p className="text-content-tertiary">
                            {t(
                              halfGridOn
                                ? leftoverMode === 'solid'
                                  ? 'baseplate.halfGridHintSolid'
                                  : 'baseplate.halfGridHint'
                                : 'baseplate.overTileHint'
                            )}
                          </p>
                          {overTileStatus.tiled.length > 0 && (
                            <p className="text-content-secondary">
                              {t('baseplate.overTileFills', {
                                sides: overTileStatus.tiled.map((e) => t(e.labelKey)).join(', '),
                              })}
                            </p>
                          )}
                          {overTileStatus.tooSmall.length > 0 && (
                            <p className="text-content-tertiary">
                              {t('baseplate.overTileKeptSolid', {
                                sides: overTileStatus.tooSmall.map((e) => t(e.labelKey)).join(', '),
                              })}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      // Fill is on but no edge can fit a tile right now — keep the
                      // toggle enabled (so it can be turned off) and explain why.
                      <p className="text-label leading-relaxed text-content-tertiary">
                        {t('baseplate.overTileTooSmall')}
                      </p>
                    )}
                  </div>
                }
              />
            </div>
          )}
          {/* Detached rails have no outline awareness (buildFullParams
                forces detachMargins off whenever an outline is active), so
                hide the control for every shaped plate, not just corner
                cuts. */}
          {hasPadding && !outlineActive && (
            <div className="border-t border-stroke-subtle pt-3">
              <FeatureToggle
                label={t('baseplate.detachMargins')}
                checked={detachStored}
                onChange={() => updateParam('detachMargins', !detachStored)}
                disabledReason={
                  !detachStored && !canDetach ? t('baseplate.detachMarginsTooSmall') : undefined
                }
                primaryControls={
                  // On but nothing meets the threshold → no rails are emitted,
                  // so say so rather than imply they will.
                  !canDetach ? (
                    <p className="text-label leading-relaxed text-content-tertiary">
                      {t('baseplate.detachMarginsTooSmall')}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <CheckboxRow
                        label={t('baseplate.detachMarginConnector')}
                        checked={marginConnectorStored && marginConnectorStyleOk}
                        onChange={(checked) => updateParam('detachMarginConnector', checked)}
                        disabled={!marginConnectorStyleOk}
                        indent
                      />
                      <p className="text-label leading-relaxed text-content-tertiary pl-6">
                        {marginConnectorStyleOk
                          ? t('baseplate.detachMarginConnectorHint')
                          : t('baseplate.detachMarginConnectorStyle')}
                      </p>
                    </div>
                  )
                }
              />
            </div>
          )}
        </div>
      </div>
    </StickyGroupHeader>
  );
}
