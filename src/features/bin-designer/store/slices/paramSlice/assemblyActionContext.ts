/**
 * Closures every assembly action shares: the current part list, the one-entry
 * commit, world placements by select id and the world-to-parent-local
 * conversion the batch moves are built on.
 */
import { clampPartTransform } from '@/shared/items/assembly/descriptor';
import type { AssemblyPartNode, PartTransform } from '@/shared/types/assembly';
import { resolvePlacedParts, rotate2d, type PlacedPart } from '@/shared/types/assemblyPlacement';
import {
  findAssemblyPart,
  withAssemblyPartUpdated,
} from '@/features/bin-designer/utils/assemblyTree';
import { pushHistoryEntry } from '@/features/bin-designer/store/helpers';
import type { Set, Get } from './types';

export function transformsEqual(a: PartTransform, b: PartTransform): boolean {
  return a.x === b.x && a.y === b.y && a.seatZ === b.seatZ && a.rotZDeg === b.rotZDeg;
}

export function normalizeDeg(deg: number): number {
  const wrapped = (((deg % 360) + 540) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export const PASTE_OFFSET_MM = 8;

export type AssemblyActionContext = ReturnType<typeof createAssemblyActionContext>;

export function createAssemblyActionContext(set: Set, get: Get) {
  const parts = (): AssemblyPartNode[] | null => {
    const structure = get().structure;
    return structure?.kind === 'assembly' ? structure.parts : null;
  };

  const commitParts = (next: AssemblyPartNode[]): void => {
    set((state) => {
      if (state.structure?.kind !== 'assembly') return;
      pushHistoryEntry(state);
      state.structure.parts = next;
    });
  };

  /** World placements by select id — the same resolution the scene renders. */
  const placedById = (): Map<string, PlacedPart> | null => {
    const { structure, envelope } = get();
    if (structure?.kind !== 'assembly' || !envelope) return null;
    const extent = {
      w: envelope.width * envelope.gridUnitMm,
      d: envelope.depth * envelope.gridUnitMm,
    };
    const map = new Map<string, PlacedPart>();
    for (const placed of resolvePlacedParts(structure, extent)) {
      if (!map.has(placed.selectId)) map.set(placed.selectId, placed);
    }
    return map;
  };

  /** Convert a world-frame target into `placed`'s parent-local transform fields. */
  const worldToLocal = (
    placed: PlacedPart,
    map: Map<string, PlacedPart>,
    world: { x: number; y: number; rotZDeg?: number }
  ): Partial<PartTransform> => {
    const parent = placed.parentId === null ? null : (map.get(placed.parentId) ?? null);
    const parentX = parent?.x ?? 0;
    const parentY = parent?.y ?? 0;
    const parentRot = parent?.rotZDeg ?? 0;
    const local = rotate2d(world.x - parentX, world.y - parentY, -parentRot);
    return {
      x: local.x,
      y: local.y,
      ...(world.rotZDeg !== undefined ? { rotZDeg: normalizeDeg(world.rotZDeg - parentRot) } : {}),
    };
  };

  /**
   * Apply per-part world targets in one history entry. Entries whose id no
   * longer resolves are skipped; a batch that changes nothing commits nothing.
   */
  const applyWorldTargets = (
    targets: readonly { id: string; x: number; y: number; rotZDeg?: number }[]
  ): void => {
    const current = parts();
    const map = placedById();
    if (!current || !map) return;
    let next: AssemblyPartNode[] = current;
    let changed = false;
    for (const target of targets) {
      const placed = map.get(target.id);
      const node = findAssemblyPart(next, target.id);
      if (!placed || !node) continue;
      const nextTransform = clampPartTransform({
        ...node.transform,
        ...worldToLocal(placed, map, target),
      });
      if (transformsEqual(nextTransform, node.transform)) continue;
      const updated = withAssemblyPartUpdated(next, target.id, (n) => ({
        ...n,
        transform: nextTransform,
      }));
      if (!updated) continue;
      next = updated;
      changed = true;
    }
    if (changed) commitParts(next);
  };

  return { parts, commitParts, placedById, worldToLocal, applyWorldTargets };
}
