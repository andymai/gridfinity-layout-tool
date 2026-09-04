/**
 * Pure, structurally-sharing operations over the Workshop part tree.
 * Every mutator returns a new root array on change, the SAME array
 * reference when the operation is a no-op, and null when it is invalid —
 * callers translate null into "don't push a history entry".
 */
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { MAX_ASSEMBLY_DEPTH, MAX_ASSEMBLY_PARTS } from '@/shared/items/assembly/descriptor';
import { generateUUID } from '@/shared/utils/uuid';

export function findAssemblyPart(
  parts: readonly AssemblyPartNode[],
  id: string
): AssemblyPartNode | null {
  for (const node of parts) {
    if (node.id === id) return node;
    const found = findAssemblyPart(node.children, id);
    if (found) return found;
  }
  return null;
}

export function countAssemblyParts(parts: readonly AssemblyPartNode[]): number {
  return parts.reduce((sum, n) => sum + 1 + countAssemblyParts(n.children), 0);
}

function subtreeDepth(node: AssemblyPartNode): number {
  return 1 + (node.children.length === 0 ? 0 : Math.max(...node.children.map(subtreeDepth)));
}

/** Depth of the node with `id` (roots are depth 1), or 0 when absent. */
function depthOf(parts: readonly AssemblyPartNode[], id: string, depth: number): number {
  for (const node of parts) {
    if (node.id === id) return depth;
    const found = depthOf(node.children, id, depth + 1);
    if (found > 0) return found;
  }
  return 0;
}

export function collectAssemblyIds(parts: readonly AssemblyPartNode[]): string[] {
  return parts.flatMap((n) => [n.id, ...collectAssemblyIds(n.children)]);
}

export function withAssemblyPartAdded(
  parts: AssemblyPartNode[],
  parentId: string | null,
  node: AssemblyPartNode
): AssemblyPartNode[] | null {
  if (countAssemblyParts(parts) + countAssemblyParts([node]) > MAX_ASSEMBLY_PARTS) return null;
  const parentDepth = parentId === null ? 0 : depthOf(parts, parentId, 1);
  if (parentId !== null && parentDepth === 0) return null;
  if (parentDepth + subtreeDepth(node) > MAX_ASSEMBLY_DEPTH) return null;
  if (parentId === null) return [...parts, node];
  const attach = (nodes: AssemblyPartNode[]): AssemblyPartNode[] => {
    let changed = false;
    const next = nodes.map((n) => {
      if (n.id === parentId) {
        changed = true;
        return { ...n, children: [...n.children, node] };
      }
      const children = attach(n.children);
      if (children === n.children) return n;
      changed = true;
      return { ...n, children };
    });
    return changed ? next : nodes;
  };
  return attach(parts);
}

export function withAssemblyPartRemoved(
  parts: AssemblyPartNode[],
  id: string
): AssemblyPartNode[] | null {
  let removed = false;
  const strip = (nodes: AssemblyPartNode[]): AssemblyPartNode[] => {
    const kept = nodes.filter((n) => {
      if (n.id === id) {
        removed = true;
        return false;
      }
      return true;
    });
    if (kept.length !== nodes.length) return kept;
    let changed = false;
    const next = nodes.map((n) => {
      const children = strip(n.children);
      if (children === n.children) return n;
      changed = true;
      return { ...n, children };
    });
    return changed ? next : nodes;
  };
  const next = strip(parts);
  return removed ? next : null;
}

export function withAssemblyPartUpdated(
  parts: AssemblyPartNode[],
  id: string,
  update: (node: AssemblyPartNode) => AssemblyPartNode
): AssemblyPartNode[] | null {
  let found = false;
  const walk = (nodes: AssemblyPartNode[]): AssemblyPartNode[] => {
    let changed = false;
    const next = nodes.map((n) => {
      if (n.id === id) {
        found = true;
        changed = true;
        return update(n);
      }
      const children = walk(n.children);
      if (children === n.children) return n;
      changed = true;
      return { ...n, children };
    });
    return changed ? next : nodes;
  };
  const next = walk(parts);
  return found ? next : null;
}

/**
 * Detach a subtree and seat it under a new parent (null = the base floor).
 * Fails on a missing node, a parent inside the moved subtree, or a result
 * that would exceed the depth cap; the part count is unchanged by design.
 */
export function withAssemblyPartReparented(
  parts: AssemblyPartNode[],
  id: string,
  newParentId: string | null
): AssemblyPartNode[] | null {
  if (id === newParentId) return null;
  const node = findAssemblyPart(parts, id);
  if (!node) return null;
  if (newParentId !== null && findAssemblyPart([node], newParentId)) return null;
  const without = withAssemblyPartRemoved(parts, id);
  if (!without) return null;
  return withAssemblyPartAdded(without, newParentId, node);
}

/** Parent id of the node with `id` (null = root), or undefined when absent. */
export function findAssemblyParentId(
  parts: readonly AssemblyPartNode[],
  id: string,
  parent: string | null = null
): string | null | undefined {
  for (const node of parts) {
    if (node.id === id) return parent;
    const found = findAssemblyParentId(node.children, id, node.id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The sibling list containing `id`: root parts, or the parent's children. */
export function findAssemblySiblings(
  parts: AssemblyPartNode[],
  id: string
): AssemblyPartNode[] | null {
  if (parts.some((n) => n.id === id)) return parts;
  for (const node of parts) {
    const found = findAssemblySiblings(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Deep-copy a subtree (nested params included) with fresh ids on every node. */
export function cloneAssemblySubtree(node: AssemblyPartNode): AssemblyPartNode {
  const reId = (n: AssemblyPartNode): AssemblyPartNode => ({
    ...n,
    id: generateUUID(),
    children: n.children.map(reId),
  });
  return reId(structuredClone(node));
}

/**
 * Reduce a selection to its top-level members: ids whose ancestors are not
 * also selected, in tree order. Group operations act on these and let the
 * subtrees ride along, so a parent and its child in one selection never get
 * a transform applied twice.
 */
export function filterTopLevelAssemblyIds(
  parts: readonly AssemblyPartNode[],
  ids: ReadonlySet<string>
): string[] {
  const result: string[] = [];
  const walk = (nodes: readonly AssemblyPartNode[], underSelected: boolean): void => {
    for (const node of nodes) {
      const selected = !underSelected && ids.has(node.id);
      if (selected) result.push(node.id);
      walk(node.children, underSelected || selected);
    }
  };
  walk(parts, false);
  return result;
}
