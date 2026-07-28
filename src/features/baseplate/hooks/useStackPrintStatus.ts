/**
 * Classifies the current stack-print job so the panel can warn when the user's
 * dimensions/gap would produce no real stacking (a single plate, an all-unique
 * split, or a build height that fits only one plate per tower) instead of
 * silently baking single-plate "towers".
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { effectiveGridUnitMmY } from '@/core/types';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { useBaseplatePageStore } from '../store/baseplatePageStore';
import { buildFullParams } from '../utils/buildFullParams';
import {
  stackGroupsFromTiling,
  stackHeightCap,
  evaluateStackPrint,
  planPhysicalStacks,
  type StackPrintStatus,
  type PhysicalStack,
} from '../utils/stackPrint';

export interface StackPrintStatusInfo {
  readonly status: StackPrintStatus;
  readonly gapMm: number;
  readonly maxPrintHeightMm: number;
  /** Physical towers the current config produces — one entry per output file. */
  readonly plan: readonly PhysicalStack[];
  /** Detached margin rails that ship as flat files alongside the towers (#2641). */
  readonly railCount: number;
}

export function useStackPrintStatus(gapMm: number): StackPrintStatusInfo {
  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    gridUnitMmY,
    socketHeightMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
  } = useLayoutStore(
    useShallow((s) => ({
      drawerWidth: s.layout.drawer.width,
      drawerDepth: s.layout.drawer.depth,
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(s.layout),
      socketHeightMm: s.layout.socketHeightMm,
      fractionalEdgeX: s.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: s.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: s.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const maxPrintHeightMm = useSettingsStore((s) => s.settings.printSettings.maxPrintHeightMm);
  const tiling = useBaseplatePageStore((s) => s.tiling);

  const copies = baseplateParams.stackPrint?.copies ?? 1;

  const { status, plan } = useMemo(() => {
    const fullParams = buildFullParams(
      baseplateParams,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY,
      nozzleSizeMm,
      undefined,
      undefined,
      gridUnitMmY,
      socketHeightMm
    );
    // Stacked plates nest into each other by the socket depth, so the per-plate
    // stack pitch is the resolved base-profile height, not the fixed 5mm.
    const socketH = socketHeightMm ?? GRIDFINITY_SPEC.SOCKET_HEIGHT;
    const groups = stackGroupsFromTiling(tiling, fullParams, copies);
    const cap = stackHeightCap(maxPrintHeightMm, socketH, gapMm);
    return {
      status: evaluateStackPrint(groups, cap, socketH, maxPrintHeightMm),
      plan: planPhysicalStacks(groups, cap),
    };
  }, [
    baseplateParams,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    gridUnitMmY,
    socketHeightMm,
    fractionalEdgeX,
    fractionalEdgeY,
    nozzleSizeMm,
    maxPrintHeightMm,
    tiling,
    gapMm,
    copies,
  ]);

  // Margins are emitted only when detachMargins resolves on, so the tiling
  // already gates the count.
  const railCount = tiling?.margins.length ?? 0;

  return { status, gapMm, maxPrintHeightMm, plan, railCount };
}
