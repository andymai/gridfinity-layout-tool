import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import { getCompartmentBounds, getCompartmentIds } from '../../../utils/compartments';
import type {
  LabelTabAlignment,
  LabelTabEdges,
  LabelTabSupport,
  TextFontFamily,
  TextMode,
} from '../../../types';

export function useLabelTabsSection() {
  const {
    compartments,
    label,
    textDefaults,
    height,
    updateLabel,
    setCompartmentText,
    setTextDefaults,
    params,
  } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      label: s.params.label,
      textDefaults: s.params.textDefaults,
      height: s.params.height,
      updateLabel: s.updateLabel,
      setCompartmentText: s.setCompartmentText,
      setTextDefaults: s.setTextDefaults,
      params: s.params,
    }))
  );
  const t = useTranslation();

  const labelStatus = getFeatureStatus(params, 'label');
  // Dimensional constraint: cavity too shallow for label tab support at min height.
  // Handled here (not in constraint engine) because ConstraintRule.source requires a
  // FeatureKey, and "height" is a dimension, not a toggleable feature.
  const tooShort = height <= DESIGNER_CONSTRAINTS.MIN_HEIGHT;
  const isUnavailable = !labelStatus.available || tooShort;

  // Interior cavity height — dynamic max for the tab-height stepper and
  // the cap for the `setTabDepth` height-clamp. Matches `wallHeight`
  // passed to the geometry builder.
  const wallHeightMm = useMemo(() => binDimensions(params).wallHeight, [params]);

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
      // cap at `wallHeightMm` so we never write a value above the stepper's
      // own ceiling. Without the cap, pushing depth up to wallHeight on a
      // short bin would store height = depth + 1 > wallHeight; subsequently
      // lowering depth wouldn't re-trigger the clamp (`currentHeight <= depth`
      // is false), and the now-out-of-range height would silently make the
      // builder drop the tab.
      const currentHeight = label.height;
      if (currentHeight !== undefined && currentHeight <= depth) {
        updateLabel({ depth, height: Math.min(depth + 1, wallHeightMm) });
      } else {
        updateLabel({ depth });
      }
    },
    [label.height, updateLabel, wallHeightMm]
  );

  const setTabEdges = useCallback(
    (edges: LabelTabEdges) => {
      updateLabel({ edges });
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

  // Resolved tab height for display: explicit value when set, otherwise
  // wall top (the default-when-absent contract from `LabelTabConfig`).
  const tabHeightMm = label.height ?? wallHeightMm;
  // Did the user explicitly set height? Controls whether the W×D×H summary
  // shows the third dimension. Keeps unaltered designs visually unchanged.
  const heightIsExplicit = label.height !== undefined;

  // Dynamic min/max for the tab-height stepper. The geometry layer
  // requires `height > depth` for a non-degenerate gusset (floor = depth + 1)
  // and `height <= wallHeight` (ceiling = interior wall height).
  // When the depth-derived floor exceeds the wall ceiling (a deep tab in a
  // short bin), the only valid value is the wall top; collapse min onto max
  // so the stepper can't request a Z the builder would reject — never let
  // the stepper expose a max above the actual wall height.
  const tabHeightMax = wallHeightMm;
  const tabHeightMin = Math.min(label.depth + 1, tabHeightMax);

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
    // Global height guard: tabHeight = tabDepth, must be ≤ wallHeight. This
    // also covers the implicit `height = wallHeight` default — the geometry
    // drops everything when `tabDepth > wallHeight`, no matter whether the
    // user touched the height field.
    if (depth > wallHeightMm) return true;
    if (depth <= 0) return true;
    // Explicit height constraints.
    if (label.height !== undefined) {
      if (label.height > wallHeightMm) return true;
      if (label.height <= depth) return true;
    }
    return false;
  }, [label.depth, label.inset, label.height, edgesValue, innerD, compartmentDepths, wallHeightMm]);

  // Auto-fix: walk the priority order inset → depth → height → edges,
  // applying the smallest change(s) that get the geometry to generate. Goal
  // is to preserve user intent (edges/alignment/support) while undoing the
  // dimensional misconfig. Mutates via `updateLabel` so the change is a
  // single undo entry (Ctrl+Z restores the prior state).
  const autoFixDimensions = useCallback(() => {
    const minAny = Number.isFinite(compartmentDepths.minAny) ? compartmentDepths.minAny : innerD;
    const minBoth = Number.isFinite(compartmentDepths.minBothAnchored)
      ? compartmentDepths.minBothAnchored
      : innerD;

    let nextDepth = label.depth;
    const nextInset = 0;
    let nextEdges: typeof edgesValue = edgesValue;
    let nextHeight = label.height;
    let nextEnabled = label.enabled;

    const MIN_DEPTH = DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH;
    // Height-derived ceiling: tabHeight = tabDepth, must be ≤ wallHeight
    // (and strictly < explicit height when set). Use `nextHeight - 1` when
    // explicit so we keep ≥1mm gusset clearance; else use wallHeight - 1.
    const heightCeiling = Math.floor((nextHeight ?? wallHeightMm) - 1);
    const maxDepthForSingle = Math.max(
      MIN_DEPTH,
      Math.min(tabDepthMax, Math.floor(minAny) - 1, heightCeiling)
    );
    const maxDepthForBoth = Math.max(
      MIN_DEPTH,
      Math.min(tabDepthMax, Math.floor(minBoth / 2) - 1, heightCeiling)
    );

    // Step 1 + 2: inset → 0, then clamp depth to fit the current edges mode.
    if (nextEdges === 'both' && 2 * MIN_DEPTH > minBoth) {
      // Step 4 (fallback): even minimum depth can't fit two tabs. Demote.
      nextEdges = 'back';
      nextDepth = Math.min(nextDepth, maxDepthForSingle);
    } else if (nextEdges === 'both') {
      nextDepth = Math.min(nextDepth, maxDepthForBoth);
    } else {
      nextDepth = Math.min(nextDepth, maxDepthForSingle);
    }
    nextDepth = Math.max(MIN_DEPTH, nextDepth);

    // Step 3: keep height valid given the (possibly new) depth.
    if (nextHeight !== undefined) {
      const minHeight = nextDepth + 1;
      const maxHeight = wallHeightMm;
      if (minHeight > maxHeight) {
        // Bin is too short for any valid (depth, height) pair → disable feature.
        nextEnabled = false;
      } else {
        nextHeight = Math.min(maxHeight, Math.max(minHeight, nextHeight));
      }
    } else if (nextDepth >= wallHeightMm) {
      // No explicit height, but the implicit-default (wall top) won't fit
      // the chosen depth either. Disable.
      nextEnabled = false;
    }

    updateLabel({
      enabled: nextEnabled,
      depth: nextDepth,
      inset: nextInset,
      edges: nextEdges,
      ...(nextHeight !== undefined ? { height: nextHeight } : {}),
    });
  }, [
    label.depth,
    label.height,
    label.enabled,
    edgesValue,
    compartmentDepths,
    innerD,
    tabDepthMax,
    wallHeightMm,
    updateLabel,
  ]);

  const sectionSummary = useMemo(() => {
    if (!label.enabled) return undefined;
    const supportName = t(`binDesigner.tabSupport.${label.support}`);
    const parts = [supportName, `${label.width}%`];
    if (label.alignment !== 'left') {
      parts.push(t(`binDesigner.alignment.${label.alignment}`));
    }
    return parts.join(' \u00b7 ');
  }, [label.enabled, label.support, label.width, label.alignment, t]);

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
    const ids = getCompartmentIds(compartments);
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

  return {
    state: {
      label,
      textDefaults,
      isUnavailable,
      tabWidthMm,
      tabHeightMm,
      heightIsExplicit,
      tabHeightMin,
      tabHeightMax,
      tabDepthMax,
      tabInsetMax,
      tabsWillSilentlyDrop,
      compartmentTextRows,
    },
    handlers: {
      toggleLabelTabs,
      setTabSupport,
      setTabDepth,
      setTabWidth,
      setTabHeight,
      setTabAlignment,
      setTabEdges,
      setTabInset,
      autoFixDimensions,
      setCompartmentText,
      setTextFont,
      setTextMode,
      setTextDepth,
    },
    meta,
    t,
  };
}
