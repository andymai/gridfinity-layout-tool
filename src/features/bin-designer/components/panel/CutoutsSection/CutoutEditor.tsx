/**
 * SVG-based 2D editor for placing and editing cutouts.
 *
 * Renders a top-down view of the bin interior with cutout shapes.
 * Supports click-to-place, selection, and marquee selection.
 */

import { useCallback, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { useCutoutInteraction } from './useCutoutInteraction';
import { CutoutShape } from './CutoutShape';
import { CutoutShapeToolbar } from './CutoutShapeToolbar';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';
import { AlignmentToolbar } from './AlignmentToolbar';
import { MarqueeBox } from './MarqueeBox';

/** Default size for new cutouts in mm */
const DEFAULT_RECT_SIZE = 10;
const DEFAULT_CIRCLE_DIAMETER = 10;
const DEFAULT_CUT_DEPTH = 5;
/** Canvas width in CSS pixels */
const CANVAS_WIDTH = 248;

export function CutoutEditor() {
  const {
    params,
    addCutout,
    updateCutout,
    removeCutout,
    duplicateCutouts,
    groupCutouts,
    ungroupCutouts,
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      addCutout: s.addCutout,
      updateCutout: s.updateCutout,
      removeCutout: s.removeCutout,
      duplicateCutouts: s.duplicateCutouts,
      groupCutouts: s.groupCutouts,
      ungroupCutouts: s.ungroupCutouts,
    }))
  );

  const { cutouts } = params;
  const outerW = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const binWidth = outerW - 2 * params.wallThickness;
  const binDepth = outerD - 2 * params.wallThickness;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const isFlat = params.base.style === 'flat';
  const wallHeight = isFlat ? totalHeight : totalHeight - GRIDFINITY.BASE_HEIGHT;

  const scale = CANVAS_WIDTH / binWidth;
  const canvasHeight = binDepth * scale;

  const { mode, setMode, selection, selectCutout, deselectAll, containerRef } =
    useCutoutInteraction({
      cutouts,
      onUpdate: updateCutout,
      onRemove: removeCutout,
      binWidth,
      binDepth,
    });

  // Marquee state
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  const svgToMm = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement) => {
      const rect = svg.getBoundingClientRect();
      const svgX = clientX - rect.left;
      const svgY = clientY - rect.top;
      const mmX = svgX / scale;
      const mmY = binDepth - svgY / scale;
      return { mmX, mmY, svgX, svgY };
    },
    [scale, binDepth]
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = containerRef.current;
      if (!svg) return;
      const { mmX, mmY, svgX, svgY } = svgToMm(e.clientX, e.clientY, svg);

      if (mode.type === 'placing') {
        const shape = mode.shape;
        const isCircle = shape === 'circle';
        const w = isCircle ? DEFAULT_CIRCLE_DIAMETER : DEFAULT_RECT_SIZE;
        const d = isCircle ? DEFAULT_CIRCLE_DIAMETER : DEFAULT_RECT_SIZE;

        // Center the shape on click point
        const x = Math.max(0, Math.min(mmX - w / 2, binWidth - w));
        const y = Math.max(0, Math.min(mmY - d / 2, binDepth - d));

        addCutout({
          id: crypto.randomUUID(),
          shape,
          x,
          y,
          width: w,
          depth: d,
          cutDepth: Math.min(DEFAULT_CUT_DEPTH, wallHeight),
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        });
        return;
      }

      // Start marquee if clicking empty space
      deselectAll();
      marqueeStartRef.current = { x: svgX, y: svgY };
      setMarquee({ x: svgX, y: svgY, w: 0, h: 0 });
    },
    [mode, addCutout, deselectAll, svgToMm, containerRef, binWidth, binDepth, wallHeight]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!marqueeStartRef.current || !containerRef.current) return;
      const svg = containerRef.current;
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;
      setMarquee({
        x: marqueeStartRef.current.x,
        y: marqueeStartRef.current.y,
        w: svgX - marqueeStartRef.current.x,
        h: svgY - marqueeStartRef.current.y,
      });
    },
    [containerRef]
  );

  const handleCanvasPointerUp = useCallback(() => {
    marqueeStartRef.current = null;
    setMarquee(null);
  }, []);

  const selectedCutout = selection.size === 1 ? cutouts.find((c) => selection.has(c.id)) : null;
  const selectedIds = [...selection];

  return (
    <div className="space-y-3">
      <CutoutShapeToolbar mode={mode} onSelectShape={setMode} />

      {/* SVG Canvas */}
      <div className="rounded border border-stroke-subtle bg-surface-secondary overflow-hidden">
        <svg
          ref={containerRef}
          width={CANVAS_WIDTH}
          height={canvasHeight}
          viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
          className={`block ${mode.type === 'placing' ? 'cursor-crosshair' : 'cursor-default'}`}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        >
          {/* Bin outline */}
          <rect
            x={0}
            y={0}
            width={CANVAS_WIDTH}
            height={canvasHeight}
            fill="none"
            stroke="var(--color-stroke-subtle)"
            strokeWidth={1}
            strokeDasharray="4 2"
          />

          {/* Cutout shapes */}
          {cutouts.map((cutout) => (
            <CutoutShape
              key={cutout.id}
              cutout={cutout}
              scale={scale}
              binDepth={binDepth}
              isSelected={selection.has(cutout.id)}
              isGrouped={cutout.groupId !== null}
              onSelect={selectCutout}
            />
          ))}

          {/* Marquee selection box */}
          {marquee && Math.abs(marquee.w) + Math.abs(marquee.h) > 5 && (
            <MarqueeBox x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} />
          )}
        </svg>
      </div>

      {/* Alignment toolbar for multi-select */}
      {selectedIds.length >= 2 && (
        <AlignmentToolbar
          selectedIds={selectedIds}
          cutouts={cutouts}
          binWidth={binWidth}
          binDepth={binDepth}
          onUpdate={updateCutout}
          onGroup={groupCutouts}
          onUngroup={ungroupCutouts}
          onDuplicate={duplicateCutouts}
        />
      )}

      {/* Property panel for single selection */}
      {selectedCutout && (
        <CutoutPropertyPanel
          cutout={selectedCutout}
          maxWidth={binWidth}
          maxDepth={binDepth}
          maxCutDepth={wallHeight}
          onUpdate={updateCutout}
          onRemove={removeCutout}
          onDuplicate={duplicateCutouts}
        />
      )}
    </div>
  );
}
