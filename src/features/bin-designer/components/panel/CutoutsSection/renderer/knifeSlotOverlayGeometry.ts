/**
 * Top-down knife silhouettes for the 2D cutout editor: for every wall-aligned,
 * open-ended knife slot, the handle that lies past the block's open end, drawn
 * in the slot's own placed frame so it reads as a knife rather than a trench.
 *
 * The 3D preview's `GhostKnives` draws the SIDE profile and only when the design
 * has a rest to plan; this is the plan view, shown while you place and aim the
 * slot, so the fat end of a wooden handle is visible sticking over the wall the
 * moment you choose which way it exits.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { DEFAULT_KNIFE_SPEC } from '@/features/bin-designer/types';
import { GHOST_HANDLE_LENGTH_MM } from '../../../preview/GhostKnives/knifeGhostGeometry';

/** Segments approximating the handle's rounded butt. */
const BUTT_SEGMENTS = 10;

/** A closed outline in world (bin-interior) mm coordinates. */
export type KnifeOverlayLoop = readonly (readonly [number, number])[];

/**
 * The handle loop a knife slot's open end carries, in world mm. Empty for a
 * slot with no open end (enclosed) or one off the wall grid — both are cases
 * the block does not actually let a handle out of, so drawing one would lie.
 */
export function knifeSlotOverlayLoops(cutout: Cutout): readonly KnifeOverlayLoop[] {
  if (cutout.shape !== 'knifeSlot' || cutout.groupId !== null) return [];
  const knife = cutout.knife ?? DEFAULT_KNIFE_SPEC;
  if (knife.openEnd === undefined) return [];
  if (cutout.rotation % 90 !== 0) return [];

  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const sign = knife.openEnd === 'end' ? 1 : -1;
  const r = knife.handleWidthMm / 2;
  const nearEdge = cutout.width / 2; // the wall the handle leaves through, local +X
  const straight = Math.max(0, GHOST_HANDLE_LENGTH_MM - r);

  // Build in local +X (blade axis), rounded at the butt, then flip by `sign`.
  const local: [number, number][] = [
    [nearEdge, -r],
    [nearEdge + straight, -r],
  ];
  for (let i = 1; i < BUTT_SEGMENTS; i++) {
    const a = -Math.PI / 2 + (i / BUTT_SEGMENTS) * Math.PI;
    local.push([nearEdge + straight + r * Math.cos(a), r * Math.sin(a)]);
  }
  local.push([nearEdge + straight, r], [nearEdge, r]);

  const theta = -(cutout.rotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const world: [number, number][] = local.map(([lx, ly]) => {
    const sx = lx * sign;
    return [cx + sx * cos - ly * sin, cy + sx * sin + ly * cos];
  });
  return [world];
}

/** Flat `[x,y,z, x,y,z, …]` line-segment positions for one closed loop at `z`. */
export function loopToSegmentPositions(loop: KnifeOverlayLoop, z: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < loop.length; i++) {
    const [ax, ay] = loop[i];
    const [bx, by] = loop[(i + 1) % loop.length];
    out.push(ax, ay, z, bx, by, z);
  }
  return out;
}
