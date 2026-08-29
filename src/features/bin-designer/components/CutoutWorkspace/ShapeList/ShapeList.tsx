/**
 * Cutout shape list.
 *
 * A layers panel for the cut editor: every shape as a row, groups as
 * expandable parents, ordered topmost-first so the list reads the way the
 * canvas looks. Exists because overlapping shapes are hard to select on the
 * canvas — clicking a row is unambiguous where clicking the drawing is not.
 *
 * Drag has two drop targets per row: the strip along a row's top edge reorders
 * above it, the row body drops into a group. A group row may be dropped into
 * another group — that is what nesting is — but never into a BOOLEAN group,
 * whose members are exactly what its op fuses (the store refuses, and the hint
 * never offers it).
 *
 * Drags are expressed as `unitTag`s rather than cutout ids: the members of a
 * dragged group and a handful of loose shapes that share a parent are the same
 * flat id list, yet one has to keep its own group on landing and the other must
 * not gain one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import type { Cutout } from '@/features/bin-designer/types';
import {
  allSelected,
  buildShapeList,
  flattenNodes,
  nodeIds,
  partiallySelected,
  type ShapeListNode,
} from '@/features/bin-designer/components/panel/CutoutsSection/shapeListModel';
import { ShapeListRow, type DropKind } from './ShapeListRow';

import { groupTag, sameChain, shapeTag } from '@/features/bin-designer/utils/cutoutHierarchy';

/** The unit a row moves as, in the form the store's `moveUnitsIntoGroup` takes. */
function rowTag(node: ShapeListNode): string {
  return node.kind === 'group' ? groupTag(node.groupId) : shapeTag(node.id);
}

/** Stable identity so the tree memo holds when no group has been named. */
const EMPTY_GROUP_NAMES: Readonly<Record<string, string>> = {};

export interface ShapeListProps {
  readonly cutouts: readonly Cutout[];
  /** Display names by group id; groups absent from it use a derived label. */
  readonly groupNames?: Readonly<Record<string, string>>;
  readonly selection: ReadonlySet<string>;
  /**
   * Select a row. `context` is the branch the row lives in, so the canvas and
   * the arrange math resolve the same units the list just showed — clicking a
   * nested row otherwise selects it while everything else still treats its
   * outermost ancestor as the thing being moved.
   */
  readonly onSelect: (
    ids: readonly string[],
    additive: boolean,
    context: readonly string[]
  ) => void;
  readonly onSetProperty: (
    ids: readonly string[],
    partial: Partial<Pick<Cutout, 'locked' | 'hidden' | 'name'>>
  ) => void;
  /** Drag reorder: move `ids` above `targetId`, or to the bottom when null. */
  readonly onMoveAbove: (ids: readonly string[], targetId: string | null) => void;
  /**
   * Drag reparent onto a SHAPE row: move `ids` onto that cutout's group,
   * forming a new boolean group when the target is loose.
   */
  readonly onReparent: (ids: readonly string[], targetId: string | null) => void;
  /** Drag whole units into a group, or to the top level when null. */
  readonly onMoveUnits: (tags: readonly string[], destGroupId: string | null) => void;
  /** Rename a group; an empty name restores the derived label. */
  readonly onRenameGroup: (groupId: string, name: string) => void;
}

interface DragState {
  readonly ids: readonly string[];
  readonly tags: readonly string[];
  readonly hasGroup: boolean;
}

export function ShapeList({
  cutouts,
  groupNames = EMPTY_GROUP_NAMES,
  selection,
  onSelect,
  onSetProperty,
  onMoveAbove,
  onReparent,
  onMoveUnits,
  onRenameGroup,
}: ShapeListProps) {
  const t = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<{ id: string; kind: DropKind } | null>(null);

  const nodes = useMemo(() => buildShapeList(cutouts, groupNames), [cutouts, groupNames]);

  /** Visible rows top to bottom — a collapsed group hides its whole subtree. */
  const visibleRows = useMemo(() => {
    const out: { id: string; ids: readonly string[] }[] = [];
    const walk = (list: readonly ShapeListNode[]): void => {
      for (const node of list) {
        out.push({ id: node.id, ids: nodeIds(node) });
        if (node.kind === 'group' && !collapsed.has(node.id)) walk(node.children);
      }
    };
    walk(nodes);
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
      // Dragging a selected row brings its selected SIBLINGS along — rows at the
      // same level of the tree. Sweeping the whole selection instead would drag
      // rows from other branches into a destination the user never pointed at,
      // and rows nested under a dragged group would be moved twice.
      const ids = nodeIds(node);
      const inSelection = ids.length > 0 && ids.every((id) => selection.has(id));
      const siblings =
        inSelection && selection.size > 0
          ? flattenNodes(nodes).filter(
              (n) =>
                sameChain(n.context, node.context) && nodeIds(n).every((id) => selection.has(id))
            )
          : [node];
      // `siblings` always contains `node` itself, but fall back rather than
      // trusting that from inside a filter.
      const moving = siblings.length > 0 ? siblings : [node];
      setDrag({
        ids: moving.flatMap((n) => nodeIds(n)),
        tags: moving.map(rowTag),
        hasGroup: moving.some((n) => n.kind === 'group'),
      });
    },
    [selection, nodes]
  );

  const handleDragEnd = useCallback(() => {
    setDrag(null);
    setHover(null);
  }, []);

  /**
   * Land at the bottom of the list, which is the top level: whole units move
   * out of whatever contained them, a dragged group arriving intact.
   *
   * Shared by the two adjacent "drop at the bottom" targets — the dashed zone
   * and the empty space around it — so they cannot disagree.
   */
  const handleDropToBottom = useCallback(() => {
    const active = drag;
    setDrag(null);
    setHover(null);
    if (!active) return;
    onMoveUnits(active.tags, null);
    onMoveAbove(active.ids, null);
  }, [drag, onMoveUnits, onMoveAbove]);

  /** Whether an in-flight drag may land inside this row. */
  const canDropInto = (node: ShapeListNode, active: DragState | null): boolean => {
    if (!active) return false;
    if (nodeIds(node).some((id) => active.ids.includes(id))) return false;
    // Pairing with a loose shape means forming a boolean group with it, which a
    // dragged group would have to dissolve to join.
    if (node.kind === 'shape') return !active.hasGroup;
    // A boolean group's members are exactly its operands; only shapes may join.
    if (node.groupKind === 'boolean' && active.hasGroup) return false;
    // Landing a group inside itself would detach that branch from the tree.
    return !active.tags.includes(groupTag(node.groupId));
  };

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
        const target = node.kind === 'group' ? (node.cutouts[0]?.id ?? null) : node.id;
        onMoveAbove(active.ids, target);
        return;
      }

      // Same predicate the hover hint uses, so a drop the row refused to
      // highlight can never still land through a fast release.
      if (!canDropInto(node, active)) return;

      // Into a GROUP row: move whole units, so a dragged subgroup arrives with
      // its own boolean intact.
      if (node.kind === 'group') {
        onMoveUnits(active.tags, node.groupId);
        return;
      }

      // Into a SHAPE row: join that cutout's group, or pair with it.
      onReparent(active.ids, node.id);
    },
    [drag, onMoveAbove, onReparent, onMoveUnits]
  );

  const rowProps = (node: ShapeListNode) => {
    const ids = nodeIds(node);
    return {
      node,
      selected: allSelected(ids, selection),
      partial: partiallySelected(ids, selection),
      expanded: !collapsed.has(node.id),
      onToggleExpanded: toggleExpanded,
      onSelect: (ids2: readonly string[], additive: boolean) =>
        onSelect(ids2, additive, node.context),
      onToggleLock: (targets: readonly string[], locked: boolean) =>
        onSetProperty(targets, { locked }),
      onToggleHidden: (targets: readonly string[], hidden: boolean) =>
        onSetProperty(targets, { hidden }),
      onRename: (target: ShapeListNode, name: string) => {
        if (target.kind === 'group') onRenameGroup(target.groupId, name);
        else onSetProperty([target.id], { name: name === '' ? undefined : name });
      },
      onDragStart: handleDragStart,
      onDragOverKind: (n: ShapeListNode, kind: DropKind) => {
        if (kind === 'into' && !canDropInto(n, drag)) {
          setHover((h) => (h?.id === n.id ? null : h));
          return;
        }
        setHover((h) => (h?.id === n.id && h.kind === kind ? h : { id: n.id, kind }));
      },
      onDrop: handleDrop,
      onDragEnd: handleDragEnd,
      dropHint: hover?.id === node.id ? hover.kind : null,
      active: active === node.id,
    };
  };

  /**
   * Rows top to bottom. Recursive rather than a flattened list so a collapsed
   * group takes its whole subtree with it in one step.
   */
  const renderRows = (list: readonly ShapeListNode[]): React.ReactNode =>
    list.map((node) => (
      <div
        key={node.id}
        data-row-id={node.id}
        onDragLeave={() => setHover((h) => (h?.id === node.id ? null : h))}
      >
        <ShapeListRow {...rowProps(node)} />
        {node.kind === 'group' && !collapsed.has(node.id) && (
          <div className="flex flex-col gap-px">{renderRows(node.children)}</div>
        )}
      </div>
    ));

  if (nodes.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-label text-content-tertiary">
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
        handleDropToBottom();
      }}
    >
      <div className="px-1 pb-1 text-micro uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.shapeList.countLabel', { count: String(cutouts.length) })}
      </div>
      {renderRows(nodes)}
      {/* Explicit drop zone so "send to the bottom" has a target even when the
          list fills the panel. */}
      <div
        className={`mt-1 h-6 rounded border border-dashed ${
          drag ? 'border-stroke-subtle' : 'border-transparent'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleDropToBottom();
        }}
      />
    </div>
  );
}
