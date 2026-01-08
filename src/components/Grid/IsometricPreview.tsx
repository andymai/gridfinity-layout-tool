import { useRef, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore } from '../../store';
import { STAGING_ID, DEFAULT_CATEGORY_COLOR, calcMaxGridUnits } from '../../constants';

// Height units (7mm) to grid units (42mm) conversion for proper proportions
const HEIGHT_TO_GRID_SCALE = 7 / 42;
import { getLayerZStart } from '../../utils/collision';
import {
  toIsometric,
  sortBoxesForRendering,
  darkenColor,
  lightenColor,
  calculateIsometricBounds,
  type IsometricBox,
} from '../../utils/isometric';

const PREVIEW_SIZE = 280; // ~1/3 visual space
const PADDING = 20;

// World-space lighting configuration
// Light direction pointing FROM light TO scene (normalized)
// This creates light from top-front-left in world coordinates
const LIGHT_DIR = (() => {
  const raw = { x: -0.4, y: -0.6, z: 0.7 }; // From front-left and above
  const mag = Math.sqrt(raw.x ** 2 + raw.y ** 2 + raw.z ** 2);
  return { x: raw.x / mag, y: raw.y / mag, z: raw.z / mag };
})();

// Wall normals in local space (before rotation), indexed by wall
// Wall 0-1 (front): normal points -Y, Wall 1-2 (right): +X, etc.
const WALL_NORMALS = [
  { x: 0, y: -1, z: 0 },  // Wall 0: front (y=0)
  { x: 1, y: 0, z: 0 },   // Wall 1: right (x=width)
  { x: 0, y: 1, z: 0 },   // Wall 2: back (y=depth)
  { x: -1, y: 0, z: 0 },  // Wall 3: left (x=0)
];

/**
 * Calculate wall brightness using world-space lighting with smooth falloff.
 * Uses "wrapped diffuse" technique for softer shadow transitions.
 */
function getWallBrightness(wallIndex: number, rotation: number): number {
  const normal = WALL_NORMALS[wallIndex];
  const rotRad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  // Rotate normal around Z axis
  const rotatedNormal = {
    x: normal.x * cosR - normal.y * sinR,
    y: normal.x * sinR + normal.y * cosR,
    z: normal.z,
  };

  // Dot product with light direction (negative because LIGHT_DIR points toward scene)
  const dot = -(rotatedNormal.x * LIGHT_DIR.x + rotatedNormal.y * LIGHT_DIR.y + rotatedNormal.z * LIGHT_DIR.z);

  // "Wrapped diffuse" - remap [-1, 1] to [0, 1] for smoother shadow transitions
  // This prevents the harsh lit/shadow boundary
  const wrapped = dot * 0.5 + 0.5;

  // Apply subtle S-curve for even smoother transitions (smoothstep-like)
  const smooth = wrapped * wrapped * (3 - 2 * wrapped);

  // Map from [0, 1] to brightness range: -0.15 (shadow) to +0.20 (lit)
  // Slightly brighter on lit side, subtle shadow on dark side
  return smooth * 0.35 - 0.15;
}

/**
 * Calculate top surface brightness based on light's Z component.
 */
function getTopBrightness(): number {
  // Top surface normal is (0, 0, 1), dot with -LIGHT_DIR
  return -LIGHT_DIR.z * 0.2;
}

/**
 * Isometric 3D preview of the drawer layout.
 * Shows all layers stacked with bins colored by category.
 */
export function IsometricPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastX = useRef(0);

  const { showIsometricPreview, isometricRotation, hideLayersAbove, dimInactiveLayers, setIsometricRotation, toggleHideLayersAbove, toggleDimInactiveLayers } = useUIStore(
    useShallow((state) => ({
      showIsometricPreview: state.showIsometricPreview,
      isometricRotation: state.isometricRotation,
      hideLayersAbove: state.hideLayersAbove,
      dimInactiveLayers: state.dimInactiveLayers,
      setIsometricRotation: state.setIsometricRotation,
      toggleHideLayersAbove: state.toggleHideLayersAbove,
      toggleDimInactiveLayers: state.toggleDimInactiveLayers,
    }))
  );

  const layout = useLayoutStore((state) => state.layout);
  const activeLayerId = useUIStore((state) => state.activeLayerId);

  // Get layer indices for filtering
  const activeLayerIndex = layout.layers.findIndex(l => l.id === activeLayerId);

  // Calculate max print size for split line visualization
  const maxGridUnits = useMemo(
    () => calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm),
    [layout.printBedSize, layout.gridUnitMm]
  );

  // Drawer floor (drawn separately, always first)
  const floor: IsometricBox = useMemo(() => ({
    id: '__drawer_floor__',
    x: 0,
    y: 0,
    z: 0,
    width: layout.drawer.width,
    depth: layout.drawer.depth,
    height: 0.02,
    color: '#2a2a3e',
    opacity: 1,
  }), [layout.drawer.width, layout.drawer.depth]);

  // Convert layout data to isometric boxes
  const boxes = useMemo(() => {
    const result: IsometricBox[] = [];

    // Add bins (scale heights from height units to grid units for proper proportions)
    for (const bin of layout.bins) {
      if (bin.layerId === STAGING_ID) continue;

      // Filter out bins from layers above active layer if hideLayersAbove is enabled
      if (hideLayersAbove && activeLayerIndex >= 0) {
        const binLayerIndex = layout.layers.findIndex(l => l.id === bin.layerId);
        if (binLayerIndex > activeLayerIndex) continue;
      }

      const zStart = getLayerZStart(bin.layerId, layout.layers) * HEIGHT_TO_GRID_SCALE;
      const category = layout.categories.find(c => c.id === bin.category);
      const baseColor = category?.color || DEFAULT_CATEGORY_COLOR;

      // Optionally dim non-active layers by darkening their color
      const isActiveLayer = bin.layerId === activeLayerId;
      const isDimmed = dimInactiveLayers && !isActiveLayer;
      const color = isDimmed ? darkenColor(baseColor, 0.4) : baseColor;

      // Y-axis: In grid, y=0 is front (bottom of screen), y increases toward back (top of screen)
      // Flip Y so back of drawer (high Y) appears at back of isometric view
      const flippedY = layout.drawer.depth - bin.y - bin.depth;

      result.push({
        id: bin.id,
        x: bin.x,
        y: flippedY,
        z: zStart,
        width: bin.width,
        depth: bin.depth,
        height: bin.height * HEIGHT_TO_GRID_SCALE,
        color,
        opacity: isDimmed ? 0.5 : 1, // Use opacity to track dimmed state for split lines
      });
    }

    return result;
  }, [layout.bins, layout.layers, layout.drawer, layout.categories, activeLayerId, hideLayersAbove, activeLayerIndex, dimInactiveLayers]);

  // Render the isometric view
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showIsometricPreview) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = PREVIEW_SIZE;
    const height = PREVIEW_SIZE;

    // Set canvas size with device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Calculate scale based on floor only (keeps view stable when filtering layers)
    const bounds = calculateIsometricBounds([floor], isometricRotation, 1);
    const boundsWidth = bounds.maxX - bounds.minX;
    const boundsHeight = bounds.maxY - bounds.minY;

    const availableWidth = width - PADDING * 2;
    const availableHeight = height - PADDING * 2;

    const scale = Math.min(
      availableWidth / Math.max(boundsWidth, 1),
      availableHeight / Math.max(boundsHeight, 1),
      15 // Max scale
    );

    // Center offset
    const centerX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
    const centerY = height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale + height * 0.1;

    // Draw floor first (always behind everything)
    drawFloor(ctx, floor, isometricRotation, scale, centerX, centerY);

    // Draw gridlines on floor (with slight overhang)
    drawGridlines(ctx, layout.drawer.width, layout.drawer.depth, isometricRotation, scale, centerX, centerY);

    // Draw vertical height ticks (every 3 height units)
    const maxHeight = layout.drawer.height;
    drawHeightTicks(ctx, layout.drawer.width, layout.drawer.depth, maxHeight, isometricRotation, scale, centerX, centerY);

    // Sort and draw bins on top
    const sortedBoxes = sortBoxesForRendering(boxes, isometricRotation);
    for (const box of sortedBoxes) {
      drawBox(ctx, box, isometricRotation, scale, centerX, centerY);
      // Draw split lines for oversized bins
      if (box.width > maxGridUnits || box.depth > maxGridUnits) {
        drawSplitLines(ctx, box, maxGridUnits, isometricRotation, scale, centerX, centerY);
      }
    }

  }, [floor, boxes, isometricRotation, showIsometricPreview, layout.drawer.width, layout.drawer.depth, layout.drawer.height, maxGridUnits]);

  if (!showIsometricPreview) {
    return null;
  }

  // Drag handlers for free rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastX.current;
    lastX.current = e.clientX;
    // Rotate 1 degree per 2 pixels of drag
    setIsometricRotation(isometricRotation + deltaX * 0.5);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Check if rotation is not at default
  const isRotated = Math.abs(isometricRotation) > 1;

  return (
    <div
      className="absolute top-14 right-4 z-20 rounded-lg overflow-hidden shadow-lg border border-stroke-subtle select-none"
      style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, cursor: isDragging ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      title="Drag to rotate"
    >
      <canvas
        ref={canvasRef}
        className="block pointer-events-none"
      />
      {/* Reset rotation button */}
      {isRotated && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsometricRotation(0);
          }}
          className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] rounded bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content transition-colors"
          title="Reset rotation"
        >
          Reset
        </button>
      )}
      {/* Layer controls - only show when multiple layers */}
      {layout.layers.length > 1 && (
        <div className="absolute bottom-1 right-1 flex gap-0.5">
          {/* Dim inactive layers toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleDimInactiveLayers();
            }}
            className={`h-5 px-1.5 flex items-center justify-center gap-1 rounded text-[9px] font-medium transition-colors ${
              dimInactiveLayers
                ? 'bg-accent/90 text-white'
                : 'bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content'
            }`}
            title={dimInactiveLayers ? 'Currently: Inactive layers dimmed\nClick to show all at full brightness' : 'Currently: All layers at full brightness\nClick to dim inactive layers'}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Dim</span>
          </button>
          {/* Slice view toggle - hide layers above active */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleHideLayersAbove();
            }}
            className={`h-5 px-1.5 flex items-center justify-center gap-1 rounded text-[9px] font-medium transition-colors ${
              hideLayersAbove
                ? 'bg-accent/90 text-white'
                : 'bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content'
            }`}
            title={hideLayersAbove ? 'Currently: Showing only active layer and below\nClick to show all layers' : 'Currently: Showing all layers\nClick to hide layers above active'}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 12h16m-7 7h7" />
            </svg>
            <span>Slice</span>
          </button>
        </div>
      )}
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          useUIStore.getState().toggleIsometricPreview();
        }}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded bg-surface/80 hover:bg-surface text-content-tertiary hover:text-content transition-colors"
        title="Close preview"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Draw a floor/base quad
 */
function drawFloor(
  ctx: CanvasRenderingContext2D,
  box: IsometricBox,
  rotation: number,
  scale: number,
  offsetX: number,
  offsetY: number
) {
  const corners = [
    { x: box.x, y: box.y, z: 0 },
    { x: box.x + box.width, y: box.y, z: 0 },
    { x: box.x + box.width, y: box.y + box.depth, z: 0 },
    { x: box.x, y: box.y + box.depth, z: 0 },
  ];

  ctx.beginPath();
  corners.forEach((corner, i) => {
    const screen = toIsometric(corner, rotation, scale);
    const x = screen.x + offsetX;
    const y = screen.y + offsetY;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();

  ctx.fillStyle = box.color;
  ctx.globalAlpha = box.opacity;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

/**
 * Draw gridlines on the floor plane with slight overhang
 */
function drawGridlines(
  ctx: CanvasRenderingContext2D,
  drawerWidth: number,
  drawerDepth: number,
  rotation: number,
  scale: number,
  offsetX: number,
  offsetY: number
) {
  const overhang = 1.5; // Extend lines beyond drawer

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.5;

  // Helper to convert 3D point to 2D screen coords
  const to2D = (x: number, y: number, z: number) => {
    const screen = toIsometric({ x, y, z }, rotation, scale);
    return { x: screen.x + offsetX, y: screen.y + offsetY };
  };

  // Draw lines parallel to X-axis (along depth)
  for (let x = 0; x <= drawerWidth; x++) {
    const start = to2D(x, -overhang, 0);
    const end = to2D(x, drawerDepth + overhang, 0);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  // Draw lines parallel to Y-axis (along width)
  for (let y = 0; y <= drawerDepth; y++) {
    const start = to2D(-overhang, y, 0);
    const end = to2D(drawerWidth + overhang, y, 0);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
}

/**
 * Draw a wireframe cube backdrop showing the full drawer volume with height ticks
 */
function drawHeightTicks(
  ctx: CanvasRenderingContext2D,
  drawerWidth: number,
  drawerDepth: number,
  maxHeight: number,
  rotation: number,
  scale: number,
  offsetX: number,
  offsetY: number
) {
  const tickInterval = 3; // Every 3 height units

  // Helper to convert 3D point to 2D screen coords
  const to2D = (x: number, y: number, z: number) => {
    const screen = toIsometric({ x, y, z }, rotation, scale);
    return { x: screen.x + offsetX, y: screen.y + offsetY };
  };

  // Determine rotation quadrant
  const r = ((rotation % 360) + 360) % 360;

  // Draw colored back wall faces
  const wallMaxZ = maxHeight * HEIGHT_TO_GRID_SCALE;
  const w0 = to2D(0, 0, 0);
  const w1 = to2D(drawerWidth, 0, 0);
  const w2 = to2D(drawerWidth, drawerDepth, 0);
  const w3 = to2D(0, drawerDepth, 0);
  const w4 = to2D(0, 0, wallMaxZ);
  const w5 = to2D(drawerWidth, 0, wallMaxZ);
  const w6 = to2D(drawerWidth, drawerDepth, wallMaxZ);
  const w7 = to2D(0, drawerDepth, wallMaxZ);

  // Use same color as floor (#2a2a3e) with slight variation for depth
  // Draw walls that form the backdrop (visually behind the bins)
  // Note: bin Y coords are flipped, so visual "back" of scene = low isometric Y
  const wallColor1 = '#2a2a3e'; // Same as floor
  const wallColor2 = '#252535'; // Slightly darker for second wall

  ctx.globalAlpha = 1;
  if (r >= 315 || r < 45) {
    // 0°: front wall (y=0) and left wall (x=0) form backdrop (high x+y appears at back visually)
    ctx.fillStyle = wallColor1;
    ctx.beginPath();
    ctx.moveTo(w0.x, w0.y); ctx.lineTo(w1.x, w1.y); ctx.lineTo(w5.x, w5.y); ctx.lineTo(w4.x, w4.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = wallColor2;
    ctx.beginPath();
    ctx.moveTo(w0.x, w0.y); ctx.lineTo(w3.x, w3.y); ctx.lineTo(w7.x, w7.y); ctx.lineTo(w4.x, w4.y);
    ctx.closePath(); ctx.fill();
  } else if (r >= 45 && r < 135) {
    // 90°: left wall (x=0) and back wall (y=depth) form backdrop
    ctx.fillStyle = wallColor1;
    ctx.beginPath();
    ctx.moveTo(w0.x, w0.y); ctx.lineTo(w3.x, w3.y); ctx.lineTo(w7.x, w7.y); ctx.lineTo(w4.x, w4.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = wallColor2;
    ctx.beginPath();
    ctx.moveTo(w3.x, w3.y); ctx.lineTo(w2.x, w2.y); ctx.lineTo(w6.x, w6.y); ctx.lineTo(w7.x, w7.y);
    ctx.closePath(); ctx.fill();
  } else if (r >= 135 && r < 225) {
    // 180°: back wall (y=depth) and right wall (x=width) form backdrop
    ctx.fillStyle = wallColor1;
    ctx.beginPath();
    ctx.moveTo(w3.x, w3.y); ctx.lineTo(w2.x, w2.y); ctx.lineTo(w6.x, w6.y); ctx.lineTo(w7.x, w7.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = wallColor2;
    ctx.beginPath();
    ctx.moveTo(w1.x, w1.y); ctx.lineTo(w2.x, w2.y); ctx.lineTo(w6.x, w6.y); ctx.lineTo(w5.x, w5.y);
    ctx.closePath(); ctx.fill();
  } else {
    // 270°: right wall (x=width) and front wall (y=0) form backdrop
    ctx.fillStyle = wallColor1;
    ctx.beginPath();
    ctx.moveTo(w1.x, w1.y); ctx.lineTo(w2.x, w2.y); ctx.lineTo(w6.x, w6.y); ctx.lineTo(w5.x, w5.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = wallColor2;
    ctx.beginPath();
    ctx.moveTo(w0.x, w0.y); ctx.lineTo(w1.x, w1.y); ctx.lineTo(w5.x, w5.y); ctx.lineTo(w4.x, w4.y);
    ctx.closePath(); ctx.fill();
  }

  // Draw horizontal lines at each tick height on back walls only
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  // Determine back edges based on rotation (must match wall faces above)
  // corners: 0=(0,0), 1=(w,0), 2=(w,d), 3=(0,d)
  for (let h = tickInterval; h <= maxHeight; h += tickInterval) {
    const z = h * HEIGHT_TO_GRID_SCALE;

    const h0 = to2D(0, 0, z);
    const h1 = to2D(drawerWidth, 0, z);
    const h2 = to2D(drawerWidth, drawerDepth, z);
    const h3 = to2D(0, drawerDepth, z);

    ctx.beginPath();

    // Draw only back two edges based on view angle (matching filled walls)
    if (r >= 315 || r < 45) {
      // 0°: front wall (y=0) + left wall (x=0) form backdrop
      ctx.moveTo(h1.x, h1.y);
      ctx.lineTo(h0.x, h0.y);
      ctx.lineTo(h3.x, h3.y);
    } else if (r >= 45 && r < 135) {
      // 90°: left wall (x=0) + back wall (y=depth) form backdrop
      ctx.moveTo(h0.x, h0.y);
      ctx.lineTo(h3.x, h3.y);
      ctx.lineTo(h2.x, h2.y);
    } else if (r >= 135 && r < 225) {
      // 180°: back wall (y=depth) + right wall (x=width) form backdrop
      ctx.moveTo(h3.x, h3.y);
      ctx.lineTo(h2.x, h2.y);
      ctx.lineTo(h1.x, h1.y);
    } else {
      // 270°: right wall (x=width) + front wall (y=0) form backdrop
      ctx.moveTo(h2.x, h2.y);
      ctx.lineTo(h1.x, h1.y);
      ctx.lineTo(h0.x, h0.y);
    }

    ctx.stroke();
  }

  ctx.setLineDash([]);
}

/**
 * Draw an open-top bin (like a Gridfinity container) with 45° lighting
 * Light source is from top-left, creating shadows on right and interior
 * Features subtle rounded corners and realistic shadows
 */
function drawBox(
  ctx: CanvasRenderingContext2D,
  box: IsometricBox,
  rotation: number,
  scale: number,
  offsetX: number,
  offsetY: number
) {
  const { x, y, z, width, depth, height, color, opacity } = box;

  // Wall thickness - exaggerated for visibility (real bins are 0.01-0.03 units)
  const wallThickness = 0.12;

  // Corner radius - subtle rounding on vertical edges (proportional to bin size)
  const cornerRadius = Math.min(width, depth) * 0.12;

  // World-space lighting - top brightness based on light angle
  const topBrightness = getTopBrightness();
  const topRim = topBrightness > 0 ? lightenColor(color, topBrightness) : darkenColor(color, -topBrightness);
  const interior = darkenColor(color, 0.45);

  // Helper to convert 3D point to 2D screen coords
  const to2D = (px: number, py: number, pz: number) => {
    const screen = toIsometric({ x: px, y: py, z: pz }, rotation, scale);
    return { x: screen.x + offsetX, y: screen.y + offsetY };
  };

  // Small Z gap to lift bins off the floor (no X/Y gap so bins touch each other)
  const zGap = 0.03;

  // Outer corners (bottom) - raised slightly off floor
  const r = cornerRadius;
  const c0 = to2D(x, y, z + zGap);
  const c1 = to2D(x + width, y, z + zGap);
  const c2 = to2D(x + width, y + depth, z + zGap);
  const c3 = to2D(x, y + depth, z + zGap);

  // Top corners with inset points for rounded rim
  const t0 = to2D(x, y, z + height);
  const t0_x = to2D(x + r, y, z + height);
  const t0_y = to2D(x, y + r, z + height);

  const t1 = to2D(x + width, y, z + height);
  const t1_x = to2D(x + width - r, y, z + height);
  const t1_y = to2D(x + width, y + r, z + height);

  const t2 = to2D(x + width, y + depth, z + height);
  const t2_x = to2D(x + width - r, y + depth, z + height);
  const t2_y = to2D(x + width, y + depth - r, z + height);

  const t3 = to2D(x, y + depth, z + height);
  const t3_x = to2D(x + r, y + depth, z + height);
  const t3_y = to2D(x, y + depth - r, z + height);

  // Inner corners (for cavity)
  const ib = [
    to2D(x + wallThickness, y + wallThickness, z + zGap),
    to2D(x + width - wallThickness, y + wallThickness, z + zGap),
    to2D(x + width - wallThickness, y + depth - wallThickness, z + zGap),
    to2D(x + wallThickness, y + depth - wallThickness, z + zGap),
  ];
  const it = [
    to2D(x + wallThickness, y + wallThickness, z + height),
    to2D(x + width - wallThickness, y + wallThickness, z + height),
    to2D(x + width - wallThickness, y + depth - wallThickness, z + height),
    to2D(x + wallThickness, y + depth - wallThickness, z + height),
  ];

  ctx.globalAlpha = opacity;

  const visibleWalls = getVisibleOuterWalls(rotation);

  // === SOLID BASE FILL ===
  // Draw a solid base color for the entire visible bin to prevent any see-through gaps
  ctx.fillStyle = color;
  ctx.beginPath();
  // Draw outer silhouette (all visible walls as one shape)
  ctx.moveTo(c0.x, c0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.lineTo(c3.x, c3.y);
  ctx.closePath();
  ctx.fill();
  // Top face base
  ctx.beginPath();
  ctx.moveTo(t0.x, t0.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.closePath();
  ctx.fill();
  // Fill vertical edges to connect bottom and top
  ctx.beginPath();
  ctx.moveTo(c0.x, c0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.lineTo(t0.x, t0.y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c2.x, c2.y);
  ctx.lineTo(c3.x, c3.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c3.x, c3.y);
  ctx.lineTo(c0.x, c0.y);
  ctx.lineTo(t0.x, t0.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.closePath();
  ctx.fill();

  // Now draw individual walls with world-space lighting
  // Wall corners for drawing
  const wallCorners = [
    { b1: c0, b2: c1, t1: t0, t2: t1 }, // wall 0-1 (front)
    { b1: c1, b2: c2, t1: t1, t2: t2 }, // wall 1-2 (right)
    { b1: c2, b2: c3, t1: t2, t2: t3 }, // wall 2-3 (back)
    { b1: c3, b2: c0, t1: t3, t2: t0 }, // wall 3-0 (left)
  ];

  for (const wall of visibleWalls) {
    const wallIndex = wall.b1;
    const brightness = getWallBrightness(wallIndex, rotation);
    const wallColor = brightness > 0 ? lightenColor(color, brightness) : darkenColor(color, -brightness);
    const pts = wallCorners[wallIndex];

    // Main wall fill - full rectangle from corner to corner
    ctx.fillStyle = wallColor;
    ctx.beginPath();
    ctx.moveTo(pts.b1.x, pts.b1.y);
    ctx.lineTo(pts.b2.x, pts.b2.y);
    ctx.lineTo(pts.t2.x, pts.t2.y);
    ctx.lineTo(pts.t1.x, pts.t1.y);
    ctx.closePath();
    ctx.fill();

    // === AMBIENT OCCLUSION ===
    const aoHeight = 0.2;
    const midB1 = { x: pts.b1.x + (pts.t1.x - pts.b1.x) * aoHeight, y: pts.b1.y + (pts.t1.y - pts.b1.y) * aoHeight };
    const midB2 = { x: pts.b2.x + (pts.t2.x - pts.b2.x) * aoHeight, y: pts.b2.y + (pts.t2.y - pts.b2.y) * aoHeight };

    const grad = ctx.createLinearGradient(pts.b1.x, pts.b1.y, midB1.x, midB1.y);
    grad.addColorStop(0, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pts.b1.x, pts.b1.y);
    ctx.lineTo(pts.b2.x, pts.b2.y);
    ctx.lineTo(midB2.x, midB2.y);
    ctx.lineTo(midB1.x, midB1.y);
    ctx.closePath();
    ctx.fill();

    // === CONTACT SHADOW ===
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts.b1.x, pts.b1.y);
    ctx.lineTo(pts.b2.x, pts.b2.y);
    ctx.stroke();
  }

  // Draw interior floor with gradient (darker in back corner)
  ctx.fillStyle = interior;
  ctx.beginPath();
  ctx.moveTo(ib[0].x, ib[0].y);
  ctx.lineTo(ib[1].x, ib[1].y);
  ctx.lineTo(ib[2].x, ib[2].y);
  ctx.lineTo(ib[3].x, ib[3].y);
  ctx.closePath();
  ctx.fill();

  // Add interior shadow gradient (darker in the back)
  const interiorGrad = ctx.createLinearGradient(ib[0].x, ib[0].y, ib[2].x, ib[2].y);
  interiorGrad.addColorStop(0, 'rgba(0,0,0,0)');
  interiorGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = interiorGrad;
  ctx.beginPath();
  ctx.moveTo(ib[0].x, ib[0].y);
  ctx.lineTo(ib[1].x, ib[1].y);
  ctx.lineTo(ib[2].x, ib[2].y);
  ctx.lineTo(ib[3].x, ib[3].y);
  ctx.closePath();
  ctx.fill();

  // Draw inner walls with ambient occlusion
  const drawInnerWalls = getVisibleInnerWalls(rotation);
  for (const wall of drawInnerWalls) {
    ctx.fillStyle = interior;
    ctx.beginPath();
    ctx.moveTo(ib[wall.b1].x, ib[wall.b1].y);
    ctx.lineTo(ib[wall.b2].x, ib[wall.b2].y);
    ctx.lineTo(it[wall.b2].x, it[wall.b2].y);
    ctx.lineTo(it[wall.b1].x, it[wall.b1].y);
    ctx.closePath();
    ctx.fill();

    // Interior wall AO - darker at the bottom
    const iwAO = 0.3;
    const iwMid1 = { x: ib[wall.b1].x + (it[wall.b1].x - ib[wall.b1].x) * iwAO, y: ib[wall.b1].y + (it[wall.b1].y - ib[wall.b1].y) * iwAO };
    const iwMid2 = { x: ib[wall.b2].x + (it[wall.b2].x - ib[wall.b2].x) * iwAO, y: ib[wall.b2].y + (it[wall.b2].y - ib[wall.b2].y) * iwAO };

    const iwGrad = ctx.createLinearGradient(ib[wall.b1].x, ib[wall.b1].y, iwMid1.x, iwMid1.y);
    iwGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
    iwGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = iwGrad;
    ctx.beginPath();
    ctx.moveTo(ib[wall.b1].x, ib[wall.b1].y);
    ctx.lineTo(ib[wall.b2].x, ib[wall.b2].y);
    ctx.lineTo(iwMid2.x, iwMid2.y);
    ctx.lineTo(iwMid1.x, iwMid1.y);
    ctx.closePath();
    ctx.fill();
  }

  // Draw top rim with rounded outer edge
  ctx.fillStyle = topRim;
  ctx.beginPath();
  // Outer edge with curves at corners
  ctx.moveTo(t0_x.x, t0_x.y);
  ctx.lineTo(t1_x.x, t1_x.y);
  ctx.quadraticCurveTo(t1.x, t1.y, t1_y.x, t1_y.y);
  ctx.lineTo(t2_y.x, t2_y.y);
  ctx.quadraticCurveTo(t2.x, t2.y, t2_x.x, t2_x.y);
  ctx.lineTo(t3_x.x, t3_x.y);
  ctx.quadraticCurveTo(t3.x, t3.y, t3_y.x, t3_y.y);
  ctx.lineTo(t0_y.x, t0_y.y);
  ctx.quadraticCurveTo(t0.x, t0.y, t0_x.x, t0_x.y);
  ctx.closePath();
  // Inner edge (hole) - straight for simplicity
  ctx.moveTo(it[0].x, it[0].y);
  ctx.lineTo(it[3].x, it[3].y);
  ctx.lineTo(it[2].x, it[2].y);
  ctx.lineTo(it[1].x, it[1].y);
  ctx.closePath();
  ctx.fill('evenodd');

  ctx.globalAlpha = 1;
}

/**
 * Get visible outer walls based on rotation (works with any angle)
 * Walls facing away from camera are drawn first (back to front)
 */
function getVisibleOuterWalls(rotation: number): { b1: number; b2: number; lit: boolean }[] {
  // Normalize rotation to 0-360
  const r = ((rotation % 360) + 360) % 360;

  // Determine which quadrant we're in to decide visible walls
  // Corners: 0=front-left, 1=front-right, 2=back-right, 3=back-left
  // Walls: 0-1=front, 1-2=right, 2-3=back, 3-0=left

  const walls: { b1: number; b2: number; lit: boolean }[] = [];

  // Back wall visible when rotation is 315-45 or 135-225
  if ((r >= 315 || r < 45) || (r >= 135 && r < 225)) {
    walls.push({ b1: 3, b2: 2, lit: r >= 180 && r < 360 });
  }
  // Front wall visible when rotation is 135-315
  if (r >= 135 && r < 315) {
    walls.push({ b1: 0, b2: 1, lit: r >= 180 && r < 360 });
  }
  // Right wall visible when rotation is 45-225
  if (r >= 45 && r < 225) {
    walls.push({ b1: 1, b2: 2, lit: r >= 90 && r < 270 });
  }
  // Left wall visible when rotation is 225-360 or 0-45
  if (r >= 225 || r < 45) {
    walls.push({ b1: 3, b2: 0, lit: r < 90 || r >= 270 });
  }

  return walls;
}

/**
 * Get visible inner walls based on rotation (works with any angle)
 */
function getVisibleInnerWalls(rotation: number): { b1: number; b2: number }[] {
  const r = ((rotation % 360) + 360) % 360;
  const walls: { b1: number; b2: number }[] = [];

  // Inner front wall visible when looking from back (rotation 315-45)
  if (r >= 315 || r < 45) {
    walls.push({ b1: 1, b2: 0 });
  }
  // Inner back wall visible when looking from front (rotation 135-225)
  if (r >= 135 && r < 225) {
    walls.push({ b1: 2, b2: 3 });
  }
  // Inner right wall visible when looking from left (rotation 225-315)
  if (r >= 225 && r < 315) {
    walls.push({ b1: 3, b2: 0 });
  }
  // Inner left wall visible when looking from right (rotation 45-135)
  if (r >= 45 && r < 135) {
    walls.push({ b1: 1, b2: 2 });
  }

  return walls;
}

/**
 * Calculate split line positions along an axis using greedy halving.
 * Returns positions relative to 0 (start of bin).
 * Example: getSplitPositions(5, 4) → [3] (splits at position 3, making 3+2)
 * Example: getSplitPositions(9, 4) → [5, 3] (splits at 5 and 3, making 4+3+2)
 */
function getSplitPositions(size: number, maxSize: number, offset: number = 0): number[] {
  if (size <= maxSize) return [];

  const splitAt = Math.ceil(size / 2);
  const positions: number[] = [offset + splitAt];

  // Recursively get splits for left and right halves
  positions.push(...getSplitPositions(splitAt, maxSize, offset));
  positions.push(...getSplitPositions(size - splitAt, maxSize, offset + splitAt));

  return positions;
}

/**
 * Draw dashed split lines on the top face of an oversized bin.
 * Uses amber color matching the split warning in UI.
 */
function drawSplitLines(
  ctx: CanvasRenderingContext2D,
  box: IsometricBox,
  maxSize: number,
  rotation: number,
  scale: number,
  offsetX: number,
  offsetY: number
) {
  const { x, y, z, width, depth, height, opacity } = box;
  const topZ = z + height;

  // Helper to convert 3D point to 2D screen coords
  const to2D = (px: number, py: number, pz: number) => {
    const screen = toIsometric({ x: px, y: py, z: pz }, rotation, scale);
    return { x: screen.x + offsetX, y: screen.y + offsetY };
  };

  ctx.save();
  // Amber color matching UI warning, with opacity for dimmed bins
  const alpha = opacity < 1 ? 0.4 : 0.9;
  ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);

  // Get split positions for width (X axis) and depth (Y axis)
  const xSplits = getSplitPositions(width, maxSize);
  const ySplits = getSplitPositions(depth, maxSize);

  // Draw vertical split lines (parallel to Y axis) at X positions
  for (const splitX of xSplits) {
    const start = to2D(x + splitX, y, topZ);
    const end = to2D(x + splitX, y + depth, topZ);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  // Draw horizontal split lines (parallel to X axis) at Y positions
  for (const splitY of ySplits) {
    const start = to2D(x, y + splitY, topZ);
    const end = to2D(x + width, y + splitY, topZ);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.restore();
}
