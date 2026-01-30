/**
 * SVG thumbnail for bin designs.
 *
 * Renders an isometric 3D view of the bin showing:
 * - Bin exterior (width × depth × height in grid units)
 * - Compartment walls visualized
 * - Stylized depth/dimension representation
 *
 * Similar to LayoutThumbnail but for bin compartments instead of drawer bins.
 */

import type { JSX } from 'react';
import type { BinParams, CompartmentConfig } from '../../types';

interface BinDesignThumbnailProps {
  params: BinParams;
  /** Size in pixels (used for width, height auto-calculated) */
  size?: number;
  className?: string;
}

// Isometric projection angles (30° standard)
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const COS_ISO = Math.cos(ISO_ANGLE);
const SIN_ISO = Math.sin(ISO_ANGLE);

/**
 * Convert 3D coordinates to 2D isometric projection.
 * X goes right-down, Y goes left-down, Z goes up.
 */
function toIsometric(x: number, y: number, z: number): { x: number; y: number } {
  return {
    x: (x - y) * COS_ISO,
    y: (x + y) * SIN_ISO - z,
  };
}

/**
 * SVG thumbnail showing an isometric 3D view of a bin's compartments.
 */
export function BinDesignThumbnail({ params, size = 48, className = '' }: BinDesignThumbnailProps) {
  const { width, depth, height, compartments } = params;

  // Scale factor to fit the bin in the SVG
  // Account for isometric projection expanding the footprint
  const maxDim = Math.max(width, depth, height);
  const scale = (size * 0.6) / maxDim;

  // Calculate SVG dimensions to fit isometric view
  const projectedWidth = (width + depth) * COS_ISO * scale;
  const projectedHeight = (width + depth) * SIN_ISO * scale + height * scale;

  const svgWidth = Math.ceil(projectedWidth + 8);
  const svgHeight = Math.ceil(projectedHeight + 8);

  // Center offset
  const offsetX = svgWidth / 2;
  const offsetY = svgHeight - 4;

  // Helper to project and offset a point
  const project = (x: number, y: number, z: number) => {
    const iso = toIsometric(x * scale, y * scale, z * scale);
    return { x: offsetX + iso.x, y: offsetY + iso.y };
  };

  // Get compartment data for interior walls
  const compartmentRects = getCompartmentRects(compartments, width, depth);
  const numCompartments = compartmentRects.length;

  // Define points for the bin exterior
  const p0 = project(0, 0, 0); // front bottom
  const p1 = project(width, 0, 0); // right bottom
  const p2 = project(width, depth, 0); // back right bottom
  const p3 = project(0, depth, 0); // back left bottom
  const p4 = project(0, 0, height); // front top
  const p5 = project(width, 0, height); // right top
  const p6 = project(width, depth, height); // back right top
  const p7 = project(0, depth, height); // back left top

  // Colors
  const frontFace = '#64748b'; // slate-500
  const rightFace = '#475569'; // slate-600
  const topFace = '#94a3b8'; // slate-400
  const interiorColor = '#cbd5e1'; // slate-300
  const wallColor = '#334155'; // slate-700

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className={`${className}`}
      aria-hidden="true"
    >
      {/* Back faces (visible in isometric) */}
      {/* Left face */}
      <polygon
        points={`${p0.x},${p0.y} ${p3.x},${p3.y} ${p7.x},${p7.y} ${p4.x},${p4.y}`}
        fill={frontFace}
        stroke={wallColor}
        strokeWidth={0.5}
      />

      {/* Back face */}
      <polygon
        points={`${p3.x},${p3.y} ${p2.x},${p2.y} ${p6.x},${p6.y} ${p7.x},${p7.y}`}
        fill={rightFace}
        stroke={wallColor}
        strokeWidth={0.5}
      />

      {/* Interior floor (slightly inset) */}
      {(() => {
        const inset = 0.15;
        const floorZ = 0.2; // Slight elevation for floor
        const fi0 = project(inset, inset, floorZ);
        const fi1 = project(width - inset, inset, floorZ);
        const fi2 = project(width - inset, depth - inset, floorZ);
        const fi3 = project(inset, depth - inset, floorZ);
        return (
          <polygon
            points={`${fi0.x},${fi0.y} ${fi1.x},${fi1.y} ${fi2.x},${fi2.y} ${fi3.x},${fi3.y}`}
            fill={interiorColor}
            opacity={0.8}
          />
        );
      })()}

      {/* Compartment dividers */}
      {numCompartments > 1 && (
        <g opacity={0.7}>
          {renderCompartmentWalls(compartments, width, depth, height, scale, offsetX, offsetY)}
        </g>
      )}

      {/* Front face */}
      <polygon
        points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p5.x},${p5.y} ${p4.x},${p4.y}`}
        fill={frontFace}
        stroke={wallColor}
        strokeWidth={0.5}
      />

      {/* Right face */}
      <polygon
        points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p6.x},${p6.y} ${p5.x},${p5.y}`}
        fill={rightFace}
        stroke={wallColor}
        strokeWidth={0.5}
      />

      {/* Top rim (thin strip around the opening) */}
      {(() => {
        const rimWidth = 0.1;
        const t0 = project(0, 0, height);
        const t1 = project(width, 0, height);
        const t2 = project(width, depth, height);
        const t3 = project(0, depth, height);
        const ti0 = project(rimWidth, rimWidth, height);
        const ti1 = project(width - rimWidth, rimWidth, height);
        const ti2 = project(width - rimWidth, depth - rimWidth, height);
        const ti3 = project(rimWidth, depth - rimWidth, height);

        return (
          <>
            {/* Outer top face */}
            <polygon
              points={`${t0.x},${t0.y} ${t1.x},${t1.y} ${ti1.x},${ti1.y} ${ti0.x},${ti0.y}`}
              fill={topFace}
              stroke={wallColor}
              strokeWidth={0.3}
            />
            <polygon
              points={`${t1.x},${t1.y} ${t2.x},${t2.y} ${ti2.x},${ti2.y} ${ti1.x},${ti1.y}`}
              fill={topFace}
              stroke={wallColor}
              strokeWidth={0.3}
            />
            <polygon
              points={`${t2.x},${t2.y} ${t3.x},${t3.y} ${ti3.x},${ti3.y} ${ti2.x},${ti2.y}`}
              fill={topFace}
              stroke={wallColor}
              strokeWidth={0.3}
            />
            <polygon
              points={`${t3.x},${t3.y} ${t0.x},${t0.y} ${ti0.x},${ti0.y} ${ti3.x},${ti3.y}`}
              fill={topFace}
              stroke={wallColor}
              strokeWidth={0.3}
            />
          </>
        );
      })()}
    </svg>
  );
}

/**
 * Render compartment divider walls in isometric projection.
 */
function renderCompartmentWalls(
  compartments: CompartmentConfig,
  binWidth: number,
  binDepth: number,
  binHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number
): JSX.Element[] {
  const { cols, rows, cells } = compartments;
  const cellWidth = binWidth / cols;
  const cellHeight = binDepth / rows;
  const wallHeight = binHeight * 0.6; // Walls don't go all the way up

  const project = (x: number, y: number, z: number) => {
    const iso = toIsometric(x * scale, y * scale, z * scale);
    return { x: offsetX + iso.x, y: offsetY + iso.y };
  };

  const walls: JSX.Element[] = [];
  const wallColor = '#475569';

  // Find vertical walls (between columns)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const leftId = cells[row * cols + col];
      const rightId = cells[row * cols + col + 1];
      if (leftId !== rightId) {
        const x = (col + 1) * cellWidth;
        const y1 = row * cellHeight;
        const y2 = (row + 1) * cellHeight;

        const p1 = project(x, y1, 0);
        const p2 = project(x, y2, 0);
        const p3 = project(x, y2, wallHeight);
        const p4 = project(x, y1, wallHeight);

        walls.push(
          <polygon
            key={`vwall-${row}-${col}`}
            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
            fill={wallColor}
            opacity={0.5}
          />
        );
      }
    }
  }

  // Find horizontal walls (between rows)
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols; col++) {
      const topId = cells[row * cols + col];
      const bottomId = cells[(row + 1) * cols + col];
      if (topId !== bottomId) {
        const y = (row + 1) * cellHeight;
        const x1 = col * cellWidth;
        const x2 = (col + 1) * cellWidth;

        const p1 = project(x1, y, 0);
        const p2 = project(x2, y, 0);
        const p3 = project(x2, y, wallHeight);
        const p4 = project(x1, y, wallHeight);

        walls.push(
          <polygon
            key={`hwall-${row}-${col}`}
            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
            fill={wallColor}
            opacity={0.4}
          />
        );
      }
    }
  }

  return walls;
}

/**
 * Convert cell-based compartment config to rectangles.
 * Each unique compartment ID becomes a bounding rectangle.
 */
function getCompartmentRects(
  compartments: CompartmentConfig,
  binWidth: number,
  binDepth: number
): Array<{ x: number; y: number; w: number; h: number }> {
  const { cols, rows, cells } = compartments;
  const cellWidth = binWidth / cols;
  const cellHeight = binDepth / rows;

  // Group cells by compartment ID
  const compartmentCells = new Map<number, Array<{ col: number; row: number }>>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      const existing = compartmentCells.get(id);
      if (existing) {
        existing.push({ col, row });
      } else {
        compartmentCells.set(id, [{ col, row }]);
      }
    }
  }

  // Convert each compartment's cells to a bounding rectangle
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (const [, cellList] of compartmentCells) {
    const minCol = Math.min(...cellList.map((c) => c.col));
    const maxCol = Math.max(...cellList.map((c) => c.col));
    const minRow = Math.min(...cellList.map((c) => c.row));
    const maxRow = Math.max(...cellList.map((c) => c.row));

    rects.push({
      x: minCol * cellWidth,
      y: minRow * cellHeight,
      w: (maxCol - minCol + 1) * cellWidth,
      h: (maxRow - minRow + 1) * cellHeight,
    });
  }

  return rects;
}
