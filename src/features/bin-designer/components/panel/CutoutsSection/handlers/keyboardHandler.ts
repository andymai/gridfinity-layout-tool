/**
 * Keyboard shortcut handler for the cutout editor.
 *
 * Handles: Delete, Escape, undo/redo, select-all, copy/paste/duplicate,
 * group/ungroup, rotate 90-degree, tab cycling, arrow nudge, and lock toggle.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { computeBounds, rotatePoint } from '../geometry';
import type { InteractionMode } from '../useCutoutInteraction';

const NUDGE_AMOUNT = 0.5;
const SHIFT_NUDGE_AMOUNT = 5;

/** All the callbacks and state the keyboard handler needs. */
export interface KeyboardHandlerContext {
  readonly selection: ReadonlySet<string>;
  readonly cutouts: readonly Cutout[];
  readonly mode: InteractionMode;
  readonly deleteSelected: () => void;
  readonly deselectAll: () => void;
  readonly selectAll: () => void;
  readonly nudgeSelected: (dx: number, dy: number) => void;
  readonly copySelected: () => void;
  readonly pasteFromClipboard: () => void;
  readonly duplicateSelected: () => void;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly onGroup?: (cutoutIds: readonly string[]) => void;
  readonly onUngroup?: (cutoutIds: readonly string[]) => void;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onUpdateBatch?: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly onLock?: (ids: readonly string[]) => void;
  readonly onUnlock?: (ids: readonly string[]) => void;
  readonly setPreview: (preview: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly clearActiveGuides: () => void;
  readonly clearDrawingPreview: () => void;
  readonly setMode: (mode: InteractionMode) => void;
  readonly setSelection: (selection: ReadonlySet<string>) => void;
}

/**
 * Handle a keydown event in the cutout editor.
 *
 * Inspects the keyboard event and, when it matches a supported shortcut,
 * updates the cutouts and calls `preventDefault` on the event directly.
 */
export function handleCutoutKeyDown(e: KeyboardEvent, ctx: KeyboardHandlerContext): void {
  // Don't capture when typing in an input
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

  const mod = e.metaKey || e.ctrlKey;

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      if (ctx.selection.size > 0) {
        e.preventDefault();
        ctx.deleteSelected();
      }
      break;

    case 'Escape':
      e.preventDefault();
      // Cancel in-progress drag/resize/rotate/drawing without committing
      ctx.setPreview(new Map());
      ctx.clearActiveGuides();
      ctx.clearDrawingPreview();
      if (ctx.mode.type === 'idle') {
        // Two-stage: if inside a group (single member selected), first re-select whole group
        if (ctx.selection.size === 1) {
          const selectedId = [...ctx.selection][0];
          const cutout = ctx.cutouts.find((c) => c.id === selectedId);
          if (cutout?.groupId) {
            const groupIds = ctx.cutouts
              .filter((c) => c.groupId === cutout.groupId)
              .map((c) => c.id);
            if (groupIds.length > 1) {
              ctx.setSelection(new Set(groupIds));
              break;
            }
          }
        }
        ctx.deselectAll();
      }
      ctx.setMode({ type: 'idle' });
      break;

    // Undo/redo
    case 'z':
      if (mod) {
        e.preventDefault();
        if (e.shiftKey) {
          ctx.onRedo?.();
        } else {
          ctx.onUndo?.();
        }
      }
      break;
    case 'Z':
      if (mod && e.shiftKey) {
        e.preventDefault();
        ctx.onRedo?.();
      }
      break;
    case 'y':
      if (mod) {
        e.preventDefault();
        ctx.onRedo?.();
      }
      break;

    case 'a':
      if (mod) {
        e.preventDefault();
        ctx.selectAll();
      }
      break;
    case 'c':
      if (mod) {
        e.preventDefault();
        ctx.copySelected();
      }
      break;
    case 'v':
      if (mod) {
        e.preventDefault();
        ctx.pasteFromClipboard();
      }
      break;
    case 'd':
      if (mod) {
        e.preventDefault();
        ctx.duplicateSelected();
      }
      break;

    // Ctrl+G group / Ctrl+Shift+G ungroup
    case 'g':
      if (mod) {
        e.preventDefault();
        if (e.shiftKey) {
          ctx.onUngroup?.([...ctx.selection]);
        } else if (ctx.selection.size >= 2) {
          ctx.onGroup?.([...ctx.selection]);
        }
      }
      break;
    case 'G':
      if (mod && e.shiftKey) {
        e.preventDefault();
        ctx.onUngroup?.([...ctx.selection]);
      }
      break;

    // R to rotate 90 degrees
    case 'r':
      if (!mod && ctx.selection.size > 0) {
        e.preventDefault();
        handleRotate90(ctx);
      }
      break;

    // Tab / Shift+Tab to cycle selection
    case 'Tab':
      if (ctx.cutouts.length > 0) {
        e.preventDefault();
        handleTabCycle(e, ctx);
      }
      break;

    case 'ArrowLeft':
      if (ctx.selection.size > 0) {
        e.preventDefault();
        const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
        ctx.nudgeSelected(-amount, 0);
      }
      break;
    case 'ArrowRight':
      if (ctx.selection.size > 0) {
        e.preventDefault();
        const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
        ctx.nudgeSelected(amount, 0);
      }
      break;
    case 'ArrowUp':
      if (ctx.selection.size > 0) {
        e.preventDefault();
        const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
        ctx.nudgeSelected(0, amount);
      }
      break;
    case 'ArrowDown':
      if (ctx.selection.size > 0) {
        e.preventDefault();
        const amount = e.shiftKey ? SHIFT_NUDGE_AMOUNT : NUDGE_AMOUNT;
        ctx.nudgeSelected(0, -amount);
      }
      break;

    // Ctrl+L to toggle lock
    case 'l':
      if (mod && ctx.selection.size > 0) {
        e.preventDefault();
        const selectedCutouts = ctx.cutouts.filter((c) => ctx.selection.has(c.id));
        const allLocked = selectedCutouts.every((c) => c.locked);
        if (allLocked) {
          ctx.onUnlock?.([...ctx.selection]);
        } else {
          ctx.onLock?.([...ctx.selection]);
        }
      }
      break;
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

function handleRotate90(ctx: KeyboardHandlerContext): void {
  // Block rotation if any selected cutout is locked
  if (ctx.cutouts.some((c) => ctx.selection.has(c.id) && c.locked)) return;

  if (ctx.onUpdateBatch && ctx.selection.size > 1) {
    // Group rotation: rotate each cutout's position around the group center
    const selectedCutouts = ctx.cutouts.filter((c) => ctx.selection.has(c.id));
    const bounds = computeBounds(selectedCutouts);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const updates = new Map<string, Partial<Cutout>>();
    for (const cutout of selectedCutouts) {
      const cutCx = cutout.x + cutout.width / 2;
      const cutCy = cutout.y + cutout.depth / 2;
      const rotated = rotatePoint(cutCx, cutCy, cx, cy, 90);
      updates.set(cutout.id, {
        x: rotated.x - cutout.width / 2,
        y: rotated.y - cutout.depth / 2,
        rotation: (cutout.rotation + 90) % 360,
      });
    }
    ctx.onUpdateBatch(updates);
  } else {
    for (const id of ctx.selection) {
      const cutout = ctx.cutouts.find((c) => c.id === id);
      if (!cutout) continue;
      ctx.onUpdate(id, { rotation: (cutout.rotation + 90) % 360 });
    }
  }
}

function handleTabCycle(e: KeyboardEvent, ctx: KeyboardHandlerContext): void {
  const ids = ctx.cutouts.map((c) => c.id);
  const currentIdx = ctx.selection.size === 1 ? ids.indexOf([...ctx.selection][0]) : -1;
  const nextIdx = e.shiftKey
    ? currentIdx <= 0
      ? ids.length - 1
      : currentIdx - 1
    : (currentIdx + 1) % ids.length;
  ctx.setSelection(new Set([ids[nextIdx]]));
}
