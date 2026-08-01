/**
 * Cutout shape list (issue #3053).
 *
 * A layers panel for the cut editor: every shape as a row, groups as
 * expandable parents, ordered topmost-first so the list reads the way the
 * canvas looks. Exists because overlapping shapes are hard to select on the
 * canvas — clicking a row is unambiguous where clicking the drawing is not.
 *
 * Drag has two drop targets per row: the strip along a row's top edge reorders
 * above it, the row body drops into a group. Dropping a group row into another
 * group is rejected — nested groups are not a thing the model supports, and
 * silently flattening them would lose the boolean op.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import type { Cutout } from '@/features/bin-designer/types';
import {
  allSelected,
  buildShapeList,
  nodeIds,
  partiallySelected,
  type ShapeListNode,
} from '@/features/bin-designer/components/panel/CutoutsSection/shapeListModel';
import { ShapeListRow, type DropKind } from './ShapeListRow';

export interface ShapeListProps {
  readonly cutouts: readonly Cutout[];
  readonly selection: ReadonlySet<string>;
  readonly onSelect: (ids: readonly string[], additive: boolean) => void;
  readonly onSetProperty: (
    ids: readonly string[],
    partial: Partial<Pick<Cutout, 'locked' | 'hidden' | 'name'>>
  ) => void;
  /** Drag reorder: move `ids` above `targetId`, or to the bottom when null. */
  readonly onMoveAbove: (ids: readonly string[], targetId: string | null) => void;
  /** Drag reparent: pull `ids` into the group `targetId` belongs to. */
  readonly onGroupWith: (ids: readonly string[], targetId: string) => void;
  /** Drag out of a group. */
  readonly onUngroup: (ids: readonly string[]) => void;
}

interface DragState {
  readonly ids: readonly string[];
  readonly isGroup: boolean;
}

export function ShapeList({
  cutouts,
  selection,
  onSelect,
  onSetProperty,
  onMoveAbove,
  onGroupWith,
  onUngroup,
}: ShapeListProps) {
  const t = useTranslation();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<{ id: string; kind: DropKind } | null>(null);

  const nodes = useMemo(() => buildShapeList(cutouts), [cutouts]);

  const toggleExpanded = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDragStart = useCallback(
    (node: ShapeListNode) => {
      // Dragging a row that is part of the current selection moves the whole
      // selection; dragging an unselected row moves just that row.
      const ids = nodeIds(node);
      const inSelection = ids.every((id) => selection.has(id));
      setDrag({
        ids: inSelection && selection.size > 0 ? [...selection] : ids,
        isGroup: node.kind === 'group',
      });
    },
    [selection]
  );

  const handleDragEnd = useCallback(() => {
    setDrag(null);
    setHover(null);
  }, []);

  const handleDrop = useCallback(
    (node: ShapeListNode, kind: DropKind) => {
      const active = drag;
      setDrag(null);
      setHover(null);
      if (!active) return;
      const moving = new Set(active.ids);
      if (nodeIds(node).some((id) => moving.has(id))) return;

      if (kind === 'above') {
        // Above a group row means above its whole stack, so anchor on the
        // topmost member rather than the synthetic group id.
        const target = node.kind === 'group' ? (node.members[0]?.id ?? null) : node.id;
        onMoveAbove(active.ids, target);
        return;
      }

      // Into: reparent. A group can't nest inside another group.
      if (active.isGroup) return;
      if (node.kind === 'group') {
        const anchor = node.members[0]?.id;
        if (anchor) onGroupWith(active.ids, anchor);
        return;
      }
      // Dropping onto a loose shape pulls both into a group together; dropping
      // onto a grouped shape joins that group.
      onGroupWith(active.ids, node.id);
    },
    [drag, onMoveAbove, onGroupWith]
  );

  const rowProps = (node: ShapeListNode) => {
    const ids = nodeIds(node);
    return {
      node,
      selected: allSelected(ids, selection),
      partial: partiallySelected(ids, selection),
      expanded: !collapsed.has(node.id),
      onToggleExpanded: toggleExpanded,
      onSelect,
      onToggleLock: (targets: readonly string[], locked: boolean) =>
        onSetProperty(targets, { locked }),
      onToggleHidden: (targets: readonly string[], hidden: boolean) =>
        onSetProperty(targets, { hidden }),
      onRename: (id: string, name: string) =>
        onSetProperty([id], { name: name === '' ? undefined : name }),
      onDragStart: handleDragStart,
      onDragOverKind: (n: ShapeListNode, kind: DropKind) => {
        setHover((h) => (h?.id === n.id && h.kind === kind ? h : { id: n.id, kind }));
      },
      onDrop: handleDrop,
      onDragEnd: handleDragEnd,
      dropHint: hover?.id === node.id ? hover.kind : null,
    };
  };

  if (nodes.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[11px] text-content-tertiary">
        {t('binDesigner.shapeList.empty')}
      </p>
    );
  }

  return (
    <div
      className="flex flex-col gap-px px-2 py-1"
      onDragOver={(e) => {
        // A drag ending in the empty space below the list drops to the bottom.
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        const active = drag;
        setDrag(null);
        setHover(null);
        if (active) onMoveAbove(active.ids, null);
      }}
    >
      <div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.shapeList.countLabel', { count: String(cutouts.length) })}
      </div>
      {nodes.map((node) => (
        <div key={node.id} onDragLeave={() => setHover((h) => (h?.id === node.id ? null : h))}>
          <ShapeListRow {...rowProps(node)} />
          {node.kind === 'group' && !collapsed.has(node.id) && (
            <div className="flex flex-col gap-px">
              {node.members.map((member) => (
                <div key={member.id}>
                  <ShapeListRow {...rowProps(member)} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {/* Explicit drop zone so "send to the bottom" has a target even when the
          list fills the panel. */}
      <div
        className={`mt-1 h-6 rounded border border-dashed ${
          drag ? 'border-stroke-subtle' : 'border-transparent'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const active = drag;
          setDrag(null);
          setHover(null);
          if (active) {
            if (active.isGroup) onMoveAbove(active.ids, null);
            else {
              onUngroup(active.ids);
              onMoveAbove(active.ids, null);
            }
          }
        }}
      />
    </div>
  );
}
