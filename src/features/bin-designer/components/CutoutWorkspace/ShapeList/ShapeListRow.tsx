/**
 * One row of the cutout shape list (issue #3053).
 *
 * Renders either a shape or a group parent. Groups act on every member, which
 * matches how grouped cutouts already behave elsewhere (color and groupOp are
 * written to the whole group), so the list doesn't invent a second model.
 *
 * Drag exposes two drop targets per row: the row body reparents into a group,
 * the thin strip along the top edge reorders above it. Keeping them separate is
 * what makes "drop between" reachable without a modifier key.
 */

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { Cutout } from '@/features/bin-designer/types';
import {
  derivedLabel,
  nodeIds,
  type ShapeListNode,
} from '@/features/bin-designer/components/panel/CutoutsSection/shapeListModel';

export type DropKind = 'above' | 'into';

interface ShapeListRowProps {
  readonly node: ShapeListNode;
  readonly selected: boolean;
  readonly partial: boolean;
  readonly expanded: boolean;
  readonly onToggleExpanded: (id: string) => void;
  readonly onSelect: (ids: readonly string[], additive: boolean) => void;
  readonly onToggleLock: (ids: readonly string[], locked: boolean) => void;
  readonly onToggleHidden: (ids: readonly string[], hidden: boolean) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDragStart: (node: ShapeListNode) => void;
  readonly onDrop: (node: ShapeListNode, kind: DropKind) => void;
  readonly onDragEnd: () => void;
  /** Highlight state driven by the parent while a drag is in flight. */
  readonly dropHint: DropKind | null;
}

const ROW = 'group flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[11px]';

function EyeIcon({ off }: { readonly off: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      {off && <path strokeWidth={2} strokeLinecap="round" d="M3 3l18 18" />}
    </svg>
  );
}

function LockIcon({ locked }: { readonly locked: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth={2} />
      <path
        strokeWidth={2}
        strokeLinecap="round"
        d={locked ? 'M8 11V7a4 4 0 018 0v4' : 'M8 11V7a4 4 0 017-2.6'}
      />
    </svg>
  );
}

export function ShapeListRow({
  node,
  selected,
  partial,
  expanded,
  onToggleExpanded,
  onSelect,
  onToggleLock,
  onToggleHidden,
  onRename,
  onDragStart,
  onDrop,
  onDragEnd,
  dropHint,
}: ShapeListRowProps) {
  const t = useTranslation();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on entry without `autoFocus`, which the a11y lint rejects for
  // reducing control over where focus lands.
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);
  const isGroup = node.kind === 'group';
  const ids = nodeIds(node);

  const cutout: Cutout | null = node.kind === 'shape' ? node.cutout : null;
  const locked = isGroup ? node.locked : cutout?.locked === true;
  const hidden = isGroup ? node.hidden : cutout?.hidden === true;

  const label = isGroup
    ? t('binDesigner.shapeList.group', { count: String(node.members.length) })
    : cutout?.name?.trim()
      ? cutout.name
      : (() => {
          const d = derivedLabel(cutout as Cutout);
          return t(d.key, d.values);
        })();

  const commitRename = (value: string): void => {
    setEditing(false);
    if (cutout && value.trim() !== (cutout.name ?? '')) onRename(cutout.id, value.trim());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commitRename(e.currentTarget.value);
    if (e.key === 'Escape') setEditing(false);
  };

  const allowDrop = (e: DragEvent): void => e.preventDefault();

  return (
    <div className="relative" onDragEnd={onDragEnd}>
      {/* Reorder strip: a drop here places the dragged rows above this one. */}
      <div
        className={`absolute inset-x-0 -top-0.5 z-10 h-1.5 ${
          dropHint === 'above' ? 'bg-accent' : ''
        }`}
        onDragOver={allowDrop}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop(node, 'above');
        }}
      />
      <div
        draggable
        onDragStart={() => onDragStart(node)}
        onDragOver={allowDrop}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(node, 'into');
        }}
        className={`${ROW} ${node.kind === 'shape' && node.nested ? 'pl-5' : ''} ${
          selected
            ? 'bg-accent/20 text-content'
            : partial
              ? 'bg-accent/10 text-content-secondary'
              : 'text-content-secondary hover:bg-surface-hover'
        } ${dropHint === 'into' ? 'ring-1 ring-accent' : ''} ${hidden ? 'opacity-50' : ''}`}
      >
        {isGroup ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onToggleExpanded(node.id)}
            aria-expanded={expanded}
            aria-label={t(
              expanded ? 'binDesigner.shapeList.collapseGroup' : 'binDesigner.shapeList.expandGroup'
            )}
            className="px-0.5 py-0 text-content-tertiary"
          >
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? '' : '-rotate-90'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeWidth={2} strokeLinecap="round" d="M6 9l6 6 6-6" />
            </svg>
          </Button>
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {editing && cutout ? (
          <input
            ref={inputRef}
            defaultValue={cutout.name ?? ''}
            placeholder={t('binDesigner.shapeList.renamePlaceholder')}
            aria-label={t('binDesigner.shapeList.rename')}
            onBlur={(e) => commitRename(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 rounded bg-surface px-1 text-[11px] text-content outline-none ring-1 ring-accent"
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={(e) => onSelect(ids, e.shiftKey || e.metaKey || e.ctrlKey)}
            onDoubleClick={() => cutout && setEditing(true)}
            className="min-w-0 flex-1 justify-start truncate px-0.5 py-0 text-left text-[11px] font-normal"
            title={label}
          >
            <span className="truncate">{label}</span>
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={() => onToggleHidden(ids, !hidden)}
          aria-pressed={hidden}
          aria-label={t(hidden ? 'binDesigner.shapeList.show' : 'binDesigner.shapeList.hide')}
          title={t(hidden ? 'binDesigner.shapeList.show' : 'binDesigner.shapeList.hide')}
          className={`px-0.5 py-0 ${hidden ? 'text-content' : 'text-content-tertiary opacity-0 group-hover:opacity-100'}`}
        >
          <EyeIcon off={hidden} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onToggleLock(ids, !locked)}
          aria-pressed={locked}
          aria-label={t(locked ? 'binDesigner.shapeList.unlock' : 'binDesigner.shapeList.lock')}
          title={t(locked ? 'binDesigner.shapeList.unlock' : 'binDesigner.shapeList.lock')}
          className={`px-0.5 py-0 ${locked ? 'text-content' : 'text-content-tertiary opacity-0 group-hover:opacity-100'}`}
        >
          <LockIcon locked={locked} />
        </Button>
      </div>
    </div>
  );
}
