import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Dialog, Button } from '@/design-system';
import { useLayoutStore, useToastStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { isOk } from '@/core/result';
import { computeDisplacedBins } from '@/core/cqrs/v2/domain/drawer/displacement';
import { trackDrawerShapeApplied } from '@/shared/analytics/posthog';
import {
  buildFullDrawerMask,
  drawerMaskToOutline,
  outlineToDrawerMask,
  type DrawerMaskGrid,
} from '../../utils/drawerMask';
import { traceBinFootprint } from '../../utils/traceBinFootprint';

interface ShapeEditorDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Cell-paint editor for the drawer shape (issue #2528). Whole drawer cells
 * (plus the fractional-edge cell of an x.5 drawer) toggle in/out; drag paints
 * with the state of the first cell touched. One pointer handler on the
 * container — no per-cell listeners, so a 50×50 drawer stays cheap.
 */
export function ShapeEditorDialog({ open, onClose }: ShapeEditorDialogProps) {
  const t = useTranslation();
  const mutations = useMutations();
  const { layout } = useLayoutStore(useShallow((s) => ({ layout: s.layout })));
  const addToast = useToastStore((s) => s.addToast);

  const [grid, setGrid] = useState<DrawerMaskGrid | null>(null);
  const paintValueRef = useRef<0 | 1>(0);
  const paintingRef = useRef(false);
  const usedTraceRef = useRef(false);

  // Seed lazily each time the dialog opens: existing outline (rasterized) or
  // the full rectangle.
  const seeded = useMemo(() => {
    if (!open) return null;
    return layout.drawer.outline !== undefined
      ? outlineToDrawerMask(layout.drawer.outline, layout.drawer, layout.gridUnitMm)
      : buildFullDrawerMask(layout.drawer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on open
  }, [open]);
  const active = grid ?? seeded;

  const cellFromEvent = useCallback((e: PointerEvent<HTMLDivElement>): number | null => {
    const el = (e.target as HTMLElement).closest('[data-cell-index]');
    const raw = el?.getAttribute('data-cell-index');
    return raw === null || raw === undefined ? null : Number(raw);
  }, []);

  const applyPaint = useCallback(
    (index: number) => {
      setGrid((prev) => {
        const base = prev ?? seeded;
        if (base === null || base.cells[index] === paintValueRef.current) return prev;
        const cells = new Uint8Array(base.cells);
        cells[index] = paintValueRef.current;
        return { ...base, cells };
      });
    },
    [seeded]
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const index = cellFromEvent(e);
      if (index === null || active === null) return;
      paintValueRef.current = active.cells[index] === 1 ? 0 : 1;
      paintingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      applyPaint(index);
    },
    [active, applyPaint, cellFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!paintingRef.current) return;
      // With pointer capture, e.target stays the capture element — hit-test
      // the actual cell under the pointer instead.
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const el = under?.closest('[data-cell-index]');
      const raw = el?.getAttribute('data-cell-index');
      if (raw !== null && raw !== undefined) applyPaint(Number(raw));
    },
    [applyPaint]
  );

  const stopPainting = useCallback(() => {
    paintingRef.current = false;
  }, []);

  const conversion = useMemo(
    () => (active === null ? null : drawerMaskToOutline(active, layout.gridUnitMm as number)),
    [active, layout.gridUnitMm]
  );

  const handleTrace = useCallback(() => {
    usedTraceRef.current = true;
    setGrid(traceBinFootprint(layout));
  }, [layout]);

  const handleApply = useCallback(() => {
    if (conversion === null || !('outline' in conversion)) return;
    const displaced = computeDisplacedBins(
      layout.bins,
      { ...layout.drawer, outline: conversion.outline },
      layout.gridUnitMm
    ).length;
    const result = mutations.setDrawerOutline(conversion.outline);
    if (!isOk(result)) return;
    // A full-rectangle paint is normalized to "no outline" by the mutation
    // (isRectangleEquivalent) — read the post-commit store state so
    // `cleared` reflects what actually landed.
    trackDrawerShapeApplied({
      editor: 'cells',
      displaced_bins: displaced,
      used_trace: usedTraceRef.current,
      cleared: useLayoutStore.getState().layout.drawer.outline === undefined,
    });
    if (displaced > 0) {
      addToast(t('toast.binsDisplacedByShape', { count: displaced }), 'info');
    }
    setGrid(null);
    usedTraceRef.current = false;
    onClose();
  }, [conversion, layout, mutations, addToast, t, onClose]);

  const handleClose = useCallback(() => {
    setGrid(null);
    usedTraceRef.current = false;
    onClose();
  }, [onClose]);

  if (active === null) {
    return null;
  }

  const errorKey =
    conversion !== null && 'error' in conversion
      ? conversion.error === 'empty'
        ? 'drawerShape.editor.invalidEmpty'
        : 'drawerShape.editor.invalidDisconnected'
      : null;

  return (
    <Dialog.Root open={open} onClose={handleClose} size="md">
      <Dialog.Header title={t('drawerShape.editor.title')} />
      <Dialog.Body>
        <div className="space-y-3">
          <p className="text-xs text-content-secondary">{t('drawerShape.editor.hint')}</p>
          <div
            role="grid"
            aria-label={t('drawerShape.editor.gridAria')}
            className="mx-auto w-fit touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopPainting}
            onPointerCancel={stopPainting}
            style={{
              display: 'grid',
              gridTemplateColumns: active.cols.map((c) => `${c.size * 24}px`).join(' '),
              gridTemplateRows: [...active.rows]
                .reverse()
                .map((r) => `${r.size * 24}px`)
                .join(' '),
              gap: 2,
            }}
          >
            {/* Row 0 is the drawer FRONT (bottom of the grid) — render back rows first. */}
            {[...active.rows.keys()].reverse().flatMap((r) =>
              [...active.cols.keys()].map((c) => {
                const index = r * active.cols.length + c;
                const filled = active.cells[index] === 1;
                return (
                  <div
                    key={index}
                    data-cell-index={index}
                    role="gridcell"
                    aria-selected={filled}
                    className={
                      filled
                        ? 'rounded-sm bg-accent/70 ring-1 ring-accent'
                        : 'rounded-sm bg-surface-sunken ring-1 ring-stroke-subtle'
                    }
                  />
                );
              })
            )}
          </div>
          {errorKey !== null && <p className="text-xs text-status-error">{t(errorKey)}</p>}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={handleTrace} type="button">
          {t('drawerShape.trace')}
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" onClick={handleClose} type="button">
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleApply} disabled={errorKey !== null} type="button">
          {t('drawerShape.editor.apply')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
