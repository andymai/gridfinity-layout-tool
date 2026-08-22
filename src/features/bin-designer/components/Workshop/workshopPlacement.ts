/**
 * World-placement math for the Workshop proxy scene.
 *
 * Store frame: origin at the base's bottom-left corner, mm, Z-up, z = 0 at
 * the base floor's top face. The scene centers the base on the XY origin, so
 * components convert with `storeToScene`/`sceneToStore`.
 */
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { partSeatHeight } from './proxyGeometry';

const DEG = Math.PI / 180;

export interface PlacedPart {
  readonly node: AssemblyPartNode;
  /** Selection id: array copies of a node all select the same node. */
  readonly selectId: string;
  /** Unique render key per expanded instance. */
  readonly key: string;
  /** Anchor position in the store frame (mm). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotZDeg: number;
  /** z of this part's top face — the seat plane its children stack on. */
  readonly topZ: number;
  readonly parentId: string | null;
  readonly depth: number;
}

function rotate2d(x: number, y: number, deg: number): { x: number; y: number } {
  if (deg === 0) return { x, y };
  const rad = deg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** Flatten the attachment tree into world-placed instances, expanding arrays. */
export function resolvePlacedParts(structure: AssemblyStructure): PlacedPart[] {
  const placed: PlacedPart[] = [];
  const walk = (
    nodes: readonly AssemblyPartNode[],
    origin: { x: number; y: number; rotZDeg: number; topZ: number },
    parentId: string | null,
    depth: number,
    keyPrefix: string
  ): void => {
    for (const node of nodes) {
      const copies = node.array ? node.array.count : 1;
      for (let i = 0; i < copies; i += 1) {
        const step = node.array
          ? rotate2d(node.array.dx * i, node.array.dy * i, origin.rotZDeg)
          : { x: 0, y: 0 };
        const local = rotate2d(node.transform.x, node.transform.y, origin.rotZDeg);
        const x = origin.x + local.x + step.x;
        const y = origin.y + local.y + step.y;
        const z = origin.topZ + node.transform.seatZ;
        const rotZDeg = origin.rotZDeg + node.transform.rotZDeg;
        const topZ = z + partSeatHeight(node);
        const key = `${keyPrefix}${node.id}${i > 0 ? `#${i}` : ''}`;
        placed.push({ node, selectId: node.id, key, x, y, z, rotZDeg, topZ, parentId, depth });
        walk(node.children, { x, y, rotZDeg, topZ }, node.id, depth + 1, `${key}/`);
      }
    }
  };
  walk(structure.parts, { x: 0, y: 0, rotZDeg: 0, topZ: 0 }, null, 1, '');
  return placed;
}

export function baseExtentMm(envelope: ItemEnvelope): { w: number; d: number } {
  return {
    w: envelope.width * envelope.gridUnitMm,
    d: envelope.depth * envelope.gridUnitMm,
  };
}

export function storeToScene(v: number, extent: number): number {
  return v - extent / 2;
}

export function sceneToStore(v: number, extent: number): number {
  return v + extent / 2;
}

export const PLACEMENT_SNAP_MM = 3.5;
export const FINE_SNAP_MM = 0.1;

export function snapCoord(v: number, fine: boolean): number {
  const step = fine ? FINE_SNAP_MM : PLACEMENT_SNAP_MM;
  return Math.round(v / step) * step;
}

/**
 * Convert a store-frame world point to a transform local to `parent`
 * (null = a root seated on the base floor).
 */
export function worldToParentLocal(
  point: { x: number; y: number },
  parent: PlacedPart | null
): { x: number; y: number } {
  if (!parent) return { x: point.x, y: point.y };
  return rotate2d(point.x - parent.x, point.y - parent.y, -parent.rotZDeg);
}
