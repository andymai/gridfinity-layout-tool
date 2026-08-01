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
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { usePenSketch } from './usePenSketch';
import { usePenView, VIEW_PAD_MM } from './usePenView';
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

type Drag =
  | {
      readonly kind: 'vertex';
      readonly index: number;
      /** Where the corner sat at pointer-down, the anchor Shift constrains to. */
      readonly from: { readonly x: number; readonly y: number };
    }
  | { readonly kind: 'bulge'; readonly index: number }
  | { readonly kind: 'pan'; readonly last: { x: number; y: number } };

export function PenShapeDialog({ open, onClose }: PenShapeDialogProps) {
  const t = useTranslation();
  const mutations = useMutations();
  const { layout, gridUnitMmY } = useLayoutStore(
    useShallow((s) => ({ layout: s.layout, gridUnitMmY: effectiveGridUnitMmY(s.layout) }))
  );
  const addToast = useToastStore((s) => s.addToast);

  const widthMm = layout.drawer.width * layout.gridUnitMm;
  const depthMm = layout.drawer.depth * gridUnitMmY;
  const baseHandleR = handleRadiusMm(widthMm, depthMm);

  // Reseed only when the dialog opens: an existing outline becomes the starting
  // sketch (any authoring surface, so a painted shape can be refined freehand),
  // otherwise start from the drawer rectangle.
  const seeded = useMemo(() => {
    if (!open) return null;
    const existing = layout.drawer.outline;
    return existing !== undefined ? [...existing.vertices] : rectangleSketch(widthMm, depthMm);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on open
  }, [open]);

  const [snap, setSnap] = useState<SnapFraction>(0.5);
  const [fillet, setFillet] = useState(0);
  const dragRef = useRef<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sketch = usePenSketch(seeded);
  const view = usePenView(widthMm, depthMm);
  // Divided by the zoom so the grab area matches the drawn handle at any zoom.
  const hitR = hitRadiusMm(widthMm, depthMm) / view.zoom;
  const { verts, selected, setSelected } = sketch;
  const nudgeBounds = useMemo(
    () => ({ widthMm, depthMm, pitchX: layout.gridUnitMm, pitchY: gridUnitMmY, snap }),
    [widthMm, depthMm, layout.gridUnitMm, gridUnitMmY, snap]
  );

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

  /** Pointer position in drawer-local mm, undoing the padding and the flipped Y. */
  const toMm = useCallback(
    (e: ReactPointerEvent): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (svg === null) return null;
      const f = view.toFrame(e.clientX, e.clientY, svg.getBoundingClientRect());
      return { x: f.x - VIEW_PAD_MM, y: depthMm - (f.y - VIEW_PAD_MM) };
    },
    [depthMm, view]
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
        dragRef.current = { kind: 'vertex', index: v, from: { x: verts[v].x, y: verts[v].y } };
        setSelected(v);
        sketch.beginGesture();
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      const seg = hitSegmentMidpoint(verts, p.x, p.y, hitR);
      if (seg >= 0) {
        dragRef.current = { kind: 'bulge', index: seg };
        setSelected(null);
        sketch.beginGesture();
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      // Nothing under the pointer: drag the view. There is no marquee here, so
      // empty space is free for the more useful gesture.
      setSelected(null);
      dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [verts, toMm, hitR, setSelected, sketch]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (drag === null) return;
      if (drag.kind === 'pan') {
        const svg = svgRef.current;
        if (svg === null) return;
        const rect = svg.getBoundingClientRect();
        const scale = (widthMm + VIEW_PAD_MM * 2) / view.zoom / rect.width;
        view.panBy((e.clientX - drag.last.x) * scale, (e.clientY - drag.last.y) * scale);
        dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
        return;
      }
      const p = toMm(e);
      if (p === null) return;
      if (drag.kind === 'vertex') {
        const s = snapPoint(p);
        // Shift locks to whichever axis has moved further from where the drag
        // began, so an edge can be dragged without drifting off square.
        const c =
          e.shiftKey && Math.abs(s.x - drag.from.x) < Math.abs(s.y - drag.from.y)
            ? { x: drag.from.x, y: s.y }
            : e.shiftKey
              ? { x: s.x, y: drag.from.y }
              : s;
        sketch.preview(moveVertex(verts, drag.index, c.x, c.y));
      } else {
        // Bulge is a curvature, not a position, so it is never snapped.
        const clamped = clampToDrawer(p.x, p.y, widthMm, depthMm);
        sketch.preview(
          setBulge(verts, drag.index, bulgeThroughPoint(verts, drag.index, clamped.x, clamped.y))
        );
      }
    },
    [toMm, snapPoint, verts, widthMm, depthMm, sketch, view]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (svg === null) return;
      e.preventDefault();
      view.zoomAt(e.deltaY, e.clientX, e.clientY, svg.getBoundingClientRect());
    },
    [view]
  );

  /** Double-click a segment to add a corner at its midpoint. */
  const handleDoubleClick = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const p = toMm(e);
      if (p === null) return;
      const seg = hitSegmentMidpoint(verts, p.x, p.y, hitR * 2);
      if (seg >= 0) {
        sketch.commit(insertVertex(verts, seg));
        setSelected(seg + 1);
      }
    },
    [verts, toMm, hitR, setSelected, sketch]
  );

  const maxFillet = Math.round(Math.min(widthMm, depthMm) / 4);
  const stepFillet = useCallback(
    (delta: number) => setFillet((r) => Math.min(maxFillet, Math.max(0, r + delta))),
    [maxFillet]
  );

  /**
   * Keyboard editing. The canvas is `role="application"`, which tells assistive
   * technology it handles its own keys, so it has to actually do so: arrows
   * nudge the selected corner by the active snap step (Shift for ten), Delete
   * removes it, Escape drops the selection, and Ctrl/Cmd+Z undoes.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      const key = e.key;
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') {
        e.preventDefault();
        sketch.undo();
        return;
      }
      if (key === 'Escape') {
        setSelected(null);
        return;
      }
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        sketch.deleteSelected();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const delta =
        key === 'ArrowLeft'
          ? [-step, 0]
          : key === 'ArrowRight'
            ? [step, 0]
            : // The canvas draws Y flipped, so Up must raise the stored Y.
              key === 'ArrowUp'
              ? [0, step]
              : key === 'ArrowDown'
                ? [0, -step]
                : null;
      if (delta === null) return;
      e.preventDefault();
      sketch.nudge(delta[0], delta[1], nudgeBounds);
    },
    [sketch, setSelected, nudgeBounds]
  );

  /** Type an exact coordinate for the selected corner. */
  const setSelectedCoord = useCallback(
    (axis: 'x' | 'y', value: number) => {
      if (selected === null) return;
      const v = verts[selected];
      const p = clampToDrawer(
        axis === 'x' ? value : v.x,
        axis === 'y' ? value : v.y,
        widthMm,
        depthMm
      );
      sketch.commit(moveVertex(verts, selected, p.x, p.y));
    },
    [selected, verts, widthMm, depthMm, sketch]
  );

  const handleReset = useCallback(() => {
    sketch.reset(widthMm, depthMm);
    setFillet(0);
  }, [widthMm, depthMm, sketch]);

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
    setFillet(0);
    onClose();
  }, [outline, error, layout, gridUnitMmY, mutations, addToast, t, onClose]);

  const handleClose = useCallback(() => {
    setFillet(0);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const vw = widthMm + VIEW_PAD_MM * 2;
  const vh = depthMm + VIEW_PAD_MM * 2;
  // Drawn in mm, so divide by the zoom to keep handles a constant size on
  // screen — otherwise zooming in inflates them until they cover the shape.
  const handleR = baseHandleR / view.zoom;

  return (
    <Dialog.Root open={open} onClose={handleClose} size="lg">
      <Dialog.Header title={t('drawerShape.penTitle')} />
      <Dialog.Body>
        <div className="space-y-3">
          <p className="text-xs text-content-tertiary">{t('drawerShape.penHint')}</p>

          <div className="rounded-md border border-stroke-subtle bg-surface-secondary p-2">
            <svg
              ref={svgRef}
              viewBox={view.viewBox}
              className="h-auto w-full cursor-crosshair touch-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ aspectRatio: `${vw} / ${vh}` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              tabIndex={0}
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
                      className="cursor-grab fill-surface-elevated stroke-content-tertiary"
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
            {selected !== null && selected < verts.length && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-content-secondary">
                  {t('drawerShape.penCorner', { n: selected + 1 })}
                </span>
                <CompactNumberInput
                  label="X"
                  value={verts[selected].x}
                  onChange={(v) => setSelectedCoord('x', v)}
                  min={0}
                  max={widthMm}
                  step={1}
                  unit="mm"
                />
                <CompactNumberInput
                  label="Y"
                  value={verts[selected].y}
                  onChange={(v) => setSelectedCoord('y', v)}
                  min={0}
                  max={depthMm}
                  step={1}
                  unit="mm"
                />
              </div>
            )}
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
                onClick={sketch.deleteSelected}
                disabled={selected === null || verts.length <= 3}
              >
                {t('drawerShape.penDeletePoint')}
              </Button>
              {view.moved && (
                <Button type="button" variant="secondary" size="sm" onClick={view.reset}>
                  {t('drawerShape.penResetView')}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={sketch.undo}
                disabled={!sketch.canUndo}
              >
                {t('common.undo')}
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
