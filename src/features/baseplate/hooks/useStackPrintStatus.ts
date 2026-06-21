/**
 * Classifies the current stack-print job so the panel can warn when the user's
 * dimensions/gap would produce no real stacking (a single plate, an all-unique
 * split, or a build height that fits only one plate per tower) instead of
 * silently baking single-plate "towers".
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
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
}

export function useStackPrintStatus(gapMm: number): StackPrintStatusInfo {
  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
  } = useLayoutStore(
    useShallow((s) => ({
      drawerWidth: s.layout.drawer.width,
      drawerDepth: s.layout.drawer.depth,
      gridUnitMm: s.layout.gridUnitMm,
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
      nozzleSizeMm
    );
    const groups = stackGroupsFromTiling(tiling, fullParams, copies);
    const cap = stackHeightCap(maxPrintHeightMm, GRIDFINITY_SPEC.SOCKET_HEIGHT, gapMm);
    return {
      status: evaluateStackPrint(groups, cap, GRIDFINITY_SPEC.SOCKET_HEIGHT, maxPrintHeightMm),
      plan: planPhysicalStacks(groups, cap),
    };
  }, [
    baseplateParams,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    nozzleSizeMm,
    maxPrintHeightMm,
    tiling,
    gapMm,
    copies,
  ]);

  return { status, gapMm, maxPrintHeightMm, plan };
}
