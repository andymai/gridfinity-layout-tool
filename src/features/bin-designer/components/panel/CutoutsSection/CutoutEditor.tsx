/**
 * SVG-based 2D editor for placing and editing cutouts.
 *
 * Renders a top-down view of the bin interior with cutout shapes.
 * Supports click-to-place, selection, marquee selection, drag-to-move,
 * and drag-to-resize via corner handles.
 */

import { useCallback, useState, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { getResizeCursor, centerInBin } from './geometry';
import { useCutoutInteraction } from './useCutoutInteraction';
import { useTranslation } from '@/i18n';
import { EditorBackground } from './EditorBackground';
import { CutoutShape } from './CutoutShape';
import { CutoutResizeHandles } from './CutoutResizeHandles';
import { RotationHandle } from './RotationHandle';
import { CutoutShapeToolbar } from './CutoutShapeToolbar';
import { CutoutPropertyPanel } from './CutoutPropertyPanel';
import { AlignmentToolbar } from './AlignmentToolbar';
import { MarqueeBox } from './MarqueeBox';
import { SmartGuides } from './SmartGuides';
import { DimensionTooltip } from './DimensionTooltip';
import { CutoutContextMenu } from './CutoutContextMenu';
import type { ContextMenuAction } from './CutoutContextMenu';

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

  const {
    mode,
    setMode,
    selection,
    selectCutout,
    selectIndividual,
    deselectAll,
    selectAll,
    deleteSelected,
    containerRef,
    preview,
    drawingPreview,
    startDrag,
    startResize,
    startRotation,
    handlePointerMove,
    handlePointerUp,
    snapEnabled,
    setSnapEnabled,
    activeGuides,
    copySelected,
    pasteFromClipboard,
    duplicateSelected,
    clipboard,
    contextMenu,
    openContextMenu,
    closeContextMenu,
  } = useCutoutInteraction({
    cutouts,
    onUpdate: updateCutout,
    onRemove: removeCutout,
    onAdd: addCutout,
    binWidth,
    binDepth,
  });

  const t = useTranslation();

  // Marquee state
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Compute tooltip info from mode and preview
  const tooltipInfo = useMemo(() => {
    if (mode.type === 'dragging' && preview.size > 0) {
      // Get first previewed cutout's position
      const [firstId, firstUpdates] = [...preview.entries()][0];
      const orig = cutouts.find((c) => c.id === firstId);
      if (!orig) return null;
      const effective = { ...orig, ...firstUpdates };
      const x = effective.x;
      const y = effective.y;
      const svgX = x * scale + 10;
      const svgY = (binDepth - y) * scale - 10;
      return { type: 'drag' as const, x, y, svgX, svgY };
    }
    if (mode.type === 'resizing' && preview.size > 0) {
      const [id, updates] = [...preview.entries()][0];
      const orig = cutouts.find((c) => c.id === id);
      if (!orig) return null;
      const effective = { ...orig, ...updates };
      const width = effective.width;
      const depth = effective.depth;
      const x = effective.x;
      const y = effective.y;
      const svgX = (x + width) * scale + 5;
      const svgY = (binDepth - y - depth) * scale;
      return { type: 'resize' as const, width, depth, svgX, svgY };
    }
    return null;
  }, [mode, preview, cutouts, scale, binDepth]);

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
        // Start drag-to-draw: record corner, switch to drawing mode
        setMode({ type: 'drawing', shape: mode.shape, startMmX: mmX, startMmY: mmY });
        return;
      }

      // Start marquee if clicking empty space
      deselectAll();
      marqueeStartRef.current = { x: svgX, y: svgY };
      setMarquee({ x: svgX, y: svgY, w: 0, h: 0 });
    },
    [mode, setMode, deselectAll, svgToMm, containerRef]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Handle drag/resize/rotate/group/drawing pointer move
      if (
        mode.type === 'dragging' ||
        mode.type === 'resizing' ||
        mode.type === 'rotating' ||
        mode.type === 'group-rotating' ||
        mode.type === 'group-scaling' ||
        mode.type === 'drawing'
      ) {
        const svg = containerRef.current;
        if (!svg) return;
        const { mmX, mmY } = svgToMm(e.clientX, e.clientY, svg);
        handlePointerMove(mmX, mmY, e.shiftKey);
        return;
      }

      // Handle marquee
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
    [containerRef, mode, svgToMm, handlePointerMove]
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (
      mode.type === 'dragging' ||
      mode.type === 'resizing' ||
      mode.type === 'rotating' ||
      mode.type === 'group-rotating' ||
      mode.type === 'group-scaling' ||
      mode.type === 'drawing'
    ) {
      handlePointerUp();
      return;
    }

    // Marquee selection: select all cutouts whose bounds intersect the marquee box
    if (marquee && marqueeStartRef.current) {
      const mx = Math.min(marquee.x, marquee.x + marquee.w);
      const my = Math.min(marquee.y, marquee.y + marquee.h);
      const mw = Math.abs(marquee.w);
      const mh = Math.abs(marquee.h);

      if (mw + mh > 5) {
        // Convert marquee from SVG px to mm
        const mmLeft = mx / scale;
        const mmRight = (mx + mw) / scale;
        const mmTop = binDepth - my / scale;
        const mmBottom = binDepth - (my + mh) / scale;
        const minY = Math.min(mmBottom, mmTop);
        const maxY = Math.max(mmBottom, mmTop);

        for (const cutout of cutouts) {
          const cRight = cutout.x + cutout.width;
          const cTop = cutout.y + cutout.depth;

          // Check AABB intersection
          if (cutout.x < mmRight && cRight > mmLeft && cutout.y < maxY && cTop > minY) {
            selectCutout(cutout.id, true);
          }
        }
      }
    }

    marqueeStartRef.current = null;
    setMarquee(null);
  }, [mode, handlePointerUp, marquee, scale, binDepth, cutouts, selectCutout]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY);
    },
    [openContextMenu]
  );

  // Derive cursor class based on current mode
  const getCursorClass = (): string => {
    if (mode.type === 'placing' || mode.type === 'drawing') return 'cursor-crosshair';
    if (mode.type === 'dragging') return 'cursor-grabbing';
    if (mode.type === 'resizing') return '';
    return 'cursor-default';
  };

  // Inline cursor style for resize (CSS cursor classes don't cover nwse-resize etc.)
  const getCursorStyle = (): React.CSSProperties | undefined => {
    if (mode.type === 'resizing') {
      return { cursor: getResizeCursor(mode.handle) };
    }
    return undefined;
  };

  const isDragging = mode.type === 'dragging';
  const isResizing = mode.type === 'resizing';
  const selectedCutout =
    selection.size === 1 && !isDragging ? cutouts.find((c) => selection.has(c.id)) : null;
  const selectedIds = [...selection];

  // Build context menu actions based on current state
  const contextMenuActions = useMemo((): ContextMenuAction[] => {
    const hasSelection = selection.size > 0;
    const hasClipboard = clipboard.length > 0;

    const actions: ContextMenuAction[] = [];

    if (hasSelection) {
      actions.push({ label: t('binDesigner.cutouts.copy'), onClick: copySelected });
      actions.push({ label: t('binDesigner.cutouts.duplicate'), onClick: duplicateSelected });
      actions.push({
        label: t('binDesigner.cutouts.delete'),
        onClick: deleteSelected,
        danger: true,
        dividerAfter: true,
      });
    }

    actions.push({
      label: t('binDesigner.cutouts.paste'),
      onClick: pasteFromClipboard,
      disabled: !hasClipboard,
    });

    actions.push({
      label: t('binDesigner.cutouts.selectAll'),
      onClick: selectAll,
      dividerAfter: hasSelection && selection.size < cutouts.length,
    });

    if (hasSelection && selection.size === 1) {
      const cutout = cutouts.find((c) => selection.has(c.id));
      if (cutout) {
        actions.push({
          label: t('binDesigner.cutouts.rotate90'),
          onClick: () => {
            const newRotation = (cutout.rotation + 90) % 360;
            updateCutout(cutout.id, { rotation: newRotation });
          },
        });
      }
    }

    if (hasSelection) {
      actions.push({
        label: t('binDesigner.cutouts.centerInBin'),
        onClick: () => {
          const selected = cutouts.filter((c) => selection.has(c.id));
          const positions = centerInBin(selected, binWidth, binDepth);
          for (const [id, pos] of Object.entries(positions)) {
            updateCutout(id, pos);
          }
        },
      });
    }

    return actions;
  }, [
    selection,
    clipboard,
    cutouts,
    copySelected,
    duplicateSelected,
    deleteSelected,
    pasteFromClipboard,
    selectAll,
    updateCutout,
    binWidth,
    binDepth,
    t,
  ]);

  return (
    <div className="space-y-3">
      <CutoutShapeToolbar
        mode={mode}
        onSelectShape={setMode}
        snapEnabled={snapEnabled}
        onSnapToggle={setSnapEnabled}
      />

      {/* SVG Canvas */}
      <div className="rounded border border-stroke-subtle bg-surface-secondary overflow-hidden">
        <svg
          ref={containerRef}
          width={CANVAS_WIDTH}
          height={canvasHeight}
          viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
          className={`block ${getCursorClass()}`}
          style={getCursorStyle()}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onContextMenu={handleContextMenu}
        >
          {/* Background grid and crosshair */}
          <EditorBackground
            binWidth={binWidth}
            binDepth={binDepth}
            scale={scale}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={canvasHeight}
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
              isDragging={isDragging && selection.has(cutout.id)}
              previewOverrides={preview.get(cutout.id)}
              onSelect={selectCutout}
              onDoubleClick={selectIndividual}
              onDragStart={mode.type === 'idle' ? startDrag : undefined}
            />
          ))}

          {/* Smart guides during drag */}
          {isDragging && (
            <SmartGuides
              guides={activeGuides}
              scale={scale}
              canvasWidth={CANVAS_WIDTH}
              canvasHeight={canvasHeight}
              binDepth={binDepth}
            />
          )}

          {/* Dimension tooltip during drag or resize */}
          {tooltipInfo && (
            <DimensionTooltip
              type={tooltipInfo.type}
              width={tooltipInfo.type === 'resize' ? tooltipInfo.width : undefined}
              depth={tooltipInfo.type === 'resize' ? tooltipInfo.depth : undefined}
              x={tooltipInfo.type === 'drag' ? tooltipInfo.x : undefined}
              y={tooltipInfo.type === 'drag' ? tooltipInfo.y : undefined}
              svgX={tooltipInfo.svgX}
              svgY={tooltipInfo.svgY}
            />
          )}

          {/* Resize handles on single selected cutout (not during drag/resize/rotate) */}
          {selectedCutout && !isDragging && !isResizing && mode.type !== 'rotating' && (
            <CutoutResizeHandles
              cutout={selectedCutout}
              scale={scale}
              binDepth={binDepth}
              onResizeStart={startResize}
            />
          )}

          {/* Rotation handle for all shapes (not during drag/resize/rotate) */}
          {selectedCutout && !isDragging && !isResizing && mode.type !== 'rotating' && (
            <RotationHandle
              cutout={selectedCutout}
              scale={scale}
              binDepth={binDepth}
              onRotateStart={startRotation}
            />
          )}

          {/* Drawing preview (corner-to-corner) */}
          {drawingPreview && (
            <rect
              x={drawingPreview.x * scale}
              y={(binDepth - drawingPreview.y - drawingPreview.depth) * scale}
              width={drawingPreview.width * scale}
              height={drawingPreview.depth * scale}
              rx={drawingPreview.shape === 'circle' ? (drawingPreview.width * scale) / 2 : 0}
              ry={drawingPreview.shape === 'circle' ? (drawingPreview.depth * scale) / 2 : 0}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              opacity={0.6}
            />
          )}

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

      {/* Context menu */}
      {contextMenu && (
        <CutoutContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
