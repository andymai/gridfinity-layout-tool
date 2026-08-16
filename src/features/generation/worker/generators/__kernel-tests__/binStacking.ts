/**
 * Stack one generated bin on another and measure what the joint actually does.
 *
 * The inspector prints two numbers per bin, "Prints Xmm · stacks +Ymm each":
 * the first from `LIP_PROTRUSION_MM`, the second from `stackPitchMm`, with
 * `stackedTotalMm` behind the stack solver's total. All three rest on one
 * claim — how deep the bin above settles onto the lip below — and neither mesh
 * can confirm it. Each bin is watertight and correctly sized on its own
 * whatever happens at the joint (CLAUDE.md gotchas #14, #15, #18), and a test
 * that recomputes the constant from the profiles it came from only proves it
 * equals itself.
 *
 * So this mates the pair, lets the upper bin fall, and reports the pitch it
 * came to rest at. It reuses `seatDepth` rather than reimplementing the
 * descent: the question is the same one the baseplate probe asks, of a
 * different partner, and it is unaimed on purpose — a joint landing somewhere
 * nobody predicted still registers.
 */

import { seatDepth, type Placement } from './binSeating';
import { boundingBox } from './meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';

/** Directly on top — the only placement a stack has. */
const ON_TOP: Placement = { dx: 0, dy: 0 };

export interface StackSeat {
  /** Height the assembled pair spans, in mm. What a caliper reads. */
  readonly totalMm: number;
  /** Height the upper bin adds to the stack, in mm. The UI's "stacks +Ymm". */
  readonly pitchMm: number;
  /** Lower bin's lip left standing proud of the joint, in mm. */
  readonly junctionMm: number;
  /** Column the pair first touched at — where to look when a number is wrong. */
  readonly x: number;
  readonly y: number;
}

function spanZ(mesh: MeshData): number {
  const bb = boundingBox(mesh.vertices);
  return bb.maxZ - bb.minZ;
}

/**
 * Drops `upper` onto `lower` and reports the resulting stack.
 *
 * Non-finite fields mean the sweep never found contact, which for two bins
 * sharing a footprint can only be a probe failure rather than a real gap —
 * check `Number.isFinite` before reading the numbers.
 */
export function stackSeat(
  upper: MeshData,
  lower: MeshData,
  place: Placement = ON_TOP,
  step?: number
): StackSeat {
  const { mm: junctionMm, x, y } = seatDepth(upper, lower, place, step);
  const upperSpan = spanZ(upper);
  return {
    junctionMm,
    pitchMm: upperSpan - junctionMm,
    totalMm: spanZ(lower) + upperSpan - junctionMm,
    x,
    y,
  };
}
