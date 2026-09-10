/**
 * Multi-part assembly actions: world-frame moves over a selection, remove,
 * duplicate and the copy/paste clipboard. Each commits ONE history entry.
 */
import { clampPartTransform } from '@/shared/items/assembly/descriptor';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { rotate2d } from '@/shared/types/assemblyPlacement';
import {
  cloneAssemblySubtree,
  collectAssemblyIds,
  filterTopLevelAssemblyIds,
  findAssemblyParentId,
  findAssemblyPart,
  withAssemblyPartAdded,
  withAssemblyPartRemoved,
} from '@/features/bin-designer/utils/assemblyTree';
import { pushHistoryEntry, setAssemblySelection } from '@/features/bin-designer/store/helpers';
import type { Set, Get } from './types';
import { normalizeDeg, PASTE_OFFSET_MM } from './assemblyActionContext';
import type { AssemblyActionContext } from './assemblyActionContext';

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

export function createAssemblyBatchActions(set: Set, get: Get, ctx: AssemblyActionContext) {
  const { parts, placedById, applyWorldTargets } = ctx;

  return {
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
      const first = sorted.at(0);
      const last = sorted.at(-1);
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
  };
}
