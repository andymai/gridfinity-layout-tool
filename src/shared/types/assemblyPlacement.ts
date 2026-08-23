/**
 * World-placement math for a Workshop assembly — the ONE statement of how a
 * part tree flattens into placed instances. The proxy scene and the worker
 * generator both consume this; a divergence here IS preview-vs-export drift.
 *
 * Frame: origin at the base's bottom-left corner, mm, Z-up, z = 0 at the
 * base floor's top face (the root seat plane).
 */
import type { AssemblyPartNode, AssemblyStructure, CutterProfile } from '@/shared/types/assembly';

const DEG = Math.PI / 180;

/** Height of the part's top face above its own seat — the child seat plane. */
export function partSeatHeight(node: AssemblyPartNode): number {
  switch (node.type) {
    case 'post':
      return node.params.height;
    case 'fin':
      return node.params.height;
    case 'block':
      return node.params.height;
    case 'tube':
      return node.params.height;
    case 'cradle':
      return node.params.height;
    case 'hook': {
      const { stemHeight, lipHeight, thickness } = node.params;
      return Math.max(stemHeight, stemHeight - thickness + lipHeight);
    }
    case 'arch':
      return node.params.height;
    case 'cutter':
      return 0;
  }
}

/** XY footprint extents (mm) used for drag planes and ghost outlines. */
export function partFootprint(node: AssemblyPartNode): { w: number; d: number } {
  switch (node.type) {
    case 'post':
      return { w: node.params.diameter, d: node.params.diameter };
    case 'fin':
      return { w: node.params.length, d: node.params.thickness };
    case 'block':
      return { w: node.params.width, d: node.params.depth };
    case 'tube': {
      const outer = node.params.boreDiameter + 2 * node.params.wall;
      return { w: outer, d: outer };
    }
    case 'cradle':
      return { w: node.params.length, d: node.params.width };
    case 'hook':
      return { w: node.params.width, d: node.params.reach };
    case 'arch': {
      const { span, uprightThickness, depth } = node.params;
      return { w: span + 2 * uprightThickness, d: depth };
    }
    case 'cutter':
      return cutterFootprint(node.params.profile);
  }
}

function cutterFootprint(profile: CutterProfile): { w: number; d: number } {
  switch (profile.shape) {
    case 'circle':
      return { w: profile.diameter, d: profile.diameter };
    case 'rectangle':
      return { w: profile.width, d: profile.depth };
    case 'polygon':
      return { w: profile.diameter, d: profile.diameter };
    case 'slot':
      return { w: profile.length, d: profile.width };
    case 'path':
    case 'outline': {
      const xs = profile.points.map((p) => p.x);
      const ys = profile.points.map((p) => p.y);
      return {
        w: Math.max(1, Math.max(...xs) - Math.min(...xs)),
        d: Math.max(1, Math.max(...ys) - Math.min(...ys)),
      };
    }
  }
}

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

export function rotate2d(x: number, y: number, deg: number): { x: number; y: number } {
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
