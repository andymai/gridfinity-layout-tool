/**
 * State machine hook for cutout editor interactions.
 *
 * Manages placement, selection, dragging, resizing, and marquee states.
 * Keyboard shortcuts: Delete, Ctrl+A, arrows (nudge), Escape.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Cutout, CutoutShape } from '@/features/bin-designer/types';

/** Direction for resize handles */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type InteractionMode =
  | { readonly type: 'idle' }
  | { readonly type: 'placing'; readonly shape: CutoutShape }
  | { readonly type: 'dragging'; readonly startX: number; readonly startY: number }
  | { readonly type: 'resizing'; readonly cutoutId: string; readonly handle: ResizeHandle }
  | { readonly type: 'marquee'; readonly startX: number; readonly startY: number };

interface UseCutoutInteractionOptions {
  readonly cutouts: readonly Cutout[];
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onRemove: (id: string) => void;
  readonly binWidth: number;
  readonly binDepth: number;
}

const NUDGE_AMOUNT = 0.5;

export function useCutoutInteraction({
  cutouts,
  onUpdate,
  onRemove,
  binWidth,
  binDepth,
}: UseCutoutInteractionOptions) {
  const [mode, setMode] = useState<InteractionMode>({ type: 'idle' });
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const containerRef = useRef<SVGSVGElement | null>(null);

  const selectCutout = useCallback((id: string, additive: boolean) => {
    setSelection((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelection(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelection(new Set(cutouts.map((c) => c.id)));
  }, [cutouts]);

  const deleteSelected = useCallback(() => {
    for (const id of selection) {
      onRemove(id);
    }
    setSelection(new Set());
  }, [selection, onRemove]);

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      for (const id of selection) {
        const cutout = cutouts.find((c) => c.id === id);
        if (!cutout) continue;
        const effectiveD = cutout.shape === 'circle' ? cutout.width : cutout.depth;
        onUpdate(id, {
          x: Math.max(0, Math.min(cutout.x + dx, binWidth - cutout.width)),
          y: Math.max(0, Math.min(cutout.y + dy, binDepth - effectiveD)),
        });
      }
    },
    [selection, cutouts, onUpdate, binWidth, binDepth]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selection.size > 0) {
            e.preventDefault();
            deleteSelected();
          }
          break;
        case 'Escape':
          e.preventDefault();
          deselectAll();
          setMode({ type: 'idle' });
          break;
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            selectAll();
          }
          break;
        case 'ArrowLeft':
          if (selection.size > 0) {
            e.preventDefault();
            nudgeSelected(-NUDGE_AMOUNT, 0);
          }
          break;
        case 'ArrowRight':
          if (selection.size > 0) {
            e.preventDefault();
            nudgeSelected(NUDGE_AMOUNT, 0);
          }
          break;
        case 'ArrowUp':
          if (selection.size > 0) {
            e.preventDefault();
            // Increase model Y → shape moves up visually (SVG Y is inverted)
            nudgeSelected(0, NUDGE_AMOUNT);
          }
          break;
        case 'ArrowDown':
          if (selection.size > 0) {
            e.preventDefault();
            // Decrease model Y → shape moves down visually (SVG Y is inverted)
            nudgeSelected(0, -NUDGE_AMOUNT);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, deleteSelected, deselectAll, selectAll, nudgeSelected]);

  // Derive effective selection by pruning stale IDs (avoids setState in effect)
  const effectiveSelection = useMemo(() => {
    const cutoutIds = new Set(cutouts.map((c) => c.id));
    let hasStale = false;
    for (const id of selection) {
      if (!cutoutIds.has(id)) {
        hasStale = true;
        break;
      }
    }
    if (!hasStale) return selection;
    const cleaned = new Set<string>();
    for (const id of selection) {
      if (cutoutIds.has(id)) cleaned.add(id);
    }
    return cleaned as ReadonlySet<string>;
  }, [cutouts, selection]);

  return {
    mode,
    setMode,
    selection: effectiveSelection,
    selectCutout,
    deselectAll,
    selectAll,
    deleteSelected,
    containerRef,
  };
}
