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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * Drag reparent: move `ids` onto `targetId`'s group, forming a new group when
   * the target is loose, or out of any group when `targetId` is null.
   */
  readonly onReparent: (ids: readonly string[], targetId: string | null) => void;
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
  onReparent,
}: ShapeListProps) {
  const t = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<{ id: string; kind: DropKind } | null>(null);

  const nodes = useMemo(() => buildShapeList(cutouts), [cutouts]);

  /** Visible rows top to bottom — groups plus the members of expanded ones. */
  const visibleRows = useMemo(() => {
    const out: { id: string; ids: readonly string[] }[] = [];
    for (const node of nodes) {
      out.push({ id: node.id, ids: nodeIds(node) });
      if (node.kind === 'group' && !collapsed.has(node.id)) {
        for (const m of node.members) out.push({ id: m.id, ids: [m.id] });
      }
    }
    return out;
  }, [nodes, collapsed]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ?? visibleRows[0]?.id ?? null;

  const focusRow = useCallback((id: string) => {
    setActiveId(id);
    const el = listRef.current?.querySelector(`[data-row-id="${CSS.escape(id)}"] [data-shape-row]`);
    if (el instanceof HTMLElement) el.focus();
  }, []);

  /**
   * Arrow-key navigation, which the `listbox` role obliges. Without it the only
   * way through a long list is Tab, and each row holds three controls.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(e.key) || visibleRows.length === 0) return;
      e.preventDefault();
      const at = Math.max(
        0,
        visibleRows.findIndex((r) => r.id === active)
      );
      const next =
        e.key === 'ArrowDown'
          ? Math.min(at + 1, visibleRows.length - 1)
          : e.key === 'ArrowUp'
            ? Math.max(at - 1, 0)
            : e.key === 'Home'
              ? 0
              : visibleRows.length - 1;
      focusRow(visibleRows[next].id);
    },
    [visibleRows, active, focusRow]
  );

  // Selecting a shape on the canvas should reveal its row. Without this the
  // list silently disagrees with the canvas whenever the design outgrows the
  // panel, which is exactly when the list matters most.
  const firstSelected = nodes.length > 0 ? [...selection][0] : undefined;
  useEffect(() => {
    if (firstSelected === undefined) return;
    const row = listRef.current?.querySelector(`[data-row-id="${CSS.escape(firstSelected)}"]`);
    // Guarded: jsdom (and some embedded webviews) do not implement it.
    if (row instanceof HTMLElement && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [firstSelected]);

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
      // Anchoring on a member is enough — `reparentCutouts` resolves the
      // destination group from it and always lets the destination win.
      const anchor = node.kind === 'group' ? node.members[0]?.id : node.id;
      if (anchor) onReparent(active.ids, anchor);
    },
    [drag, onMoveAbove, onReparent]
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
      active: active === node.id,
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
      ref={listRef}
      role="listbox"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      aria-multiselectable
      aria-label={t('binDesigner.shapeList.tabShapes')}
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
        if (!active) return;
        // Same semantics as the dashed zone below, so the two adjacent
        // "drop at the bottom" targets can't disagree.
        if (!active.isGroup) onReparent(active.ids, null);
        onMoveAbove(active.ids, null);
      }}
    >
      <div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.shapeList.countLabel', { count: String(cutouts.length) })}
      </div>
      {nodes.map((node) => (
        <div
          key={node.id}
          data-row-id={node.id}
          onDragLeave={() => setHover((h) => (h?.id === node.id ? null : h))}
        >
          <ShapeListRow {...rowProps(node)} />
          {node.kind === 'group' && !collapsed.has(node.id) && (
            <div className="flex flex-col gap-px">
              {node.members.map((member) => (
                <div key={member.id} data-row-id={member.id}>
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
          if (!active) return;
          // Dragging a whole group to the bottom moves it intact. Dragging
          // loose rows there also pulls them out of any group — but only the
          // rows actually dragged, never other selected groups, which an
          // `onUngroup(active.ids)` over the whole selection used to dissolve.
          if (!active.isGroup) onReparent(active.ids, null);
          onMoveAbove(active.ids, null);
        }}
      />
    </div>
  );
}
