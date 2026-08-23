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
  PartTransform,
} from '@/shared/types/assembly';
import {
  collectAssemblyIds,
  findAssemblyParentId,
  findAssemblyPart,
  findAssemblySiblings,
  withAssemblyPartAdded,
  withAssemblyPartRemoved,
  withAssemblyPartReparented,
  withAssemblyPartUpdated,
} from '@/features/bin-designer/utils/assemblyTree';
import { pushHistoryEntry } from '@/features/bin-designer/store/helpers';
import type { Set, Get } from './types';

function transformsEqual(a: PartTransform, b: PartTransform): boolean {
  return a.x === b.x && a.y === b.y && a.seatZ === b.seatZ && a.rotZDeg === b.rotZDeg;
}

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
        crypto.randomUUID(),
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
        state.ui.selectedAssemblyPartId = node.id;
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
      const cloneNode = (n: AssemblyPartNode): AssemblyPartNode =>
        ({
          ...n,
          id: crypto.randomUUID(),
          transform: { ...n.transform },
          params: { ...n.params },
          ...(n.array ? { array: { ...n.array } } : {}),
          children: n.children.map(cloneNode),
        }) as AssemblyPartNode;
      const copy = cloneNode(node);
      const offset = {
        ...copy,
        transform: clampPartTransform({ ...copy.transform, x: copy.transform.x + 8 }),
      } as AssemblyPartNode;
      const parentId = findAssemblyParentId(current, id) ?? null;
      const next = withAssemblyPartAdded(current, parentId, offset);
      if (!next) return null;
      set((state) => {
        if (state.structure?.kind !== 'assembly') return;
        pushHistoryEntry(state);
        state.structure.parts = next;
        state.ui.selectedAssemblyPartId = offset.id;
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
        const selected = state.ui.selectedAssemblyPartId;
        if (selected !== null && removedIds.has(selected)) {
          state.ui.selectedAssemblyPartId = null;
        }
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
        state.ui.selectedAssemblyPartId = null;
      });
      return true;
    },

    updateAssemblyBase: (partial: Partial<AssemblyBase>): void => {
      const structure = get().structure;
      if (structure?.kind !== 'assembly') return;
      const nextBase = clampAssemblyBase({ ...structure.base, ...partial });
      if (
        nextBase.floorThickness === structure.base.floorThickness &&
        nextBase.cornerRadius === structure.base.cornerRadius
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
