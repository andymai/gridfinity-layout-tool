/**
 * Freeform perimeter editor for the drawer shape (issue #3054).
 *
 * The cell-paint editor can only follow grid lines, so a drawer with a
 * moulding, a diagonal, or a curved front has no way in. This one edits the
 * outline directly: drag a corner, drag a segment to bow it into an arc,
 * double-click a segment to add a corner, and the sketch is graded live by the
 * same `validateOutline` the store commit uses, so Apply is only ever offered
 * for a shape that will actually be accepted.
 *
 * Everything is drawer-local mm; the SVG viewBox does the scaling, and the Y
 * axis is flipped in the transform so the canvas reads like the layout grid
 * (row 0 at the front) while the stored data stays Y-up.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Dialog, SegmentedControl, Stepper } from '@/design-system';
import { effectiveGridUnitMmY } from '@/core/types';
import type { OutlineVertex } from '@/core/types';
import { useLayoutStore, useToastStore } from '@/core/store';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { computeDisplacedBins } from '@/core/cqrs/v2/domain/drawer/displacement';
import { validateOutline } from '@/shared/utils/drawerOutline';
import { filletOutline } from '@/shared/utils/filletOutline';
import {
  bulgeThroughPoint,
  clampToDrawer,
  hitSegmentMidpoint,
  hitVertex,
  insertVertex,
  moveVertex,
  rectangleSketch,
  removeVertex,
  segmentHandle,
  setBulge,
  sketchPathD,
  sketchToOutline,
  snapMm,
  handleRadiusMm,
  hitRadiusMm,
  SNAP_FRACTIONS,
  type SnapFraction,
} from '../../utils/penShape';

interface PenShapeDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Padding around the drawer inside the viewBox, so edge handles stay grabbable. */
const VIEW_PAD_MM = 14;

type Drag =
  | { readonly kind: 'vertex'; readonly index: number }
  | { readonly kind: 'bulge'; readonly index: number };

export function PenShapeDialog({ open, onClose }: PenShapeDialogProps) {
  const t = useTranslation();
  const mutations = useMutations();
  const { layout, gridUnitMmY } = useLayoutStore(
    useShallow((s) => ({ layout: s.layout, gridUnitMmY: effectiveGridUnitMmY(s.layout) }))
  );
  const addToast = useToastStore((s) => s.addToast);

  const widthMm = layout.drawer.width * layout.gridUnitMm;
  const depthMm = layout.drawer.depth * gridUnitMmY;
  const handleR = handleRadiusMm(widthMm, depthMm);
  const hitR = hitRadiusMm(widthMm, depthMm);

  // Reseed only when the dialog opens: an existing outline becomes the starting
  // sketch (any authoring surface, so a painted shape can be refined freehand),
  // otherwise start from the drawer rectangle.
  const seeded = useMemo(() => {
    if (!open) return null;
    const existing = layout.drawer.outline;
    return existing !== undefined ? [...existing.vertices] : rectangleSketch(widthMm, depthMm);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on open
  }, [open]);

  const [sketch, setSketch] = useState<OutlineVertex[] | null>(null);
  const [snap, setSnap] = useState<SnapFraction>(0.5);
  const [selected, setSelected] = useState<number | null>(null);
  const [fillet, setFillet] = useState(0);
  const dragRef = useRef<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Memoized so the drag callbacks below keep a stable dependency; a bare
  // fallback chain would give them a new array identity every render.
  const verts = useMemo(() => sketch ?? seeded ?? [], [sketch, seeded]);

  const outline = useMemo(() => {
    if (verts.length < 3) return null;
    // Baked into the stored geometry rather than kept as a parameter, so every
    // consumer — plate, hatching, placement — sees the same rounded shape.
    return filletOutline(sketchToOutline(verts), fillet);
  }, [verts, fillet]);
  const error = useMemo(
    () =>
      outline === null
        ? 'too_few_vertices'
        : (validateOutline(outline, widthMm, depthMm, layout.gridUnitMm, gridUnitMmY)?.kind ??
          null),
    [outline, widthMm, depthMm, layout.gridUnitMm, gridUnitMmY]
  );

  /** Pointer position in drawer-local mm, undoing the flipped Y of the view. */
  const toMm = useCallback(
    (e: ReactPointerEvent): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (svg === null) return null;
      const rect = svg.getBoundingClientRect();
      const vw = widthMm + VIEW_PAD_MM * 2;
      const vh = depthMm + VIEW_PAD_MM * 2;
      const x = ((e.clientX - rect.left) / rect.width) * vw - VIEW_PAD_MM;
      const y = depthMm - (((e.clientY - rect.top) / rect.height) * vh - VIEW_PAD_MM);
      return { x, y };
    },
    [widthMm, depthMm]
  );

  const snapPoint = useCallback(
    (p: { x: number; y: number }) => {
      const c = clampToDrawer(p.x, p.y, widthMm, depthMm);
      return {
        x: snapMm(c.x, layout.gridUnitMm, snap),
        y: snapMm(c.y, gridUnitMmY, snap),
      };
    },
    [widthMm, depthMm, layout.gridUnitMm, gridUnitMmY, snap]
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const p = toMm(e);
      if (p === null) return;
      // Vertices win ties with segment handles: on a short segment the two
      // overlap, and moving a corner is the more common intent.
      const v = hitVertex(verts, p.x, p.y, hitR);
      if (v >= 0) {
        dragRef.current = { kind: 'vertex', index: v };
        setSelected(v);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      const seg = hitSegmentMidpoint(verts, p.x, p.y, hitR);
      if (seg >= 0) {
        dragRef.current = { kind: 'bulge', index: seg };
        setSelected(null);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [verts, toMm, hitR]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (drag === null) return;
      const p = toMm(e);
      if (p === null) return;
      if (drag.kind === 'vertex') {
        const s = snapPoint(p);
        setSketch((prev) => moveVertex(prev ?? verts, drag.index, s.x, s.y));
      } else {
        // Bulge is a curvature, not a position, so it is never snapped.
        const clamped = clampToDrawer(p.x, p.y, widthMm, depthMm);
        setSketch((prev) => {
          const base = prev ?? verts;
          return setBulge(
            base,
            drag.index,
            bulgeThroughPoint(base, drag.index, clamped.x, clamped.y)
          );
        });
      }
    },
    [toMm, snapPoint, verts, widthMm, depthMm]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  /** Double-click a segment to add a corner at its midpoint. */
  const handleDoubleClick = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const p = toMm(e);
      if (p === null) return;
      const seg = hitSegmentMidpoint(verts, p.x, p.y, hitR * 2);
      if (seg >= 0) {
        setSketch(insertVertex(verts, seg));
        setSelected(seg + 1);
      }
    },
    [verts, toMm, hitR]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selected === null) return;
    setSketch(removeVertex(verts, selected));
    setSelected(null);
  }, [selected, verts]);

  const maxFillet = Math.round(Math.min(widthMm, depthMm) / 4);
  const stepFillet = useCallback(
    (delta: number) => setFillet((r) => Math.min(maxFillet, Math.max(0, r + delta))),
    [maxFillet]
  );

  const handleReset = useCallback(() => {
    setSketch(rectangleSketch(widthMm, depthMm));
    setSelected(null);
    setFillet(0);
  }, [widthMm, depthMm]);

  const handleApply = useCallback(() => {
    if (outline === null || error !== null) return;
    const displaced = computeDisplacedBins(
      layout.bins,
      { ...layout.drawer, outline },
      layout.gridUnitMm,
      gridUnitMmY
    ).length;
    if (!isOk(mutations.setDrawerOutline(outline))) return;
    if (displaced > 0) {
      addToast(t('toast.binsDisplacedByShape', { count: displaced }), 'info');
    }
    setSketch(null);
    setFillet(0);
    onClose();
  }, [outline, error, layout, gridUnitMmY, mutations, addToast, t, onClose]);

  const handleClose = useCallback(() => {
    setSketch(null);
    setSelected(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const vw = widthMm + VIEW_PAD_MM * 2;
  const vh = depthMm + VIEW_PAD_MM * 2;

  return (
    <Dialog.Root open={open} onClose={handleClose} size="lg">
      <Dialog.Header title={t('drawerShape.penTitle')} />
      <Dialog.Body>
        <div className="space-y-3">
          <p className="text-xs text-content-tertiary">{t('drawerShape.penHint')}</p>

          <div className="rounded-md border border-stroke-subtle bg-surface-secondary p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${vw} ${vh}`}
              className="h-auto w-full touch-none select-none"
              style={{ aspectRatio: `${vw} / ${vh}` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDoubleClick={handleDoubleClick}
              role="application"
              aria-label={t('drawerShape.penCanvas')}
            >
              {/* Y-up data in a Y-down viewport: flip once here so the canvas
                reads like the layout grid without touching stored coordinates. */}
              <g transform={`translate(${VIEW_PAD_MM} ${depthMm + VIEW_PAD_MM}) scale(1 -1)`}>
                <rect
                  x={0}
                  y={0}
                  width={widthMm}
                  height={depthMm}
                  className="fill-surface stroke-stroke-subtle"
                  strokeWidth={handleR / 3}
                />
                <path
                  d={outline !== null ? sketchPathD(outline.vertices) : sketchPathD(verts)}
                  className={
                    error === null ? 'fill-accent/15 stroke-accent' : 'fill-error/10 stroke-error'
                  }
                  strokeWidth={handleR / 2}
                  strokeLinejoin="round"
                />
                {verts.map((_, i) => {
                  const h = segmentHandle(verts, i);
                  return (
                    <circle
                      key={`seg-${i}`}
                      cx={h.x}
                      cy={h.y}
                      r={handleR * 0.6}
                      className="fill-surface-elevated stroke-content-tertiary"
                      strokeWidth={handleR / 4}
                    />
                  );
                })}
                {verts.map((v, i) => (
                  <circle
                    key={`vert-${i}`}
                    cx={v.x}
                    cy={v.y}
                    r={handleR}
                    className={
                      selected === i ? 'fill-accent stroke-accent' : 'fill-surface stroke-accent'
                    }
                    strokeWidth={handleR / 3}
                  />
                ))}
              </g>
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-content-secondary">{t('drawerShape.penSnap')}</span>
              <SegmentedControl
                aria-label={t('drawerShape.penSnap')}
                size="sm"
                options={SNAP_FRACTIONS.map((f) => ({
                  value: String(f),
                  label: f === 0 ? t('drawerShape.penSnapOff') : `${f}u`,
                }))}
                value={String(snap)}
                onChange={(v) => setSnap(Number(v) as SnapFraction)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-content-secondary">{t('drawerShape.penFillet')}</span>
              <Stepper
                value={fillet}
                onChange={setFillet}
                onStep={stepFillet}
                min={0}
                max={maxFillet}
                step={1}
                size="sm"
                aria-label={t('drawerShape.penFillet')}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selected === null || verts.length <= 3}
              >
                {t('drawerShape.penDeletePoint')}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
                {t('drawerShape.penReset')}
              </Button>
            </div>
          </div>

          {error !== null && (
            <p role="alert" className="text-xs leading-relaxed text-error">
              {t(`drawerShape.penError.${error}`)}
            </p>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="secondary" onClick={handleClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="primary" onClick={handleApply} disabled={error !== null}>
          {t('drawerShape.editor.apply')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
