/**
 * Freeform perimeter editor for the drawer shape.
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
import { Button, Dialog } from '@/design-system';
import type { OutlineVertex } from '@/core/types';
import { effectiveGridUnitMmY, gridUnits } from '@/core/types';
import { PenCanvas } from './PenCanvas';
import { usePenSketch } from './usePenSketch';
import { usePenView, VIEW_PAD_MM } from './usePenView';
import { useOutlineImport } from './useOutlineImport';
import { PenImportNotice } from './PenImportNotice';
import { PenControls } from './PenControls';
import { loopBounds, unitsFor } from '../../utils/outlineImport';
import { useLayoutStore, useToastStore } from '@/core/store';
import { isOk } from '@/core/result';
import { CONSTRAINTS } from '@/core/constants';
import { batch } from '@/core/cqrs';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { computeDisplacedBins } from '@/core/cqrs/v2/domain/drawer/displacement';
import { trackDrawerShapeApplied } from '@/shared/analytics/posthog';
import { validateOutline } from '@/shared/utils/drawerOutline';
import { filletOutline, unfilletOutline } from '@/shared/utils/filletOutline';
import {
  bulgeThroughPoint,
  clampToDrawer,
  alignmentGuides,
  hitSegmentMidpoint,
  hitVertex,
  moveVertex,
  clampGroupDelta,
  moveVertices,
  verticesInRect,
  rectangleSketch,
  setBulge,
  sketchPathD,
  sketchToOutline,
  snapMm,
  handleRadiusMm,
  hitRadiusMm,
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
  | { readonly kind: 'pan'; readonly last: { x: number; y: number } }
  | {
      readonly kind: 'marquee';
      readonly from: { x: number; y: number };
      to: { x: number; y: number };
      readonly add: boolean;
    };

export function PenShapeDialog({ open, onClose }: PenShapeDialogProps) {
  const t = useTranslation();
  const mutations = useMutations();
  const { layout, gridUnitMmY } = useLayoutStore(
    useShallow((s) => ({ layout: s.layout, gridUnitMmY: effectiveGridUnitMmY(s.layout) }))
  );
  const addToast = useToastStore((s) => s.addToast);

  const widthMm = layout.drawer.width * layout.gridUnitMm;
  const depthMm = layout.drawer.depth * gridUnitMmY;
  const pitchX = layout.gridUnitMm;
  const pitchY = gridUnitMmY;
  // A point may be placed past the current grid extent, up to the product
  // ceiling; Apply grows the drawer to fit. Only the upper bound moves — points
  // stay in the >=0 quadrant.
  const maxWmm = CONSTRAINTS.GRID_MAX * pitchX;
  const maxDmm = CONSTRAINTS.GRID_MAX * pitchY;
  const baseHandleR = handleRadiusMm(widthMm, depthMm);

  // Reseed only when the dialog opens: an existing outline becomes the starting
  // sketch (any authoring surface, so a painted shape can be refined freehand),
  // otherwise start from the drawer rectangle. `unfilletOutline` collapses a
  // rounded corner back to a sharp one plus its radius, so a saved shape reopens
  // with its rounding still adjustable rather than as arcs made of extra points.
  const seeded = useMemo(() => {
    if (!open) return null;
    const existing = layout.drawer.outline;
    if (existing !== undefined) {
      const { vertices, radii } = unfilletOutline(existing);
      return { verts: vertices, radii };
    }
    const verts = rectangleSketch(widthMm, depthMm);
    return { verts, radii: verts.map(() => 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on open
  }, [open]);

  const [snap, setSnap] = useState<SnapFraction>(0.5);
  const dragRef = useRef<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sketch = usePenSketch(seeded);
  const { verts, radii, selected, setSelected } = sketch;

  const outline = useMemo(() => {
    if (verts.length < 3) return null;
    // Baked into the stored geometry rather than kept as a parameter, so every
    // consumer — plate, hatching, placement — sees the same rounded shape.
    //
    // Fillet BEFORE normalizing the winding: `sketchToOutline` reverses a
    // clockwise loop, which reorders vertices and would leave every radius
    // describing a different corner than the one it was set on. `cornerAt`'s
    // turn is signed, so an unnormalized loop still rounds on the correct side.
    return sketchToOutline(filletOutline({ vertices: [...verts] }, radii).vertices);
  }, [verts, radii]);

  // The flattened bbox (arcs expanded) is the geometry `validateOutline` grades
  // and the drawer must grow to hold, so a bowed edge past the grid counts too.
  const bounds = useMemo(() => (outline === null ? null : loopBounds(outline.vertices)), [outline]);
  const bboxMaxXMm = bounds === null ? widthMm : bounds.minX + bounds.widthMm;
  const bboxMaxYMm = bounds === null ? depthMm : bounds.minY + bounds.depthMm;
  // The frame covers the union of the grid rect and the sketch, so a handle
  // dragged past the grid stays visible and grabbable.
  const contentWidthMm = Math.max(widthMm, bboxMaxXMm);
  const contentDepthMm = Math.max(depthMm, bboxMaxYMm);

  // `seeded` is a fresh array per open, so it doubles as the session token.
  const view = usePenView(contentWidthMm, contentDepthMm, widthMm, depthMm, seeded);
  // Divided by the zoom so the grab area matches the drawn handle at any zoom.
  const hitR = hitRadiusMm(widthMm, depthMm) / view.zoom;
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null
  );
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const spaceRef = useRef(false);
  const nudgeBounds = useMemo(
    () => ({ widthMm: maxWmm, depthMm: maxDmm, pitchX, pitchY, snap }),
    [maxWmm, maxDmm, pitchX, pitchY, snap]
  );

  // Validate against the bounds the drawer WILL have after Apply grows it, so a
  // growable overflow does not trip the out-of-bounds rule and disable Apply.
  // Coords are clamped to <= GRID_MAX*pitch, so these stay representable and
  // there is no unreachable "too big" error to surface.
  const effWmm = Math.max(widthMm, unitsFor(bboxMaxXMm, pitchX) * pitchX);
  const effDmm = Math.max(depthMm, unitsFor(bboxMaxYMm, pitchY) * pitchY);
  const error = useMemo(
    () =>
      outline === null
        ? 'too_few_vertices'
        : (validateOutline(outline, effWmm, effDmm, pitchX, pitchY)?.kind ?? null),
    [outline, effWmm, effDmm, pitchX, pitchY]
  );

  /** Pointer position in drawer-local mm, undoing the padding and the flipped Y. */
  const toMm = useCallback(
    (e: ReactPointerEvent): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (svg === null) return null;
      const f = view.toFrame(e.clientX, e.clientY, svg.getBoundingClientRect());
      return { x: f.x - VIEW_PAD_MM, y: contentDepthMm - (f.y - VIEW_PAD_MM) };
    },
    [contentDepthMm, view]
  );

  const snapPoint = useCallback(
    (p: { x: number; y: number }) => {
      const c = clampToDrawer(p.x, p.y, maxWmm, maxDmm);
      return {
        x: snapMm(c.x, pitchX, snap),
        y: snapMm(c.y, pitchY, snap),
      };
    },
    [maxWmm, maxDmm, pitchX, pitchY, snap]
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const p = toMm(e);
      if (p === null) return;
      e.currentTarget.setPointerCapture(e.pointerId);

      // Pan is an explicit gesture (space, middle button or Alt), leaving a
      // plain background drag free for the marquee — the Figma mapping.
      if (spaceRef.current || e.button === 1 || e.altKey) {
        dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
        return;
      }

      // Vertices win ties with segment handles: on a short segment the two
      // overlap, and moving a corner is the more common intent.
      const v = hitVertex(verts, p.x, p.y, hitR);
      if (v >= 0) {
        if (e.shiftKey) sketch.toggleSelected(v);
        else if (!selected.has(v)) setSelected([v]);
        dragRef.current = { kind: 'vertex', index: v, from: { x: verts[v].x, y: verts[v].y } };
        sketch.beginGesture();
        return;
      }

      const seg = hitSegmentMidpoint(verts, p.x, p.y, hitR);
      if (seg >= 0) {
        dragRef.current = { kind: 'bulge', index: seg };
        setSelected([]);
        sketch.beginGesture();
        return;
      }

      if (!e.shiftKey) setSelected([]);
      dragRef.current = { kind: 'marquee', from: p, to: p, add: e.shiftKey };
      setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    },
    [verts, toMm, hitR, setSelected, selected, sketch]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (drag === null) return;

      if (drag.kind === 'pan') {
        const svg = svgRef.current;
        if (svg === null) return;
        const rect = svg.getBoundingClientRect();
        const scale = (contentWidthMm + VIEW_PAD_MM * 2) / view.zoom / rect.width;
        view.panBy((e.clientX - drag.last.x) * scale, (e.clientY - drag.last.y) * scale);
        dragRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
        return;
      }

      const p = toMm(e);
      if (p === null) return;

      if (drag.kind === 'marquee') {
        drag.to = p;
        setMarquee({ x0: drag.from.x, y0: drag.from.y, x1: p.x, y1: p.y });
        return;
      }

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
        // Every selected corner travels together, so a whole edge can be moved
        // by grabbing either end of it.
        const moving = selected.has(drag.index) ? selected : new Set([drag.index]);
        // Tolerance is in mm but should feel constant on screen, so it shrinks
        // as the view zooms in.
        const g = alignmentGuides(verts, moving, c, hitR);
        setGuides({ x: g.x, y: g.y });
        // The whole selection shares one delta, so it has to be clamped for
        // the group rather than for the grabbed corner alone.
        const { dx, dy } = clampGroupDelta(
          verts,
          moving,
          g.point.x - verts[drag.index].x,
          g.point.y - verts[drag.index].y,
          maxWmm,
          maxDmm
        );
        sketch.preview({ verts: moveVertices(verts, moving, dx, dy), radii });
        return;
      }

      // Bulge is a curvature, not a position, so it is never snapped.
      const clamped = clampToDrawer(p.x, p.y, maxWmm, maxDmm);
      sketch.preview({
        verts: setBulge(
          verts,
          drag.index,
          bulgeThroughPoint(verts, drag.index, clamped.x, clamped.y)
        ),
        radii,
      });
    },
    [toMm, snapPoint, verts, radii, maxWmm, maxDmm, contentWidthMm, sketch, view, selected, hitR]
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    // A press that selected without moving leaves no history entry behind.
    sketch.endGesture();
    setGuides({ x: null, y: null });
    setMarquee(null);
    if (drag?.kind !== 'marquee') return;
    const hit = verticesInRect(verts, drag.from.x, drag.from.y, drag.to.x, drag.to.y);
    // A click that never moved is a deselect, which pointer-down already did.
    if (hit.length === 0 && !drag.add) return;
    setSelected(drag.add ? [...selected, ...hit] : hit);
  }, [verts, selected, setSelected, sketch]);

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
        setSelected([sketch.insertAt(seg)]);
      }
    },
    [verts, toMm, hitR, setSelected, sketch]
  );

  const maxFillet = Math.round(Math.min(widthMm, depthMm) / 4);
  /** Corners the radius control edits: the selection, or the whole shape. */
  const filletTargets = useMemo(
    () => (selected.size > 0 ? [...selected] : radii.map((_, i) => i)),
    [selected, radii]
  );
  /**
   * Their shared radius, or null when they disagree. Compared with a tolerance
   * rather than exactly: radii recovered from a stored shape come off
   * coordinates already quantized to 0.01mm, so corners rounded together can
   * land a few hundredths apart and would otherwise report as mixed.
   */
  const filletValue = useMemo(() => {
    if (filletTargets.length === 0) return 0;
    const first = radii[filletTargets[0]] ?? 0;
    return filletTargets.every((i) => Math.abs((radii[i] ?? 0) - first) <= 0.05) ? first : null;
  }, [filletTargets, radii]);
  const applyFillet = useCallback(
    (r: number) => sketch.setRadii(filletTargets, Math.min(maxFillet, Math.max(0, r))),
    [sketch, filletTargets, maxFillet]
  );
  const stepFillet = useCallback(
    (delta: number) => applyFillet((filletValue ?? 0) + delta),
    [applyFillet, filletValue]
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
      if (key === ' ') {
        // Held space turns a background drag into a pan, as it does everywhere
        // else that has both a marquee and a pan on the same button.
        spaceRef.current = true;
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') {
        e.preventDefault();
        sketch.undo();
        return;
      }
      if (key === 'Escape') {
        setSelected([]);
        return;
      }
      // Select every corner, the usual companion to a marquee.
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(verts.map((_, i) => i));
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
    [sketch, setSelected, nudgeBounds, verts]
  );

  /** The one selected corner, or null when the selection is empty or multiple. */
  const loneIndex = selected.size === 1 ? [...selected][0] : null;
  // A stale index can outlive its vertex (a delete, or an import replacing the sketch).
  const lone = loneIndex !== null && loneIndex < verts.length ? loneIndex : null;

  /** Type an exact coordinate for the selected corner. */
  const setSelectedCoord = useCallback(
    (axis: 'x' | 'y', value: number) => {
      if (lone === null) return;
      const v = verts[lone];
      const p = clampToDrawer(
        axis === 'x' ? value : v.x,
        axis === 'y' ? value : v.y,
        maxWmm,
        maxDmm
      );
      sketch.commit({ verts: moveVertex(verts, lone, p.x, p.y), radii });
    },
    [lone, verts, radii, maxWmm, maxDmm, sketch]
  );

  const handleReset = useCallback(() => {
    sketch.reset(widthMm, depthMm);
  }, [widthMm, depthMm, sketch]);

  /** Imported geometry replaces the sketch through the history, so Undo works. */
  const handleImported = useCallback(
    (vertices: OutlineVertex[]) => {
      sketch.commit({ verts: vertices, radii: vertices.map(() => 0) });
      setSelected([]);
      view.reset();
    },
    [sketch, setSelected, view]
  );

  const handleGrowDrawer = useCallback(
    (w: number, d: number) => mutations.updateDrawer({ width: gridUnits(w), depth: gridUnits(d) }),
    [mutations]
  );

  const importer = useOutlineImport({
    drawerWidthMm: widthMm,
    drawerDepthMm: depthMm,
    gridUnitMm: layout.gridUnitMm,
    gridUnitMmY,
    onImported: handleImported,
    onGrowDrawer: handleGrowDrawer,
  });

  const handleApply = useCallback(() => {
    if (outline === null || error !== null) return;
    const displaced = computeDisplacedBins(
      layout.bins,
      { ...layout.drawer, outline },
      layout.baseplateParams,
      layout.gridUnitMm,
      gridUnitMmY
    ).length;
    // Grow the drawer to the smallest grid that holds the sketch. The command
    // bus is synchronous, so growing first lets setDrawerOutline validate
    // against the enlarged aggregate; batch() collapses the pair to one undo
    // step. When the sketch already fits, the single commit is kept.
    const growW = Math.max(layout.drawer.width, unitsFor(bboxMaxXMm, pitchX));
    const growD = Math.max(layout.drawer.depth, unitsFor(bboxMaxYMm, pitchY));
    const applied =
      growW > layout.drawer.width || growD > layout.drawer.depth
        ? batch(() => {
            mutations.updateDrawer({ width: gridUnits(growW), depth: gridUnits(growD) });
            return mutations.setDrawerOutline(outline);
          })
        : mutations.setDrawerOutline(outline);
    if (!isOk(applied)) return;
    // Read the post-commit store: a shape equivalent to the plain rectangle is
    // normalized to "no outline" by the mutation, so `cleared` has to reflect
    // what actually landed rather than what was sent.
    trackDrawerShapeApplied({
      editor: 'pen',
      displaced_bins: displaced,
      used_trace: false,
      cleared: useLayoutStore.getState().layout.drawer.outline === undefined,
    });
    if (displaced > 0) {
      addToast(t('toast.binsDisplacedByShape', { count: displaced }), 'info');
    }
    onClose();
  }, [
    outline,
    error,
    layout,
    gridUnitMmY,
    mutations,
    addToast,
    t,
    onClose,
    bboxMaxXMm,
    bboxMaxYMm,
    pitchX,
    pitchY,
  ]);

  if (!open) return null;

  // Drawn in mm, so divide by the zoom to keep handles a constant size on
  // screen — otherwise zooming in inflates them until they cover the shape.
  const handleR = baseHandleR / view.zoom;

  return (
    <Dialog.Root open={open} onClose={onClose} size="lg">
      <Dialog.Header title={t('drawerShape.penTitle')} />
      <Dialog.Body>
        <div className="space-y-3">
          <p className="text-xs text-content-tertiary">{t('drawerShape.penHint')}</p>

          {importer.oversize !== null && (
            <PenImportNotice prompt={importer.oversize} onResolve={importer.resolveOversize} />
          )}

          <div className="rounded-md border border-stroke-subtle bg-surface-secondary p-2">
            <PenCanvas
              svgRef={svgRef}
              verts={verts}
              radii={radii}
              selected={selected}
              pathD={outline !== null ? sketchPathD(outline.vertices) : sketchPathD(verts)}
              widthMm={widthMm}
              depthMm={depthMm}
              contentDepthMm={contentDepthMm}
              viewBox={view.viewBox}
              padMm={VIEW_PAD_MM}
              handleR={handleR}
              valid={error === null}
              guides={guides}
              marquee={marquee}
              ariaLabel={t('drawerShape.penCanvas')}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerEnd={endDrag}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              onKeyUp={(e) => {
                if (e.key === ' ') spaceRef.current = false;
              }}
              // Focus can leave while Space is held, and the keyup then never
              // reaches this element — leaving the canvas stuck in pan mode for
              // every later drag, including in a new session.
              onBlur={() => {
                spaceRef.current = false;
              }}
              onWheel={handleWheel}
            />
          </div>

          <PenControls
            snap={snap}
            onSnapChange={setSnap}
            lone={lone === null ? null : { index: lone, x: verts[lone].x, y: verts[lone].y }}
            maxWmm={maxWmm}
            maxDmm={maxDmm}
            onCoordChange={setSelectedCoord}
            selectedCount={selected.size}
            filletValue={filletValue}
            maxFillet={maxFillet}
            onFilletChange={applyFillet}
            onFilletStep={stepFillet}
            canDelete={selected.size > 0 && verts.length - selected.size >= 3}
            onDelete={sketch.deleteSelected}
            canUndo={sketch.canUndo}
            onUndo={sketch.undo}
            viewMoved={view.moved}
            onResetView={view.reset}
            onImport={importer.triggerImport}
            onReset={handleReset}
          />

          {error !== null && (
            <p role="alert" className="text-xs leading-relaxed text-error">
              {t(`drawerShape.penError.${error}`)}
            </p>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="primary" onClick={handleApply} disabled={error !== null}>
          {t('drawerShape.editor.apply')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
