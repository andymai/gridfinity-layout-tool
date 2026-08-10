import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { useTranslation } from '@/i18n';
import { rowHasFullWidthWall } from '@/shared/types/bin';
import { getFeatureStatus } from '@/shared/constraints';
import {
  LABEL_TAB_LIP_HEIGHT_DEFAULT_MM,
  MIN_LABEL_SOCKET_TAB_DEPTH_MM,
  defaultLabelShelfTopMm,
  effectiveLabelSocketClearance,
  isLabelPlateIconId,
  labelShelfCeilingMm,
  resolveLabelShelfTopMm,
} from '@/shared/constants/labelPlates';
import { planLabelSockets } from '@/shared/utils/labelSocketPlan';
import { getCompartmentBounds, getCompartmentReadingOrder } from '../../../utils/compartments';
import type { LabelSocketStyle } from '@/shared/constants/labelPlates';
import type {
  LabelTabAlignment,
  LabelTabEdges,
  LabelTabMode,
  LabelTabSupport,
  TextFontFamily,
  TextMode,
} from '../../../types';
import { withFontSizeOverride } from '../../../types';

/** Collapsible group that owns a warning's control, so the section can surface
 *  the warning at top level while that group is collapsed. */
export type LabelWarningGroup = 'placement' | 'shape';

export interface LabelWarning {
  readonly id: string;
  readonly group: LabelWarningGroup;
  readonly message: string;
  readonly fixLabel: string;
  readonly onFix: () => void;
}

export function useLabelTabsSection() {
  const {
    compartments,
    label,
    textDefaults,
    updateLabel,
    setCompartmentText,
    setLabelRowText,
    labelPlates,
    labelTextOverflow,
    clearLabelText,
    labelFocusCompartmentId,
    setLabelFocusCompartmentId,
    setCompartmentLabelMode,
    setCompartmentPlateWidth,
    setCompartmentPlateIcon,
    setTextDefaults,
    setLabelTabTextStyle,
    params,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      label: s.params.label,
      textDefaults: s.params.textDefaults,
      updateLabel: s.updateLabel,
      setCompartmentText: s.setCompartmentText,
      setLabelRowText: s.setLabelRowText,
      labelPlates: s.generation.mesh?.labelPlates ?? null,
      labelTextOverflow: s.generation.mesh?.labelTextOverflow ?? null,
      clearLabelText: s.clearLabelText,
      labelFocusCompartmentId: s.ui.labelFocusCompartmentId,
      setLabelFocusCompartmentId: s.setLabelFocusCompartmentId,
      setCompartmentLabelMode: s.setCompartmentLabelMode,
      setCompartmentPlateWidth: s.setCompartmentPlateWidth,
      setCompartmentPlateIcon: s.setCompartmentPlateIcon,
      setTextDefaults: s.setTextDefaults,
      setLabelTabTextStyle: s.setLabelTabTextStyle,
      params: s.params,
    }))
  );
  const t = useTranslation();
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  // Read, never write: the planner owns its bins. The designer pulls a name
  // rather than the planner pushing one, so a shared saved design is never
  // mutated from a single placement.
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const layoutBins = useLayoutStore((s) => s.layout.bins);

  const labelStatus = getFeatureStatus(params, 'label');

  // Interior cavity height — the raw wall top, used for the too-short gate.
  const wallHeightMm = useMemo(() => binDimensions(params).wallHeight, [params]);

  // The builder's actual shelf planes. The geometry anchors to the
  // pipeline's interiorHeight (wall top minus the lip's bottom taper) and
  // sinks click-in socket shelves by the stacking relief — every ceiling,
  // clamp, and silent-drop check below must use these, not `wallHeightMm`,
  // or the UI permits heights the builder rejects.
  const stackingLip = params.base.stackingLip;
  const shelfCeilingMm = useMemo(
    () => labelShelfCeilingMm(wallHeightMm, stackingLip),
    [wallHeightMm, stackingLip]
  );
  const defaultShelfTopMm = useMemo(
    () => defaultLabelShelfTopMm(shelfCeilingMm, stackingLip, label),
    [shelfCeilingMm, stackingLip, label]
  );

  // Dimensional constraint: cavity too shallow for a label tab. Gated on the
  // physical wall height (mm), not the height unit count, so tall bins with a
  // custom heightUnitMm (or flat bins) aren't wrongly disabled. Handled here
  // (not in the constraint engine) because ConstraintRule.source requires a
  // FeatureKey, and height is a dimension, not a toggleable feature.
  const tooShort = wallHeightMm <= DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_HEIGHT;
  const isUnavailable = !labelStatus.available || tooShort;

  const toggleLabelTabs = useCallback(() => {
    updateLabel({ enabled: !label.enabled });
  }, [label.enabled, updateLabel]);

  const setTabSupport = useCallback(
    (support: LabelTabSupport) => {
      updateLabel({ support });
    },
    [updateLabel]
  );

  const setTabDepth = useCallback(
    (depth: number) => {
      // Height (when explicitly set) must stay above `depth` so the gusset
      // has at least 1mm of clearance above the floor. If raising depth
      // would invalidate the current height, lift height in lockstep — and
      // cap at the stepper's own ceiling. Without the cap, pushing depth up on
      // a short bin would store height = depth + 1 > ceiling; subsequently
      // lowering depth wouldn't re-trigger the clamp (`currentHeight <= depth`
      // is false), and the now-out-of-range height would silently make the
      // builder drop the tab.
      const currentHeight = label.height;
      if (currentHeight !== undefined && currentHeight <= depth) {
        updateLabel({ depth, height: Math.min(depth + 1, defaultShelfTopMm) });
      } else {
        updateLabel({ depth });
      }
    },
    [label.height, updateLabel, defaultShelfTopMm]
  );

  const toggleSpan = useCallback(
    (span: boolean) => {
      updateLabel({ span });
    },
    [updateLabel]
  );

  const toggleLabelLip = useCallback(
    (lip: boolean) => {
      updateLabel({ lip });
    },
    [updateLabel]
  );

  const setLabelLipHeight = useCallback(
    (lipHeight: number) => {
      updateLabel({ lipHeight });
    },
    [updateLabel]
  );

  const setTabEdges = useCallback(
    (edges: LabelTabEdges) => {
      updateLabel({ edges });
    },
    [updateLabel]
  );

  const setTabMode = useCallback(
    (mode: LabelTabMode) => {
      // Socket-mode tabs need extra depth for the pocket. Lift depth (and an
      // explicit height, mirroring `setTabDepth`'s lockstep rule) in the same
      // update so a single undo restores the prior state.
      if (mode === 'socket' && label.depth < MIN_LABEL_SOCKET_TAB_DEPTH_MM) {
        const depth = MIN_LABEL_SOCKET_TAB_DEPTH_MM;
        const liftHeight = label.height !== undefined && label.height <= depth;
        updateLabel({
          mode,
          depth,
          ...(liftHeight ? { height: Math.min(depth + 1, defaultShelfTopMm) } : {}),
        });
      } else {
        updateLabel({ mode });
      }
    },
    [label.depth, label.height, updateLabel, defaultShelfTopMm]
  );

  const setPlateFitOffset = useCallback(
    (plateFitOffset: number) => {
      updateLabel({ plateFitOffset });
    },
    [updateLabel]
  );

  const setSocketStyle = useCallback(
    (socketStyle: LabelSocketStyle) => {
      // Store undefined for the default so legacy payloads stay byte-identical.
      updateLabel({ socketStyle: socketStyle === 'clickIn' ? undefined : socketStyle });
    },
    [updateLabel]
  );

  const setTabInset = useCallback(
    (inset: number) => {
      updateLabel({ inset });
    },
    [updateLabel]
  );

  const setTabHeight = useCallback(
    (h: number) => {
      updateLabel({ height: h });
    },
    [updateLabel]
  );

  const setTabWidth = useCallback(
    (w: number) => {
      updateLabel({ width: w });
    },
    [updateLabel]
  );

  const setTabAlignment = useCallback(
    (alignment: LabelTabAlignment) => {
      updateLabel({ alignment });
    },
    [updateLabel]
  );

  const setTextFont = useCallback(
    (font: TextFontFamily) => {
      setTextDefaults({ font });
    },
    [setTextDefaults]
  );

  const setTextMode = useCallback(
    (mode: TextMode) => {
      setTextDefaults({ mode });
    },
    [setTextDefaults]
  );

  const setTextDepth = useCallback(
    (depth: number) => {
      setTextDefaults({ depth });
    },
    [setTextDefaults]
  );

  const setTextSize = useCallback(
    (size: number | null) => {
      setLabelTabTextStyle(withFontSizeOverride(label.textStyle, size) ?? null);
    },
    [setLabelTabTextStyle, label.textStyle]
  );

  const tabWidthMm = useMemo(() => {
    const { innerW } = binDimensions(params);
    const cellW = innerW / compartments.cols;
    let availableWidth = cellW;
    if (compartments.cols === 2) {
      availableWidth -= compartments.thickness / 2;
    } else if (compartments.cols >= 3) {
      availableWidth -= compartments.thickness;
    }
    return Math.round(((availableWidth * label.width) / 100) * 10) / 10;
  }, [params, compartments.cols, compartments.thickness, label.width]);

  // The plane the builder actually anchors to, cap included.
  const tabHeightMm = useMemo(
    () => resolveLabelShelfTopMm(shelfCeilingMm, stackingLip, label),
    [shelfCeilingMm, stackingLip, label]
  );
  // Did the user explicitly set height? Controls whether the W×D×H summary
  // shows the third dimension. Keeps unaltered designs visually unchanged.
  const heightIsExplicit = label.height !== undefined;

  // Dynamic min/max for the tab-height stepper. The geometry layer
  // requires `height > depth` for a non-degenerate gusset (floor = depth + 1)
  // and `height <= shelfCeilingMm` (the builder's interiorHeight guard) —
  // relieved to `defaultShelfTopMm` in click-in socket mode, where the
  // builder caps anyway and a higher offer would just read back lower.
  // When the depth-derived floor exceeds that ceiling (a deep tab in a short
  // bin), collapse min onto max so the stepper can't request a rejected Z.
  const tabHeightMax = defaultShelfTopMm;
  const tabHeightMin = Math.min(label.depth + 1, tabHeightMax);

  // --- Label lip (#2971) ---
  // Only offered on text-mode tabs (socket tabs retain their plates; the
  // slide-channel mouth is on the free edge the lip would wall off).
  const lipAvailable = (label.mode ?? 'text') === 'text';
  const lipEnabled = !!label.lip;
  const lipHeightMm = label.lipHeight ?? LABEL_TAB_LIP_HEIGHT_DEFAULT_MM;
  // The shelf top the tab would use with the lip OFF — the lip lowers the shelf
  // by its height, so comparing against this tells us whether the lip is the
  // reason a tab is about to silently drop (and sizes the auto-fix).
  const shelfTopNoLip = useMemo(
    () =>
      resolveLabelShelfTopMm(shelfCeilingMm, stackingLip, {
        ...label,
        lip: false,
        lipHeight: undefined,
      }),
    [shelfCeilingMm, stackingLip, label]
  );
  // Lip is enabled and its shelf drop is what pushes the tab past the height
  // guard (`depth >= tabHeightMm`), even though it fit without the lip.
  const lipWontFit =
    lipEnabled && lipAvailable && label.depth < shelfTopNoLip && label.depth >= tabHeightMm;

  const autoFixLip = useCallback(() => {
    // The lip must stay below `shelfTopNoLip - depth` to keep the shelf above
    // the gusset floor. Shrink it to the largest step-aligned value that fits;
    // if even the minimum lip can't fit, turn the lip off.
    const step = DESIGNER_CONSTRAINTS.LABEL_TAB_LIP_HEIGHT_STEP;
    const room = shelfTopNoLip - label.depth;
    const fitLip = Math.floor((room - 1e-6) / step) * step;
    if (fitLip >= DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_LIP_HEIGHT) {
      updateLabel({
        lipHeight:
          Math.round(Math.min(fitLip, DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_LIP_HEIGHT) * 10) / 10,
      });
    } else {
      updateLabel({ lip: false });
    }
  }, [shelfTopNoLip, label.depth, updateLabel]);

  // Dynamic max for the tab-depth stepper. Geometry's bridge guard rejects
  // `tabDepth >= innerD`, so the UI clamps at innerD-1 and never wider than
  // the static MAX. This prevents the user from configuring a depth that
  // silently produces no tabs on a small bin.
  const { innerD } = useMemo(() => binDimensions(params), [params]);
  const tabDepthMax = Math.min(DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH, Math.floor(innerD - 1));

  // Dynamic max for the inset stepper. Constrained by:
  //   - the static hard ceiling MAX_LABEL_TAB_INSET (100mm)
  //   - cellD − depth (per-compartment, so the tab body can't pass the
  //     opposite wall of its OWN compartment — innerD would be too
  //     permissive on multi-row bins)
  //   - in 'both' mode: (cellD − 2·depth) / 2 (so the two tabs can't collide
  //     in the smallest compartment)
  // Using cellD (= innerD / rows) is conservative for merged compartments
  // (which could accept larger insets) but matches what the per-compartment
  // collision guard actually enforces — stops the stepper from offering
  // values it would instantly warn about. (Greptile review on #1904.)
  const cellDForUI = innerD / compartments.rows;
  const edgesValue = label.edges ?? 'back';
  const insetRoom =
    edgesValue === 'both' ? (cellDForUI - 2 * label.depth) / 2 : cellDForUI - label.depth;
  const tabInsetMax = Math.max(
    0,
    Math.min(DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_INSET, Math.floor(insetRoom))
  );

  // Detect ALL conditions that cause a tab to be silently dropped by the
  // geometry layer. Computes the worst-case compartment depths so the
  // Auto-fix button (below) and the inline warning fire for any of:
  //   - global bridge:    tabDepth >= innerD
  //   - per-compartment:  tabDepth + inset > compartmentDepth (single edge)
  //   - both collision:   2·tabDepth + 2·inset > compartmentDepth (both edges)
  //   - height misconfig: tabHeight > wallHeight OR tabHeight ≤ tabDepth
  // The fix algorithm in `autoFixDimensions` (below) walks these in the
  // priority order: inset → depth → height → edges.
  const compartmentDepths = useMemo(() => {
    const { rows, cols, cells } = compartments;
    const cellD = innerD / rows;
    const seen = new Set<number>();
    let minAny = Infinity;
    let minBothAnchored = Infinity;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellId = cells[row * cols + col];
        if (seen.has(cellId)) continue;
        seen.add(cellId);
        const bounds = getCompartmentBounds(compartments, cellId);
        if (!bounds) continue;
        const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
        const hasFrontAnchor =
          bounds.minRow === 0 || cells[(bounds.minRow - 1) * cols + bounds.minCol] !== cellId;
        const hasBackAnchor =
          bounds.maxRow === rows - 1 ||
          cells[(bounds.maxRow + 1) * cols + bounds.minCol] !== cellId;
        if (hasFrontAnchor || hasBackAnchor) {
          if (compartmentDepth < minAny) minAny = compartmentDepth;
        }
        if (hasFrontAnchor && hasBackAnchor) {
          if (compartmentDepth < minBothAnchored) minBothAnchored = compartmentDepth;
        }
      }
    }
    return { minAny, minBothAnchored };
  }, [compartments, innerD]);

  const tabsWillSilentlyDrop = useMemo(() => {
    const inset = label.inset ?? 0;
    const depth = label.depth;
    // Global bridge: tab body would punch the opposite outer wall.
    if (depth >= innerD) return true;
    // Per-compartment: tab body + inset exceeds compartment depth.
    if (Number.isFinite(compartmentDepths.minAny) && depth + inset > compartmentDepths.minAny) {
      return true;
    }
    // Both-mode collision in the smallest both-anchored compartment.
    if (
      edgesValue === 'both' &&
      Number.isFinite(compartmentDepths.minBothAnchored) &&
      2 * depth + 2 * inset > compartmentDepths.minBothAnchored
    ) {
      return true;
    }
    // Height guards, mirroring the builder exactly: the resolved shelf top
    // must clear the interior ceiling, and the tab envelope (height = depth)
    // must fit strictly below the shelf top.
    if (depth <= 0) return true;
    if (depth >= tabHeightMm) return true;
    if (tabHeightMm > shelfCeilingMm) return true;
    return false;
  }, [
    label.depth,
    label.inset,
    edgesValue,
    innerD,
    compartmentDepths,
    tabHeightMm,
    shelfCeilingMm,
  ]);

  // Auto-fix: walk the priority order inset → depth → height → edges → mode,
  // applying the smallest change(s) that get the geometry to generate. Goal
  // is to preserve user intent (mode over edges, both over dimensions) while
  // undoing the dimensional misconfig. Mutates via `updateLabel` so the
  // change is a single undo entry (Ctrl+Z restores the prior state).
  const autoFixDimensions = useCallback(() => {
    const minAny = Number.isFinite(compartmentDepths.minAny) ? compartmentDepths.minAny : innerD;
    const minBoth = Number.isFinite(compartmentDepths.minBothAnchored)
      ? compartmentDepths.minBothAnchored
      : innerD;

    let nextDepth = label.depth;
    const nextInset = 0;
    let nextHeight = label.height;
    let nextEnabled = label.enabled;
    const currentMode = label.mode ?? 'text';

    // Height-derived ceiling: tabHeight = tabDepth, must sit strictly below
    // the shelf top the builder will actually use — an explicit height, but
    // capped like `resolveLabelShelfTopMm` does, or the fix works from a plane
    // the geometry never reaches and repairs nothing.
    // `ceil(shelf) - 1` is the largest integer depth the builder accepts —
    // a flat `- 1` margin under a fractional shelf (14.5 → 13) wrongly
    // excludes the 14mm socket minimum and demotes valid socket configs.
    const resolvedShelfTop = Math.min(nextHeight ?? defaultShelfTopMm, defaultShelfTopMm);
    const heightCeiling = Math.ceil(resolvedShelfTop) - 1;
    const depthFloor = (mode: LabelTabMode): number =>
      mode === 'socket' ? MIN_LABEL_SOCKET_TAB_DEPTH_MM : DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH;
    const depthCeil = (edges: LabelTabEdges): number =>
      edges === 'both'
        ? Math.min(tabDepthMax, Math.floor(minBoth / 2) - 1, heightCeiling)
        : Math.min(tabDepthMax, Math.floor(minAny) - 1, heightCeiling);

    // A (mode, edges) pair is feasible when the mode's depth floor fits under
    // the edges config's ceiling. Try candidates in intent-preservation order:
    // keep both → drop 'both' → drop socket → drop both. Socket mode's raised
    // 14mm floor makes the current pair infeasible on shallow compartments,
    // so clamping depth alone can never resolve it — demotion is the fix.
    const candidates: Array<{ mode: LabelTabMode; edges: LabelTabEdges }> = [
      { mode: currentMode, edges: edgesValue },
      ...(edgesValue === 'both' ? [{ mode: currentMode, edges: 'back' as const }] : []),
      ...(currentMode === 'socket' ? [{ mode: 'text' as const, edges: edgesValue }] : []),
      ...(currentMode === 'socket' && edgesValue === 'both'
        ? [{ mode: 'text' as const, edges: 'back' as const }]
        : []),
    ];
    const fit = candidates.find((c) => depthFloor(c.mode) <= depthCeil(c.edges));

    const nextMode = fit?.mode ?? currentMode;
    const nextEdges = fit?.edges ?? edgesValue;
    if (fit) {
      nextDepth = Math.max(depthFloor(fit.mode), Math.min(nextDepth, depthCeil(fit.edges)));
    } else {
      // No configuration fits this bin's compartments → disable the feature.
      nextEnabled = false;
    }

    // Keep height valid given the (possibly new) depth, inside the band the
    // stepper offers: (depth, capped shelf top]. The 1mm gusset preference
    // collapses onto the ceiling rather than failing, mirroring `tabHeightMin`
    // — insisting on depth + 1 disables tabs the builder would have generated.
    if (nextHeight !== undefined) {
      const maxHeight = defaultShelfTopMm;
      if (maxHeight <= nextDepth) {
        // No shelf plane clears the depth → disable the feature.
        nextEnabled = false;
      } else {
        nextHeight = Math.min(maxHeight, Math.max(Math.min(nextDepth + 1, maxHeight), nextHeight));
      }
    } else if (nextDepth >= defaultShelfTopMm) {
      // No explicit height, but the implicit default shelf top won't fit
      // the chosen depth either. Disable.
      nextEnabled = false;
    }

    updateLabel({
      enabled: nextEnabled,
      depth: nextDepth,
      inset: nextInset,
      edges: nextEdges,
      ...(nextMode !== currentMode ? { mode: nextMode } : {}),
      ...(nextHeight !== undefined ? { height: nextHeight } : {}),
    });
  }, [
    label.depth,
    label.height,
    label.enabled,
    label.mode,
    edgesValue,
    compartmentDepths,
    innerD,
    tabDepthMax,
    defaultShelfTopMm,
    updateLabel,
  ]);

  // Swappable-label socket mode (#2666). The plan is the same math the
  // worker runs, so pickers/warnings can never disagree with the geometry.
  const isSocketMode = (label.mode ?? 'text') === 'socket';

  const socketPlan = useMemo(() => {
    const { innerW } = binDimensions(params);
    // Nozzle-scaled to match the worker's cut so pickers/warnings can never
    // disagree with the geometry (a wider nozzle can drop a compartment from
    // a 2U plate to 1U).
    const clearanceMm = effectiveLabelSocketClearance(nozzleSizeMm, label.plateFitOffset);
    return planLabelSockets(compartments, innerW, clearanceMm, label.width);
  }, [params, compartments, label.plateFitOffset, label.width, nozzleSizeMm]);

  // Socket segment disabled when no standard plate fits anywhere, even
  // bin-spanning \u2014 sockets are never emitted at nonstandard widths.
  const socketUnavailable = !socketPlan.anyFits;

  const plateWidthRows = useMemo(() => {
    if (!isSocketMode || socketPlan.spanningWidthU !== null) return [];
    const planById = new Map(socketPlan.compartments.map((p) => [p.compartmentId, p]));
    const overrides = compartments.labelPlateWidths ?? [];
    const icons = compartments.labelIcons ?? [];
    const ids = getCompartmentReadingOrder(compartments);
    return ids.map((id, idx) => {
      const plan = planById.get(id);
      const override = overrides[id];
      const icon = icons[id];
      return {
        id,
        displayNumber: idx + 1,
        label: t('binDesigner.compartmentNumberLabel', { n: idx + 1 }),
        fittingWidthsU: plan?.fittingWidthsU ?? [],
        autoWidthU: plan?.autoWidthU ?? null,
        overrideU: typeof override === 'number' ? override : null,
        icon: isLabelPlateIconId(icon) ? icon : null,
      };
    });
  }, [isSocketMode, socketPlan, compartments, t]);

  const tabDepthMin = isSocketMode
    ? MIN_LABEL_SOCKET_TAB_DEPTH_MM
    : DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH;

  const sectionSummary = useMemo(() => {
    if (!label.enabled) return undefined;
    const supportName = t(`binDesigner.tabSupport.${label.support}`);
    const parts = isSocketMode
      ? [t('binDesigner.tabMode.socket'), supportName, `${label.width}%`]
      : [supportName, `${label.width}%`];
    if (label.alignment !== 'left') {
      parts.push(t(`binDesigner.alignment.${label.alignment}`));
    }
    return parts.join(' \u00b7 ');
  }, [label.enabled, label.support, label.width, label.alignment, isSocketMode, t]);

  const disabledReason = tooShort
    ? t('binDesigner.labelTabsUnavailableMinHeight')
    : labelStatus.reason
      ? t(labelStatus.reason)
      : undefined;

  const meta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : sectionSummary,
      disabledReason,
    }),
    [isUnavailable, sectionSummary, disabledReason]
  );

  const compartmentTextRows = useMemo(() => {
    const ids = getCompartmentReadingOrder(compartments);
    const texts = compartments.compartmentTexts ?? [];
    // `displayNumber` is the source of truth for what the user sees AND what
    // the aria-label announces — keep them in lockstep so a future change
    // to ID ordering can't silently desync the two.
    return ids.map((id, idx) => {
      const displayNumber = idx + 1;
      return {
        id,
        displayNumber,
        label: t('binDesigner.compartmentNumberLabel', { n: displayNumber }),
        value: texts[id] ?? '',
      };
    });
  }, [compartments, t]);

  // In span mode the tabs are per row, so the text list follows: one field per
  // row that actually hosts a spanning tab. Rows whose compartments merge
  // across the boundary get no tab, so offering a caption there would be a
  // field that renders nothing.
  const rowTextRows = useMemo(() => {
    if (label.span !== true) return [];
    const edges = label.edges ?? 'back';
    const texts = label.rowTexts ?? [];
    const rows = [];
    for (let row = 0; row < compartments.rows; row++) {
      const hosts =
        ((edges === 'back' || edges === 'both') &&
          rowHasFullWidthWall(compartments, row, 'back')) ||
        ((edges === 'front' || edges === 'both') &&
          rowHasFullWidthWall(compartments, row, 'front'));
      if (!hosts) continue;
      rows.push({
        row,
        label: t('binDesigner.rowNumberLabel', { n: row + 1 }),
        value: texts[row] ?? '',
      });
    }
    return rows;
  }, [label.span, label.edges, label.rowTexts, compartments, t]);

  const spanning = label.span === true;

  // The build's own verdict on which captions overflow, reported alongside the
  // mesh because the drop leaves no trace in it. Absent while a generation is
  // in flight, so a row's warning clears optimistically and returns with the
  // next mesh rather than flickering on every keystroke.
  //
  // Matched on SCOPE as well as index: the report is compartment-indexed by
  // default, row-indexed under `span`, and indexes a synthetic 1x1 grid when the
  // socket plan degrades to one bin-spanning tab. Keying on index alone would
  // let a report from one indexing scheme light up a row in another — today the
  // `bin` scope never carries text so nothing misfires, but that is a property
  // of `planLabelPlateSeats`, not something this list should depend on.
  const overflowIndices = useMemo(() => {
    const wanted = spanning ? 'row' : 'compartment';
    const set = new Set<number>();
    for (const o of labelTextOverflow ?? []) {
      if (o.scope === wanted) set.add(o.index);
    }
    return set;
  }, [labelTextOverflow, spanning]);

  // One row per compartment carrying EVERYTHING about that compartment's label.
  // Text and plate hardware were two lists over the same compartments, in
  // different places, so row 3 meant a different thing depending on which one
  // you were looking at.
  const textRows = useMemo(() => {
    if (spanning) {
      return rowTextRows.map((r) => ({
        index: r.row,
        displayNumber: r.row + 1,
        value: r.value,
        overflows: overflowIndices.has(r.row),
      }));
    }
    const plateById = new Map(plateWidthRows.map((p) => [p.id, p]));
    return compartmentTextRows.map((r) => {
      const plate = plateById.get(r.id);
      return {
        index: r.id,
        displayNumber: r.displayNumber,
        value: r.value,
        overflows: overflowIndices.has(r.id),
        ...(plate
          ? {
              plate: {
                fittingWidthsU: plate.fittingWidthsU,
                autoWidthU: plate.autoWidthU,
                overrideU: plate.overrideU,
                icon: plate.icon,
              },
            }
          : {}),
      };
    });
  }, [spanning, rowTextRows, compartmentTextRows, overflowIndices, plateWidthRows]);

  const commitText = spanning ? setLabelRowText : setCompartmentText;

  const clearAllText = useCallback(
    () => clearLabelText(spanning ? 'row' : 'compartment'),
    [clearLabelText, spanning]
  );

  // Widening is the only fix the panel can apply for an overflow: the auto-fit
  // already failed at `minFontSize`, which is a legibility floor rather than a
  // knob, and a plate's width is a per-compartment choice with its own control.
  const canWidenTabs = label.width < DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH;
  // Offered only when the mapping is unambiguous: EXACTLY one placed bin links
  // to this design, and the design has one compartment. A design shared by five
  // bins named Screws/Bolts/Nuts has no sensible name-to-compartment mapping,
  // and guessing one would write the wrong caption onto four of them.
  const binNameSuggestion = useMemo(() => {
    if (currentDesignId === null || spanning) return null;
    if (compartmentTextRows.length !== 1) return null;
    if (compartmentTextRows[0].value.trim() !== '') return null;
    const linked = layoutBins.filter((b) => b.linkedDesignId === currentDesignId);
    if (linked.length !== 1) return null;
    const name = linked[0].label.trim();
    return name === '' ? null : { compartmentId: compartmentTextRows[0].id, name };
  }, [currentDesignId, spanning, compartmentTextRows, layoutBins]);

  const applyBinNameSuggestion = useCallback(() => {
    if (binNameSuggestion === null) return;
    setCompartmentText(binNameSuggestion.compartmentId, binNameSuggestion.name);
  }, [binNameSuggestion, setCompartmentText]);

  const pickLabelOnGrid = useCallback(
    () => setCompartmentLabelMode(true),
    [setCompartmentLabelMode]
  );

  const widenTabs = useCallback(
    () => updateLabel({ width: DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH }),
    [updateLabel]
  );

  // Warnings carry the group that owns their control so the section can render
  // them at top level while that group is collapsed. Progressive disclosure
  // hides options; it must never hide an active problem, and both of these
  // come with a fix the user would otherwise have to find for themselves.
  const warnings = useMemo<LabelWarning[]>(() => {
    const list: LabelWarning[] = [];
    if (tabsWillSilentlyDrop) {
      list.push({
        id: 'edges-collision',
        group: 'placement',
        message: t('binDesigner.tabBothCollisionWarning'),
        fixLabel: t('binDesigner.tabAutoFix'),
        onFix: autoFixDimensions,
      });
    }
    if (lipWontFit) {
      list.push({
        id: 'lip-too-tall',
        group: 'shape',
        message: t('binDesigner.tabLipTooTallWarning'),
        fixLabel: t('binDesigner.tabAutoFix'),
        onFix: autoFixLip,
      });
    }
    return list;
  }, [tabsWillSilentlyDrop, lipWontFit, autoFixDimensions, autoFixLip, t]);

  return {
    state: {
      label,
      textDefaults,
      spanning,
      textRows,
      canWidenTabs,
      warnings,
      binNameSuggestion,
      labelFocusCompartmentId,
      isUnavailable,
      tabWidthMm,
      tabHeightMm,
      heightIsExplicit,
      tabHeightMin,
      tabHeightMax,
      tabDepthMin,
      tabDepthMax,
      tabInsetMax,
      tabsWillSilentlyDrop,
      lipAvailable,
      lipEnabled,
      lipHeightMm,
      lipMin: DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_LIP_HEIGHT,
      lipMax: DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_LIP_HEIGHT,
      lipStep: DESIGNER_CONSTRAINTS.LABEL_TAB_LIP_HEIGHT_STEP,
      lipWontFit,
      compartmentTextRows,
      rowTextRows,
      isSocketMode,
      socketUnavailable,
      socketSpanningWidthU: socketPlan.spanningWidthU,
      shownPlateCount: labelPlates?.plates.length ?? 0,
      omittedPlateCount: labelPlates?.omittedCount ?? 0,
      plateWidthRows,
    },
    handlers: {
      toggleLabelTabs,
      toggleSpan,
      toggleLabelLip,
      setLabelLipHeight,
      autoFixLip,
      setLabelRowText,
      setTabSupport,
      setTabDepth,
      setTabWidth,
      setTabHeight,
      setTabAlignment,
      setTabEdges,
      setTabInset,
      setTabMode,
      setPlateFitOffset,
      setSocketStyle,
      setCompartmentPlateWidth,
      setCompartmentPlateIcon,
      autoFixDimensions,
      setCompartmentText,
      commitText,
      clearAllText,
      widenTabs,
      setLabelFocusCompartmentId,
      pickLabelOnGrid,
      applyBinNameSuggestion,
      setTextFont,
      setTextMode,
      setTextDepth,
      setTextSize,
    },
    meta,
    t,
  };
}
