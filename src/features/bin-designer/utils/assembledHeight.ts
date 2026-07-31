/**
 * Assembled-height derivation: how tall the design actually stands once it is
 * seated on a baseplate with its lid on (issue #3037).
 *
 * The number users need for drawer clearance is not any single printed height.
 * A socketed bin's base sinks into the baseplate's pockets, so the plate
 * contributes only the solid material *below* those pockets — zero for the
 * common no-magnet, no-solid-floor plate. Summing printed heights instead
 * overstates clearance by a full SOCKET_HEIGHT, which is the mistake this
 * readout exists to prevent.
 *
 * Bands are disjoint and measured from the underside of the plate upward, so
 * they sum to `totalMm` exactly and can be drawn as a segmented dimension line.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  LID_FIT_CLEARANCE,
  lidAnchorZ,
  resolveLidCavityExtraMm,
  type LidConfig,
} from '@/features/bin-designer/types/lid';
import {
  baseplateFloorDepth,
  baseplateTotalHeight,
  type BaseplateHeightParams,
} from '@/shared/printSettings/baseplateHeight';
import type { CellMask } from '@/shared/utils/cellMask';

/**
 * Which physical component a band belongs to. Drives both the 3D segment
 * labels and the sidebar rows, so the two can never list different parts.
 */
export type AssembledSegmentKind = 'baseplate' | 'bin' | 'stackingLip' | 'lid' | 'lidStackGrid';

/**
 * i18n key per band. Lives beside the type so the sidebar rows and the 3D
 * segment labels name the same parts, and so adding a kind without a label is
 * a compile error rather than a blank row.
 */
export const ASSEMBLED_SEGMENT_LABEL_KEYS: Record<AssembledSegmentKind, string> = {
  baseplate: 'assembledHeight.baseplate',
  bin: 'assembledHeight.bin',
  stackingLip: 'assembledHeight.stackingLip',
  lid: 'assembledHeight.lid',
  lidStackGrid: 'assembledHeight.lidStackGrid',
};

export interface AssembledSegment {
  readonly kind: AssembledSegmentKind;
  /** Height of this band in mm. Bands are disjoint and sum to `totalMm`. */
  readonly mm: number;
  /** Z of the band's underside, in mm above the bottom of the assembly. */
  readonly startMm: number;
}

export interface AssembledHeight {
  /** Bottom-to-top, disjoint, summing to `totalMm`. */
  readonly segments: readonly AssembledSegment[];
  /** Bottom of the baseplate to the highest point of the assembly, in mm. */
  readonly totalMm: number;
  /** The baseplate's own printed height (mm) — what comes off the bed. */
  readonly baseplatePrintedMm: number;
  /**
   * How far the bin's base sinks into the plate (mm). `SOCKET_HEIGHT` for a
   * socketed bin, 0 for a flat base, which rests on the plate's top face.
   */
  readonly nestedMm: number;
}

/**
 * The slice of `BinParams` this derivation reads. Declared structurally so
 * tests can build minimal fixtures and so nothing here depends on the full
 * params barrel. `BinParams` satisfies it.
 */
export interface AssembledHeightSource {
  readonly height: number;
  readonly heightUnitMm: number;
  readonly extraWallHeightMm?: number;
  readonly base: {
    readonly style: string;
    readonly stackingLip: boolean;
    readonly magnetDepth: number;
  };
  readonly lid: LidConfig;
  readonly cellMask?: CellMask;
}

/**
 * Net rise a lid adds above the bin's stacking-lip top, in mm.
 *
 * The lid seats with its local Z=0 (top face) at `lipTop − anchorZ`, exactly as
 * `LidMesh` positions it, so the visible rise is `−anchorZ`. `anchorZ` is always
 * negative and deepens with `resolveLidCavityExtraMm`, so a taller lid or a
 * thicker floor plate stands proportionally higher.
 */
function lidRiseMm(params: AssembledHeightSource): number {
  return -lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params));
}

/**
 * Whether a lid is actually part of the assembly. Mirrors the preview/export
 * gate: the lid mates with the stacking lip, so a lip-less bin generates none
 * however the lid config is persisted.
 */
export function hasSeatedLid(params: AssembledHeightSource): boolean {
  return params.lid.enabled && params.base.stackingLip;
}

/**
 * Break the assembled stack into bottom-to-top bands.
 *
 * @param params  The design being measured.
 * @param plate   Baseplate the design is seated on. Omit for a bare bin.
 */
export function assembledHeight(
  params: AssembledHeightSource,
  plate?: BaseplateHeightParams
): AssembledHeight {
  // A flat base has no socket, so it does not seat on a baseplate at all — it
  // sits directly in the drawer. Counting a plate under it would overstate
  // clearance by the plate's full height, the same class of error this readout
  // exists to prevent.
  const seatedOnPlate = plate !== undefined && params.base.style !== 'flat';

  const baseplatePrintedMm = seatedOnPlate ? baseplateTotalHeight(plate) : 0;
  // The bin drops its base into the pockets, so only the solid floor under them
  // lifts it — zero for the common no-magnet, no-solid-floor plate.
  const plateBandMm = seatedOnPlate ? baseplateFloorDepth(plate) : 0;
  const nestedMm = seatedOnPlate ? GRIDFINITY.SOCKET_HEIGHT : 0;

  const binMm = params.height * params.heightUnitMm + Math.max(0, params.extraWallHeightMm ?? 0);
  const lipMm = params.base.stackingLip ? GRIDFINITY.LIP_HEIGHT - GRIDFINITY.LIP_OVERLAP : 0;
  const lidMm = hasSeatedLid(params) ? lidRiseMm(params) : 0;
  // The stack grid is a SOCKET_HEIGHT slab above the lid's top face, whether it
  // is fused on or printed separately and glued. With nothing stacked on it, its
  // top is the assembly's highest point.
  const gridMm = lidMm > 0 && params.lid.stackableTop ? GRIDFINITY.SOCKET_HEIGHT : 0;

  const segments: AssembledSegment[] = [];
  let z = 0;
  const push = (kind: AssembledSegmentKind, mm: number): void => {
    segments.push({ kind, mm, startMm: z });
    z += mm;
  };

  // The plate band is emitted even at 0mm when the bin seats on one: "adds 0mm"
  // is the answer to the question this feature exists to settle.
  if (seatedOnPlate) push('baseplate', plateBandMm);
  push('bin', binMm);
  if (lipMm > 0) push('stackingLip', lipMm);
  if (lidMm > 0) push('lid', lidMm);
  if (gridMm > 0) push('lidStackGrid', gridMm);

  return { segments, totalMm: z, baseplatePrintedMm, nestedMm };
}
