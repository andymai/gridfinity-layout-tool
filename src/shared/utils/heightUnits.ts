import { CONSTRAINTS } from '@/core/constants';
import { GRIDFINITY_SPEC } from '@/shared/printSettings';

/**
 * Exposed stacking lip on a printed bin, in mm — the part standing above the
 * wall top, and so what a single bin's printed height carries on top of its
 * body. Matches `BinDimensions`.
 *
 * This is NOT how deep the bin above sinks onto it: that is
 * {@link STACK_JUNCTION_MM}, and conflating the two is what made every stack
 * readout 0.45mm per junction too tall (#3525).
 */
export const LIP_PROTRUSION_MM = GRIDFINITY_SPEC.LIP_HEIGHT;

/**
 * How far a stacked bin settles below the lip top of the bin under it, in mm.
 *
 * The joint is the base's big chamfer resting flush on the lip's, both at 45
 * degrees, so the pair comes to rest when their full-width points meet — which
 * puts the upper bin's underside one base profile below the lip top. The base
 * reaches full width `TOLERANCE/2` under the top of its socket, so that profile
 * is `SOCKET_HEIGHT - TOLERANCE/2`.
 *
 * It is the base profile that sets this, never the lip: at 4.4mm of profile
 * against the base's 4.75mm the lip is the shorter of the two, so the bin above
 * settles 0.35mm past the lip's base plane. Both figures come from the
 * reference profiles, so a canonical Gridfinity stack does not add body height
 * either.
 *
 * Measured on the mated solids rather than trusted from this arithmetic —
 * `binStackSeating.kernel.test.ts`.
 */
export const STACK_JUNCTION_MM = GRIDFINITY_SPEC.SOCKET_HEIGHT - GRIDFINITY_SPEC.TOLERANCE / 2;

/**
 * Vertical pitch a stacked bin adds, in mm: its printed height less the depth
 * it sinks into the bin below. Slightly under the body height, because the bin
 * settles past the lip's base rather than onto it.
 */
export function stackPitchMm(heightUnits: number, heightUnitMm: number): number {
  return heightUnits * heightUnitMm + LIP_PROTRUSION_MM - STACK_JUNCTION_MM;
}

/**
 * Total printed height of a stack of `count` identical bins, in mm:
 * `count × pitch + the junction the topmost bin does not sink into`. A single
 * bin (count 1) returns its full printed height (`h·u + LIP_PROTRUSION_MM`).
 */
export function stackedTotalMm(heightUnits: number, heightUnitMm: number, count: number): number {
  if (count <= 0) return 0;
  return count * stackPitchMm(heightUnits, heightUnitMm) + STACK_JUNCTION_MM;
}

/**
 * The tallest WHOLE-unit bin height that lets `count` identical bins stack
 * under `ceilingMm`, at the layout's existing `heightUnitMm`.
 *
 * The inverse of {@link stackedTotalMm} for the question users actually
 * ask: not "what unit fills this exactly" — which yields a non-standard unit
 * and breaks compatibility with stock bins — but "how tall can my bins be and
 * still let the lid close". Returns null when even a 1u bin overflows.
 */
export function solveUnitsUnderCeiling(
  ceilingMm: number,
  heightUnitMm: number,
  count: number
): number | null {
  if (count <= 0 || heightUnitMm <= 0 || !Number.isFinite(ceilingMm)) return null;
  // Invert `stackedTotalMm`, then take the whole unit below it. The epsilon
  // absorbs binary error on an exact fit, so a ceiling of exactly 4 x 7mm + lip
  // reports 4u rather than 3u.
  const bodyMm = (ceilingMm - STACK_JUNCTION_MM) / count - LIP_PROTRUSION_MM + STACK_JUNCTION_MM;
  const units = Math.floor(bodyMm / heightUnitMm + 1e-9);
  return units >= 1 ? units : null;
}

/**
 * Sub-millimetre differences between a design's assembled rise and the plain
 * stacking pitch are profile arithmetic (lip vs junction constants differ by
 * under half a millimetre across base styles), not a real obstruction — only
 * excess beyond this counts toward collision.
 */
const STACK_EXCESS_EPSILON_MM = 0.5;

/**
 * How far a linked design's real assembled rise protrudes past the unit-space
 * charge its bin already pays in collision (`height + clearance`), in height
 * units.
 *
 * The unit model charges a plain bin its stacking pitch — body height with the
 * lip netted against the junction the bin above sinks into. Expressing the
 * linked design's rise in the same net convention makes a standard design come
 * out at exactly zero, so only genuine protrusions (lids, stack grids, extra
 * wall height, a bin whose height diverged from its design) charge the layers
 * above. A lipless design grants no junction, mirroring `drawerCeilingFit`'s
 * supporter-side credit.
 */
export function linkedStackExcessUnits(
  binHeightUnits: number,
  heightUnitMm: number,
  linked: { riseMm: number; hasLip?: boolean } | undefined
): number {
  if (linked === undefined || heightUnitMm <= 0 || !Number.isFinite(linked.riseMm)) return 0;
  const linkedNetMm = linked.riseMm - (linked.hasLip !== false ? STACK_JUNCTION_MM : 0);
  const excessMm = linkedNetMm - stackPitchMm(binHeightUnits, heightUnitMm);
  return excessMm > STACK_EXCESS_EPSILON_MM ? excessMm / heightUnitMm : 0;
}

/**
 * Format a (possibly fractional) height-unit value for display: up to two
 * decimals with trailing zeros stripped, so 5 -> "5", 4.37 -> "4.37".
 */
export function formatHeightUnits(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * Whether a bin of `heightUnits` at `heightUnitMm` ends up a clean multiple of
 * the standard 7mm height unit. When false, the physical height won't stack
 * with standard Gridfinity bins — used to surface a non-blocking warning, not
 * to block the value.
 */
export function isStandardStackHeight(heightUnits: number, heightUnitMm: number): boolean {
  const physicalMm = heightUnits * heightUnitMm;
  const remainder = physicalMm % CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT;
  const distance = Math.min(remainder, CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT - remainder);
  return distance < 0.01;
}
