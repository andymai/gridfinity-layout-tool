/**
 * Assembled-height derivation: how tall the design actually stands once it is
 * seated on a baseplate with its lid on.
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
 *
 * Lives in `shared/` rather than beside the designer because three consumers
 * outside it need the same answer and cannot reach `features/bin-designer`:
 * the layout's drawer ceiling, the bin inspector's height hint, and the layers
 * panel's budget. `AssembledHeightSource` is structural, so a layout bin
 * resolved from `linkedDesignId` measures through the identical derivation the
 * designer draws.
 */

import { GRIDFINITY_SPEC as GRIDFINITY } from '@/shared/printSettings/gridfinityGeometry';
import { baseFloorZ } from '@/features/bin-designer/utils/binDimensions';
import {
  isSocketlessBase,
  resolveTileFloorThickness,
  type BaseStyle,
} from '@/features/bin-designer/types/base';
import {
  isHingeLid,
  isSlideLid,
  LID_FIT_CLEARANCE,
  LID_HINGE_BARREL_RADIUS_MM,
  lidAnchorZ,
  resolveLidCavityExtraMm,
  resolveLidPlateThickness,
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
   * How far the bin's base sinks into the plate (mm). `SOCKET_HEIGHT` when the
   * bin seats on one, 0 otherwise — a flat base has no socket and a bare bin
   * has no plate to sink into.
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
  /** Read only for a base-only bin, whose whole body is a floor slab this thick. */
  readonly wallThickness: number;
  readonly extraWallHeightMm?: number;
  readonly base: {
    readonly style: BaseStyle;
    readonly stackingLip: boolean;
    readonly magnetDepth: number;
    readonly tile?: boolean;
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
  const cap = -lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params));
  return cap + hingeProudMm(params);
}

/**
 * How far a hinge barrel stands above the lid's own top face, in mm.
 *
 * The axis sits on the plate's UNDERSIDE, so the barrel reaches its radius
 * above that plane while the plate reaches only its own thickness — the
 * difference is real material above the highest point `lidRiseMm` would
 * otherwise report. It is ~1.4mm on a stock lid: small, invisible to the eye,
 * and exactly the size of error that lets a drawer-ceiling check pass a
 * layout that does not fit. Every restatement of the lid anchor chain that has
 * gone wrong in this repo has gone wrong by less than this (CLAUDE.md gotcha
 * #14).
 *
 * Zero once the plate is thicker than the barrel's radius, which is why it is
 * a `max` and not an unconditional term.
 */
function hingeProudMm(params: AssembledHeightSource): number {
  if (!isHingeLid(params.lid)) return 0;
  return Math.max(0, LID_HINGE_BARREL_RADIUS_MM - resolveLidPlateThickness(params));
}

/**
 * Whether a lid is actually part of the assembly. Mirrors the preview/export
 * gate: the lid mates with the stacking lip, so a lip-less bin generates none
 * however the lid config is persisted.
 */
export function hasSeatedLid(params: AssembledHeightSource): boolean {
  // Mirrors `shouldGenerateLid`, including its base-only gate: a base-only bin
  // keeps its lip, so the lip precondition alone would seat a lid on a plate that
  // has no cavity to close, and the readout would count a band the worker never
  // builds.
  if (params.base.tile === true) return false;
  // A sliding lid never seats over the lip: both placements put the plate AT or
  // BELOW the wall top (`plateTopBelowWallTopMm >= 0`), so it adds no rise and
  // the cap-lid `lidRiseMm` formula does not describe it. Without this gate the
  // DEFAULT slide config (recessed, lip kept) books a phantom ~2.1mm lid band,
  // and the drawer-ceiling check warns on layouts that fit.
  if (isSlideLid(params.lid)) return false;
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
  // A flat base and a tray bottom both lack a socket, so neither seats
  // on a baseplate — a tray sits on the BIN below it, via its lid skirt.
  const seatedOnPlate =
    plate !== undefined && params.base.style !== 'flat' && params.base.style !== 'lid';

  const baseplatePrintedMm = seatedOnPlate ? baseplateTotalHeight(plate) : 0;
  // The bin drops its base into the pockets, so only the solid floor under them
  // lifts it — zero for the common no-magnet, no-solid-floor plate.
  const plateBandMm = seatedOnPlate ? baseplateFloorDepth(plate) : 0;
  const nestedMm = seatedOnPlate ? GRIDFINITY.SOCKET_HEIGHT : 0;

  // A tray's skirt is printed material below its floor, so it counts toward the
  // assembly's height. `extraHeightMm` is the whole point of the feature —
  // turning it up to clear protruding contents has to move this number.
  const skirtMm = baseFloorZ(params.base, params.heightUnitMm, params.lid);
  // A base-only bin's body is its feet plus a `wallThickness` floor slab and
  // nothing more, so its height is `baseFloorZ` (SOCKET_HEIGHT) plus that slab
  // rather than `height * heightUnitMm`. Reading `height` here would report 7mm
  // for a 6.2mm body: the field is inert on a tray, pinned to 1 purely to satisfy
  // the range validators (see `BaseConfig.tile`). This is the readout drawer
  // clearance is computed from, so the whole point of the mode (a plate that
  // barely rises above the plate it sits in) depends on it.
  const isTile = params.base.tile === true && !isSocketlessBase(params.base.style);
  const binMm = isTile
    ? skirtMm + resolveTileFloorThickness(params.wallThickness)
    : params.height * params.heightUnitMm +
      Math.max(0, params.extraWallHeightMm ?? 0) +
      (params.base.style === 'lid' ? skirtMm : 0);
  const lipMm = params.base.stackingLip ? GRIDFINITY.LIP_HEIGHT : 0;
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
