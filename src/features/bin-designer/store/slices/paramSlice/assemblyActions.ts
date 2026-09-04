/**
 * Workshop assembly actions: place/move/reparent/remove parts on the
 * attachment tree and edit their params. Thin wrappers over the pure ops in
 * `utils/assemblyTree` — each computes from the current snapshot, no-ops when
 * the op reports invalid, and commits with ONE history entry. Every commit
 * goes through the schema-derived clamps, so the store can never hold a tree
 * that `migrate()` would prune on the next load.
 */
import {
  assemblyPartNodeSchema,
  assemblySchema,
  clampAssemblyBase,
  clampPartTransform,
  createAssemblyPartNode,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import type {
  AssemblyBase,
  AssemblyPartNode,
  AssemblyPartParams,
  AssemblyPartType,
  PartArray,
  PartLabel,
  PartTransform,
} from '@/shared/types/assembly';
import { resolvePlacedParts, rotate2d, type PlacedPart } from '@/shared/types/assemblyPlacement';
import {
  cloneAssemblySubtree,
  collectAssemblyIds,
  filterTopLevelAssemblyIds,
  findAssemblyParentId,
  findAssemblyPart,
  findAssemblySiblings,
  withAssemblyPartAdded,
  withAssemblyPartRemoved,
  withAssemblyPartReparented,
  withAssemblyPartUpdated,
} from '@/features/bin-designer/utils/assemblyTree';
import { pushHistoryEntry, setAssemblySelection } from '@/features/bin-designer/store/helpers';
import type { Set, Get } from './types';
import { generateUUID } from '@/shared/utils/uuid';

function transformsEqual(a: PartTransform, b: PartTransform): boolean {
  return a.x === b.x && a.y === b.y && a.seatZ === b.seatZ && a.rotZDeg === b.rotZDeg;
}

function normalizeDeg(deg: number): number {
  const wrapped = (((deg % 360) + 540) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/**
 * Group-op clipboard. Module-level like the pending mesh cache: node data
 * never needs to be reactive (the UI only needs the count, mirrored in
 * `ui.workshopClipboardCount`), and keeping frozen snapshots out of the
 * store means paste after any amount of editing still reads a stable copy.
 */
interface WorkshopClipboardEntry {
  readonly node: AssemblyPartNode;
  readonly world: { x: number; y: number; rotZDeg: number };
}
let workshopClipboard: {
  readonly entries: readonly WorkshopClipboardEntry[];
  readonly centroid: { x: number; y: number };
} | null = null;

/** @internal test-only reset so suites don't leak copies into each other. */
export function _resetWorkshopClipboard(): void {
  workshopClipboard = null;
}

const PASTE_OFFSET_MM = 8;

export function createAssemblyActions(set: Set, get: Get) {
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

  return {
    addAssemblyPart: (
      type: AssemblyPartType,
      parentId: string | null,
      transform?: Partial<PartTransform>,
      params?: Partial<AssemblyPartParams>
    ): string | null => {
      const current = parts();
      if (!current) return null;
      const base = createAssemblyPartNode(
        type,
        generateUUID(),
        clampPartTransform({ ...DEFAULT_PART_TRANSFORM, ...transform })
      );
      const node = params
        ? ({ ...base, params: { ...base.params, ...params } } as AssemblyPartNode)
        : base;
      if (params && !assemblyPartNodeSchema.safeParse(node).success) return null;
      const next = withAssemblyPartAdded(current, parentId, node);
      if (!next) return null;
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = next;
        setAssemblySelection(state, [node.id], node.id);
      });
      return node.id;
    },

    moveAssemblyPart: (id: string, transform: Partial<PartTransform>): void => {
      const current = parts();
      if (!current) return;
      const node = findAssemblyPart(current, id);
      if (!node) return;
      const nextTransform = clampPartTransform({ ...node.transform, ...transform });
      // A zero-delta move stays a true no-op so a click without a drag
      // doesn't push a history entry.
      if (transformsEqual(nextTransform, node.transform)) return;
      const next = withAssemblyPartUpdated(current, id, (n) => ({
        ...n,
        transform: nextTransform,
      }));
      if (next) commitParts(next);
    },

    reparentAssemblyPart: (
      id: string,
      newParentId: string | null,
      transform?: Partial<PartTransform>
    ): boolean => {
      const current = parts();
      if (!current) return false;
      const reparented = withAssemblyPartReparented(current, id, newParentId);
      if (!reparented) return false;
      const node = findAssemblyPart(reparented, id);
      if (!node) return false;
      const next = transform
        ? withAssemblyPartUpdated(reparented, id, (n) => ({
            ...n,
            transform: clampPartTransform({ ...n.transform, ...transform }),
          }))
        : reparented;
      if (!next) return false;
      commitParts(next);
      return true;
    },

    duplicateAssemblyPart: (id: string): string | null => {
      const current = parts();
      if (!current) return null;
      const node = findAssemblyPart(current, id);
      if (!node) return null;
      const copy = cloneAssemblySubtree(node);
      const offset = {
        ...copy,
        transform: clampPartTransform({
          ...copy.transform,
          x: copy.transform.x + PASTE_OFFSET_MM,
        }),
      } as AssemblyPartNode;
      const parentId = findAssemblyParentId(current, id) ?? null;
      const next = withAssemblyPartAdded(current, parentId, offset);
      if (!next) return null;
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = next;
        setAssemblySelection(state, [offset.id], offset.id);
      });
      return offset.id;
    },

    removeAssemblyPart: (id: string): void => {
      const current = parts();
      if (!current) return;
      const node = findAssemblyPart(current, id);
      if (!node) return;
      const removedIds = new Set(collectAssemblyIds([node]));
      const next = withAssemblyPartRemoved(current, id);
      if (!next) return;
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = next;
        setAssemblySelection(
          state,
          state.ui.selectedAssemblyPartIds.filter((selected) => !removedIds.has(selected)),
          state.ui.selectedAssemblyPartId
        );
      });
    },

    updateAssemblyPartParams: (id: string, params: Partial<AssemblyPartParams>): void => {
      const current = parts();
      if (!current) return;
      const node = findAssemblyPart(current, id);
      if (!node) return;
      const candidate = { ...node, params: { ...node.params, ...params } } as AssemblyPartNode;
      const parsed = assemblyPartNodeSchema.safeParse(candidate);
      if (!parsed.success) return;
      const next = withAssemblyPartUpdated(current, id, () => parsed.data);
      if (next) commitParts(next);
    },

    setAssemblyPartArray: (id: string, array: PartArray | null): void => {
      const current = parts();
      if (!current) return;
      const node = findAssemblyPart(current, id);
      if (!node) return;
      const candidate = {
        ...node,
        ...(array === null ? {} : { array }),
      };
      if (array === null) delete (candidate as { array?: PartArray }).array;
      if (!assemblyPartNodeSchema.safeParse(candidate).success) return;
      const next = withAssemblyPartUpdated(current, id, () => candidate);
      if (next) commitParts(next);
    },

    setAssemblyPartLabel: (id: string, label: PartLabel | null): void => {
      const current = parts();
      if (!current) return;
      const node = findAssemblyPart(current, id);
      if (!node) return;
      const candidate = {
        ...node,
        ...(label === null ? {} : { label: { ...label, text: label.text.slice(0, 40) } }),
      };
      if (label === null) delete (candidate as { label?: PartLabel }).label;
      if (!assemblyPartNodeSchema.safeParse(candidate).success) return;
      const next = withAssemblyPartUpdated(current, id, () => candidate);
      if (next) commitParts(next);
    },

    setAssemblyPartMirror: (id: string, mirror: boolean): void => {
      const current = parts();
      if (!current) return;
      const node = findAssemblyPart(current, id);
      if (!node || (node.mirror ?? false) === mirror) return;
      const candidate = { ...node };
      if (mirror) candidate.mirror = true;
      else delete candidate.mirror;
      const next = withAssemblyPartUpdated(current, id, () => candidate);
      if (next) commitParts(next);
    },

    setAssemblyMirrorAxis: (axis: 'x' | 'y'): void => {
      const structure = get().structure;
      if (structure?.kind !== 'assembly' || structure.mirrorAxis === axis) return;
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.mirrorAxis = axis;
      });
    },

    alignAssemblySiblings: (id: string, axis: 'x' | 'y'): void => {
      const current = parts();
      if (!current) return;
      const siblings = findAssemblySiblings(current, id);
      const anchor = siblings?.find((n) => n.id === id);
      if (!siblings || !anchor || siblings.length < 2) return;
      const value = anchor.transform[axis];
      if (siblings.every((n) => n.transform[axis] === value)) return;
      let next: AssemblyPartNode[] | null = current;
      for (const sibling of siblings) {
        if (sibling.transform[axis] === value) continue;
        next = withAssemblyPartUpdated(next, sibling.id, (n) => ({
          ...n,
          transform: clampPartTransform({ ...n.transform, [axis]: value }),
        }));
        if (!next) return;
      }
      commitParts(next);
    },

    distributeAssemblySiblings: (id: string, axis: 'x' | 'y'): void => {
      const current = parts();
      if (!current) return;
      const siblings = findAssemblySiblings(current, id);
      if (!siblings || siblings.length < 3) return;
      const sorted = [...siblings].sort((a, b) => a.transform[axis] - b.transform[axis]);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (!first || !last) return;
      const span = last.transform[axis] - first.transform[axis];
      const step = span / (sorted.length - 1);
      let next: AssemblyPartNode[] | null = current;
      let changed = false;
      for (let i = 1; i < sorted.length - 1; i += 1) {
        const sibling = sorted[i];
        if (!sibling) continue;
        const target = first.transform[axis] + step * i;
        if (sibling.transform[axis] === target) continue;
        changed = true;
        next = withAssemblyPartUpdated(next, sibling.id, (n) => ({
          ...n,
          transform: clampPartTransform({ ...n.transform, [axis]: target }),
        }));
        if (!next) return;
      }
      if (changed) commitParts(next);
    },

    loadAssemblyTemplate: (parts_: AssemblyPartNode[]): boolean => {
      const structure = get().structure;
      if (structure?.kind !== 'assembly') return false;
      const candidate = { ...structure, parts: parts_ };
      if (!assemblySchema.safeParse(candidate).success) return false;
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = parts_;
        setAssemblySelection(state, []);
      });
      return true;
    },

    /**
     * Set world placements for several parts at once (group drag/rotate).
     * Targets are world-frame; descendants of another target ride along with
     * their ancestor, so callers pass top-level ids only.
     */
    moveAssemblyPartsWorldTo: (
      targets: readonly { id: string; x: number; y: number; rotZDeg?: number }[]
    ): void => {
      applyWorldTargets(targets);
    },

    /** Translate the selection's top-level parts by a world-frame delta. */
    nudgeAssemblyPartsWorld: (ids: readonly string[], dx: number, dy: number): void => {
      if (dx === 0 && dy === 0) return;
      const current = parts();
      const map = placedById();
      if (!current || !map) return;
      const top = filterTopLevelAssemblyIds(current, new Set(ids));
      applyWorldTargets(
        top.flatMap((id) => {
          const placed = map.get(id);
          return placed ? [{ id, x: placed.x + dx, y: placed.y + dy }] : [];
        })
      );
    },

    /**
     * Rotate the selection's top-level parts by `deltaDeg` about their world
     * centroid — positions orbit the pivot, each part spins with them. A
     * single part spins in place (its own anchor is the pivot).
     */
    rotateAssemblyPartsWorld: (ids: readonly string[], deltaDeg: number): void => {
      const current = parts();
      const map = placedById();
      if (!current || !map || deltaDeg === 0) return;
      const top = filterTopLevelAssemblyIds(current, new Set(ids));
      const placements = top.flatMap((id) => map.get(id) ?? []);
      if (placements.length === 0) return;
      const pivot = {
        x: placements.reduce((sum, p) => sum + p.x, 0) / placements.length,
        y: placements.reduce((sum, p) => sum + p.y, 0) / placements.length,
      };
      applyWorldTargets(
        placements.map((placed) => {
          const orbited = rotate2d(placed.x - pivot.x, placed.y - pivot.y, deltaDeg);
          return {
            id: placed.selectId,
            x: pivot.x + orbited.x,
            y: pivot.y + orbited.y,
            rotZDeg: placed.rotZDeg + deltaDeg,
          };
        })
      );
    },

    /**
     * Align the selection's top-level parts to the anchor part's world
     * coordinate on one axis. The anchor never moves.
     */
    alignAssemblyPartsWorld: (ids: readonly string[], axis: 'x' | 'y'): void => {
      const current = parts();
      const map = placedById();
      if (!current || !map) return;
      const anchorId = get().ui.selectedAssemblyPartId;
      if (anchorId === null || !ids.includes(anchorId)) return;
      const anchor = map.get(anchorId);
      if (!anchor) return;
      const top = filterTopLevelAssemblyIds(current, new Set(ids));
      if (top.length < 2) return;
      applyWorldTargets(
        top.flatMap((id) => {
          const placed = map.get(id);
          if (!placed || id === anchorId) return [];
          return [
            { id, x: axis === 'x' ? anchor.x : placed.x, y: axis === 'y' ? anchor.y : placed.y },
          ];
        })
      );
    },

    /** Evenly space the selection's top-level parts between the two outermost. */
    distributeAssemblyPartsWorld: (ids: readonly string[], axis: 'x' | 'y'): void => {
      const current = parts();
      const map = placedById();
      if (!current || !map) return;
      const top = filterTopLevelAssemblyIds(current, new Set(ids));
      const placements = top.flatMap((id) => map.get(id) ?? []);
      if (placements.length < 3) return;
      const sorted = [...placements].sort((a, b) => a[axis] - b[axis]);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (!first || !last) return;
      const step = (last[axis] - first[axis]) / (sorted.length - 1);
      applyWorldTargets(
        sorted.slice(1, -1).map((placed, index) => ({
          id: placed.selectId,
          x: axis === 'x' ? first.x + step * (index + 1) : placed.x,
          y: axis === 'y' ? first.y + step * (index + 1) : placed.y,
        }))
      );
    },

    /** Remove every selected subtree in one history entry. */
    removeAssemblyParts: (ids: readonly string[]): void => {
      const current = parts();
      if (!current) return;
      const top = filterTopLevelAssemblyIds(current, new Set(ids));
      if (top.length === 0) return;
      const removedIds = new Set<string>();
      let next: AssemblyPartNode[] = current;
      for (const id of top) {
        const node = findAssemblyPart(next, id);
        if (!node) continue;
        for (const removed of collectAssemblyIds([node])) removedIds.add(removed);
        const without = withAssemblyPartRemoved(next, id);
        if (without) next = without;
      }
      if (removedIds.size === 0) return;
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = next;
        setAssemblySelection(
          state,
          state.ui.selectedAssemblyPartIds.filter((selected) => !removedIds.has(selected)),
          state.ui.selectedAssemblyPartId
        );
      });
    },

    /**
     * Duplicate every selected subtree in one history entry and select the
     * clones, so a follow-up drag moves the copies as a group. `offsetMm`
     * shifts the clones aside (default) — alt-drag passes 0 so the clone
     * starts under the pointer. Returns clone ids with their source ids so
     * the caller can pick up the clone of the part it grabbed.
     */
    duplicateAssemblyParts: (
      ids: readonly string[],
      offsetMm: number = PASTE_OFFSET_MM
    ): { id: string; sourceId: string }[] => {
      const current = parts();
      if (!current) return [];
      const top = filterTopLevelAssemblyIds(current, new Set(ids));
      if (top.length === 0) return [];
      const anchorId = get().ui.selectedAssemblyPartId;
      let next: AssemblyPartNode[] = current;
      const clones: { id: string; sourceId: string }[] = [];
      let cloneAnchor: string | null = null;
      for (const id of top) {
        const node = findAssemblyPart(next, id);
        if (!node) continue;
        const copy = cloneAssemblySubtree(node);
        const offset = {
          ...copy,
          transform: clampPartTransform({
            ...copy.transform,
            x: copy.transform.x + offsetMm,
          }),
        } as AssemblyPartNode;
        const parentId = findAssemblyParentId(next, id) ?? null;
        const added = withAssemblyPartAdded(next, parentId, offset);
        if (!added) continue;
        next = added;
        clones.push({ id: offset.id, sourceId: id });
        if (id === anchorId) cloneAnchor = offset.id;
      }
      if (clones.length === 0) return [];
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = next;
        setAssemblySelection(
          state,
          clones.map((clone) => clone.id),
          cloneAnchor
        );
      });
      return clones;
    },

    /** Snapshot the selected subtrees (with world placement) for paste. */
    copyAssemblyParts: (ids: readonly string[]): number => {
      const current = parts();
      const map = placedById();
      if (!current || !map) return 0;
      const top = filterTopLevelAssemblyIds(current, new Set(ids));
      const entries: WorkshopClipboardEntry[] = top.flatMap((id) => {
        const node = findAssemblyPart(current, id);
        const placed = map.get(id);
        if (!node || !placed) return [];
        return [
          {
            node: structuredClone(node),
            world: { x: placed.x, y: placed.y, rotZDeg: placed.rotZDeg },
          },
        ];
      });
      if (entries.length === 0) return 0;
      workshopClipboard = {
        entries,
        centroid: {
          x: entries.reduce((sum, e) => sum + e.world.x, 0) / entries.length,
          y: entries.reduce((sum, e) => sum + e.world.y, 0) / entries.length,
        },
      };
      set((state) => {
        state.ui.workshopClipboardCount = entries.length;
      });
      return entries.length;
    },

    /**
     * Paste the clipboard onto the base floor, keeping the copied
     * arrangement, centered at `at` (default: beside the source). Pasted
     * parts keep their copied world rotations and become the selection.
     */
    pasteAssemblyParts: (at?: { x: number; y: number }): string[] => {
      const clipboard = workshopClipboard;
      const current = parts();
      if (!clipboard || !current) return [];
      const target = at ?? {
        x: clipboard.centroid.x + PASTE_OFFSET_MM,
        y: clipboard.centroid.y + PASTE_OFFSET_MM,
      };
      let next: AssemblyPartNode[] = current;
      const pastedIds: string[] = [];
      for (const entry of clipboard.entries) {
        const copy = cloneAssemblySubtree(entry.node);
        const placedCopy = {
          ...copy,
          transform: clampPartTransform({
            x: target.x + (entry.world.x - clipboard.centroid.x),
            y: target.y + (entry.world.y - clipboard.centroid.y),
            seatZ: 0,
            rotZDeg: normalizeDeg(entry.world.rotZDeg),
          }),
        } as AssemblyPartNode;
        const added = withAssemblyPartAdded(next, null, placedCopy);
        if (!added) continue;
        next = added;
        pastedIds.push(placedCopy.id);
      }
      if (pastedIds.length === 0) return [];
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = next;
        setAssemblySelection(state, pastedIds);
      });
      return pastedIds;
    },

    updateAssemblyBase: (partial: Partial<AssemblyBase>): void => {
      const structure = get().structure;
      if (structure?.kind !== 'assembly') return;
      const nextBase = clampAssemblyBase({ ...structure.base, ...partial });
      if (
        nextBase.floorThickness === structure.base.floorThickness &&
        nextBase.cornerRadius === structure.base.cornerRadius &&
        nextBase.wedge?.angleDeg === structure.base.wedge?.angleDeg &&
        nextBase.wedge?.lowEdge === structure.base.wedge?.lowEdge
      ) {
        return;
      }
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.base = nextBase;
      });
    },
  };
}
