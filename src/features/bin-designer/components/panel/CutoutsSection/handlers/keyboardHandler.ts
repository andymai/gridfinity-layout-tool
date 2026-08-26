/**
 * Keyboard shortcut handler for the cutout editor.
 *
 * Handles: Delete, Escape, undo/redo, select-all, copy/paste/duplicate,
 * group/ungroup, rotate 90-degree, tab cycling, arrow nudge, and lock toggle.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { rotatePoint, flipSelectionHorizontal, flipSelectionVertical } from '../geometry';
import { selectionVisualBounds } from '../cutoutGroups';
import { unitTag } from '@/features/bin-designer/utils/cutoutHierarchy';
import type { InteractionMode } from '../useCutoutInteraction';
import { handleVertexEditKeyDown } from './pathEditHandler';
import type { VertexEditMode, SegmentHoverInfo } from './pathEditHandler';
import type { PathDrawingPreviewState } from './pathDrawingHandler';

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
  /**
   * Ctrl+Shift+D. Creates a repeat from a single selected cutout, or collapses
   * a detected pattern into one. Both readings of "make this repeat", so the
   * binding does not change meaning with the selection.
   */
  readonly makeRepeat?: () => void;
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
  readonly clearPathDrawingPreview: () => void;
  readonly setPathDrawingPreview: (preview: PathDrawingPreviewState | null) => void;
  readonly setMode: (mode: InteractionMode) => void;
  readonly setSegmentHover: (hover: SegmentHoverInfo | null) => void;
  readonly setSelection: (selection: ReadonlySet<string>) => void;
  /** Groups the editor is drilled into, outermost first. */
  readonly groupContext?: readonly string[];
  /** Step out one level; Escape walks back up the way double-click walked down. */
  readonly exitGroup?: () => void;
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

  // Path drawing mode: Escape to cancel, Ctrl+Z to undo last point
  if (ctx.mode.type === 'path-drawing') {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      const points = ctx.mode.points;
      if (points.length <= 1) {
        // No points left — cancel drawing entirely
        ctx.clearPathDrawingPreview();
        ctx.setMode({ type: 'idle' });
      } else {
        // Pop last point and continue drawing
        const remaining = points.slice(0, -1);
        ctx.setMode({ ...ctx.mode, points: remaining });
        const last = remaining[remaining.length - 1];
        ctx.setPathDrawingPreview({
          points: remaining,
          cursorX: last.x,
          cursorY: last.y,
          canClose: false,
        });
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      ctx.clearPathDrawingPreview();
      ctx.setMode({ type: 'idle' });
    }
    return;
  }

  // Vertex editing mode: delegate Delete/Backspace/Escape, handle undo/redo
  if (ctx.mode.type === 'vertex-editing') {
    const mod = e.metaKey || e.ctrlKey;
    // Undo/redo: exit vertex editing (stale UI) and delegate to store
    if (mod && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
      e.preventDefault();
      ctx.setMode({ type: 'idle' });
      if (e.key === 'y' || e.shiftKey) {
        ctx.onRedo?.();
      } else {
        ctx.onUndo?.();
      }
      return;
    }
    const cutout = ctx.cutouts.find((c) => c.id === (ctx.mode as VertexEditMode).cutoutId);
    if (cutout) {
      handleVertexEditKeyDown(e, ctx.mode, cutout, {
        setMode: ctx.setMode,
        setPreview: ctx.setPreview,
        onUpdate: ctx.onUpdate,
        setSegmentHover: ctx.setSegmentHover,
      });
    }
    return;
  }

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
        // Escape steps OUT one level before it clears anything, re-selecting
        // the unit that contains what was selected. Deselecting from three
        // levels deep would otherwise leave the editor drilled into a group
        // with nothing selected to show for it.
        const context = ctx.groupContext ?? [];
        if (context.length > 0 && ctx.exitGroup) {
          const outer = context.slice(0, -1);
          const anchor = ctx.cutouts.find((c) => ctx.selection.has(c.id));
          ctx.exitGroup();
          const tag = anchor ? unitTag(anchor, outer) : null;
          if (tag !== null) {
            ctx.setSelection(
              new Set(ctx.cutouts.filter((c) => unitTag(c, outer) === tag).map((c) => c.id))
            );
            break;
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
      } else {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'placing', shape: 'circle' });
      }
      break;
    case 'v':
      if (mod) {
        e.preventDefault();
        ctx.pasteFromClipboard();
      } else {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'idle' });
      }
      break;
    // Ctrl+D duplicates; Ctrl+Shift+D makes a repeat out of the selection.
    // One modifier apart from the habit it redirects.
    case 'd':
      if (mod) {
        e.preventDefault();
        if (e.shiftKey) ctx.makeRepeat?.();
        else ctx.duplicateSelected();
      }
      break;
    case 'D':
      if (mod && e.shiftKey) {
        e.preventDefault();
        ctx.makeRepeat?.();
      }
      break;

    // Ctrl+G group / Ctrl+Shift+G ungroup; bare G switches to polygon tool
    case 'g':
      if (mod) {
        e.preventDefault();
        if (e.shiftKey) {
          ctx.onUngroup?.([...ctx.selection]);
        } else if (ctx.selection.size >= 2) {
          ctx.onGroup?.([...ctx.selection]);
        }
      } else {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'placing', shape: 'polygon' });
      }
      break;
    case 'G':
      if (mod && e.shiftKey) {
        e.preventDefault();
        ctx.onUngroup?.([...ctx.selection]);
      }
      break;

    // R: rotate 90° when something is selected, or switch to rectangle tool
    case 'r':
      if (!mod) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (ctx.selection.size > 0) {
          handleRotate90(ctx);
        } else {
          ctx.setMode({ type: 'placing', shape: 'rectangle' });
        }
      }
      break;

    // P: switch to pen tool
    case 'p':
      if (!mod) {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'placing', shape: 'path' });
      }
      break;

    // S: switch to slot tool
    case 's':
      if (!mod) {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'placing', shape: 'slot' });
      }
      break;

    // K: switch to knife-slot tool
    case 'k':
      if (!mod) {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'placing', shape: 'knifeSlot' });
      }
      break;

    // T: switch to text tool
    case 't':
      if (!mod) {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'placing', shape: 'text' });
      }
      break;

    // M: switch to ruler/measure tool
    case 'm':
      if (!mod) {
        e.preventDefault();
        e.stopImmediatePropagation();
        ctx.setMode({ type: 'ruler-ready' });
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

    // Shift+H: flip horizontal (shiftKey guard prevents CapsLock trigger)
    case 'H':
      if (!mod && e.shiftKey && ctx.selection.size > 0) {
        e.preventDefault();
        handleFlipHorizontal(ctx);
      }
      break;

    // Shift+V: flip vertical (shiftKey guard prevents CapsLock trigger)
    case 'V':
      if (!mod && e.shiftKey && ctx.selection.size > 0) {
        e.preventDefault();
        handleFlipVertical(ctx);
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
    // Rigid group rotation: member centers travel clockwise (rotatePoint by
    // -90) to match the clockwise on-screen turn a +90 stored rotation gives.
    const selectedCutouts = ctx.cutouts.filter((c) => ctx.selection.has(c.id));
    const bounds = selectionVisualBounds(selectedCutouts);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const updates = new Map<string, Partial<Cutout>>();
    for (const cutout of selectedCutouts) {
      const cutCx = cutout.x + cutout.width / 2;
      const cutCy = cutout.y + cutout.depth / 2;
      const rotated = rotatePoint(cutCx, cutCy, cx, cy, -90);
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

function applyFlipUpdates(
  ctx: KeyboardHandlerContext,
  updates: ReadonlyMap<string, Partial<Cutout>>
): void {
  if (ctx.onUpdateBatch && updates.size > 1) {
    ctx.onUpdateBatch(updates);
  } else {
    for (const [id, patch] of updates) {
      ctx.onUpdate(id, patch);
    }
  }
}

function handleFlipHorizontal(ctx: KeyboardHandlerContext): void {
  if (ctx.cutouts.some((c) => ctx.selection.has(c.id) && c.locked)) return;
  const selected = ctx.cutouts.filter((c) => ctx.selection.has(c.id));
  applyFlipUpdates(ctx, flipSelectionHorizontal(selected));
}

function handleFlipVertical(ctx: KeyboardHandlerContext): void {
  if (ctx.cutouts.some((c) => ctx.selection.has(c.id) && c.locked)) return;
  const selected = ctx.cutouts.filter((c) => ctx.selection.has(c.id));
  applyFlipUpdates(ctx, flipSelectionVertical(selected));
}
