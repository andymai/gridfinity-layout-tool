/**
 * Does the layout actually fit under the drawer lid?
 *
 * The layout's own height budget is unit arithmetic: layer heights sum against
 * `drawer.height`, both in height units. Printed parts are not unit multiples.
 * A bin stands `LIP_PROTRUSION_MM` above its body, and a stacked bin settles
 * `STACK_JUNCTION_MM` into the one below, so a column that exactly fills the
 * unit budget prints `4.3 - (n-1) x 0.45` mm proud of the drawer it was sized
 * for. That is invisible to every existing check and is what stops a lid
 * closing.
 *
 * The ceiling is the user's MEASURED drawer height only, never
 * `drawer.height * heightUnitMm`: the stored unit count is the measurement
 * floored to 0.01u, so comparing against it reports overflow on layouts that
 * fit. Same rule as `useAssembledHeight`.
 */

import { STAGING_ID } from '@/core/constants';
import type { Bin, BinId, Layer } from '@/core/types';
import {
  baseplateFloorDepth,
  baseplateTotalHeight,
  type BaseplateHeightParams,
} from '@/shared/printSettings/baseplateHeight';
import { LIP_PROTRUSION_MM, STACK_JUNCTION_MM } from './heightUnits';

/** Below this the difference is print tolerance, not a fit problem. */
export const CEILING_EPSILON_MM = 0.05;

/**
 * What a linked design contributes, resolved from the custom-bin registry.
 * The registry is the only synchronous view of a saved design; full params
 * live in IndexedDB and cannot be read during a selector.
 */
export interface LinkedDesignRise {
  /** `assembledHeight(...).totalMm` without a plate: body, lip, lid, grid. */
  readonly riseMm: number;
  /** A flat or tray base has no socket, so it neither nests nor seats. */
  readonly socketless: boolean;
  /**
   * Whether the design keeps its stacking lip — the junction a bin stacked ON
   * TOP of it settles into. Absent (pre-field registry entries) reads as true,
   * matching the plain-bin assumption.
   */
  readonly hasLip?: boolean;
}

export interface DrawerCeilingBin {
  readonly binId: BinId;
  /** Top of this bin's material above the drawer floor, mm. */
  readonly topMm: number;
  /** `topMm` plus declared clearance — the height contents actually reach. */
  readonly contentsTopMm: number;
  /** How far `contentsTopMm` stands proud of the ceiling. Positive only. */
  readonly overflowMm: number;
}

export interface DrawerCeilingFit {
  readonly ceilingMm: number;
  /** The highest point anything in the layout reaches, mm. */
  readonly tallestMm: number;
  /** Ceiling minus `tallestMm`. Negative means it does not fit. */
  readonly slackMm: number;
  readonly fits: boolean;
  /** Only the bins standing proud, tallest first. Empty when it fits. */
  readonly overflowing: readonly DrawerCeilingBin[];
}

export interface DrawerCeilingInput {
  readonly bins: readonly Bin[];
  /** Bottom-to-top, as stored. `layers[0]` is the bottom. */
  readonly layers: readonly Layer[];
  readonly heightUnitMm: number;
  readonly plate: BaseplateHeightParams;
  /** Measured internal drawer height in mm, or undefined when unmeasured. */
  readonly ceilingMm: number | undefined;
  /** Registry-resolved rise per linked design. Absent = measure as a plain bin. */
  readonly linkedRise?: (bin: Bin) => LinkedDesignRise | undefined;
}

function footprintsOverlap(a: Bin, b: Bin): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
}

/**
 * Per-bin rise and nesting depth.
 *
 * `riseMm` is measured from the bin's own underside to its highest point, so a
 * linked design's lid is included; `nestMm` is how far that underside sinks
 * into whatever it lands on. Splitting the two is what lets a column be summed
 * without re-deriving the junction at every step.
 */
function binRise(
  bin: Bin,
  heightUnitMm: number,
  linked: LinkedDesignRise | undefined
): { riseMm: number; nestMm: number; hasLip: boolean } {
  if (linked) {
    return {
      riseMm: linked.riseMm,
      nestMm: linked.socketless ? 0 : STACK_JUNCTION_MM,
      hasLip: linked.hasLip !== false,
    };
  }
  return {
    riseMm: bin.height * heightUnitMm + LIP_PROTRUSION_MM,
    nestMm: STACK_JUNCTION_MM,
    hasLip: true,
  };
}

/**
 * Measure every column in the layout and report the tallest against the
 * ceiling. Returns null when the drawer is unmeasured — the caller shows the
 * prompt to measure rather than a fit answer.
 *
 * Columns are resolved by footprint overlap rather than by grid cell: a bin
 * rests on whatever is directly beneath it, which is the tallest already-placed
 * bin its footprint touches. Walking layers bottom-to-top means every supporter
 * is measured before anything that lands on it.
 *
 * Deliberately NOT the layer's z-start. Layers are a planning abstraction; a
 * printed bin is loose in a drawer and falls until something stops it. So a bin
 * on layer 3 with nothing under it on layer 2 rests on the layer-1 bin it
 * overlaps, which is lower than its layer implies — the physical answer, and
 * the one a lid cares about. The two only diverge downward: a bin is never
 * shorter than its own layer (`useBinInspector` floors it there), and a bin
 * taller than its layer blocks the cells above it, so nothing can be stranded
 * in mid-air above one.
 */
export function drawerCeilingFit(input: DrawerCeilingInput): DrawerCeilingFit | null {
  const { bins, layers, heightUnitMm, plate, ceilingMm, linkedRise } = input;
  if (ceilingMm === undefined || !Number.isFinite(ceilingMm) || ceilingMm <= 0) return null;

  // A seated bin drops its socket into the plate's pockets, so only the solid
  // material below them lifts it — 0 for the common no-magnet, no-solid-floor
  // plate. Using the plate's printed height here would overstate every column
  // by a full SOCKET_HEIGHT.
  const plateRiseMm = baseplateFloorDepth(plate);

  const layerOrder = new Map(layers.map((l, i) => [l.id, i]));
  const placed = bins
    .filter((b) => b.layerId !== STAGING_ID && layerOrder.has(b.layerId))
    .sort((a, b) => (layerOrder.get(a.layerId) ?? 0) - (layerOrder.get(b.layerId) ?? 0));

  const measured: DrawerCeilingBin[] = [];
  const supports: { bin: Bin; topMm: number; hasLip: boolean }[] = [];

  for (const bin of placed) {
    const linked = linkedRise?.(bin);
    const { riseMm, nestMm, hasLip } = binRise(bin, heightUnitMm, linked);

    // The junction credit needs both halves: the upper bin's socket to sink,
    // and the SUPPORTER's lip to sink into. A bin resting on a lipless design
    // sits on its flat top and nests nothing.
    let supportTopMm: number | undefined;
    let supportHasLip = true;
    for (const under of supports) {
      if (!footprintsOverlap(bin, under.bin)) continue;
      if (supportTopMm === undefined || under.topMm > supportTopMm) {
        supportTopMm = under.topMm;
        supportHasLip = under.hasLip;
      }
    }

    // A socketless design has no foot to drop into the plate's pockets, so it
    // rests on the plate's TOP FACE — the full printed height above the drawer
    // floor, not zero. `assembledHeight` omits the plate band for these because
    // the designer measures a bare bin with an OPTIONAL plate; here the model
    // always has one (socketed columns are credited its pockets on the same
    // assumption), so the two rules agree on the premise and differ on the face.
    const topMm =
      supportTopMm === undefined
        ? (linked?.socketless === true ? baseplateTotalHeight(plate) : plateRiseMm) + riseMm
        : supportTopMm - (supportHasLip ? nestMm : 0) + riseMm;

    const clearanceMm = (bin.clearanceHeight ?? 0) * heightUnitMm;
    const contentsTopMm = topMm + clearanceMm;
    supports.push({ bin, topMm, hasLip });
    measured.push({
      binId: bin.id,
      topMm,
      contentsTopMm,
      overflowMm: Math.max(0, contentsTopMm - ceilingMm),
    });
  }

  const tallestMm = measured.reduce((max, b) => Math.max(max, b.contentsTopMm), 0);
  const overflowing = measured
    .filter((b) => b.overflowMm > CEILING_EPSILON_MM)
    .sort((a, b) => b.contentsTopMm - a.contentsTopMm);

  return {
    ceilingMm,
    tallestMm,
    slackMm: ceilingMm - tallestMm,
    fits: overflowing.length === 0,
    overflowing,
  };
}
