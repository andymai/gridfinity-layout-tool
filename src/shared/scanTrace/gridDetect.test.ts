import { describe, it, expect } from 'vitest';
import { detectCalibrationGrid } from './gridDetect';
import { applyHomography } from './perspective';
import {
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  CALIBRATION_PITCH_MM,
  CALIBRATION_MARKER_MM,
  calibrationNodes,
} from './calibrationGrid';
import type { ImageDataLike, Point } from './types';

// A tilted pinhole camera over the sheet's plane. The sheet's own millimetre
// frame has its origin at lattice node (0,0), so a point's expected rectified
// coordinates are just its sheet millimetres.
const W = 600;
const H = 780;
const SPAN_X = (CALIBRATION_COLS - 1) * CALIBRATION_PITCH_MM;
const SPAN_Y = (CALIBRATION_ROWS - 1) * CALIBRATION_PITCH_MM;
const CENTER: Point = { x: SPAN_X / 2, y: SPAN_Y / 2 };

function makeCamera(tiltX: number, tiltY: number, focal = 2700, dist = 900) {
  const cxr = Math.cos(tiltX);
  const sxr = Math.sin(tiltX);
  const cyr = Math.cos(tiltY);
  const syr = Math.sin(tiltY);
  const r = [
    [cyr, 0, syr],
    [sxr * syr, cxr, -sxr * cyr],
    [-cxr * syr, sxr, cxr * cyr],
  ];
  return (p: Point): Point => {
    const x = p.x - CENTER.x;
    const y = p.y - CENTER.y;
    const xc = r[0][0] * x + r[0][1] * y;
    const yc = r[1][0] * x + r[1][1] * y;
    const zc = r[2][0] * x + r[2][1] * y + dist;
    return { x: (focal * xc) / zc + W / 2, y: (focal * yc) / zc + H / 2 };
  };
}

type Camera = ReturnType<typeof makeCamera>;

const MARKER = CALIBRATION_MARKER_MM;
const PAPER: Point[] = [
  { x: -30, y: -25 },
  { x: SPAN_X + 30, y: -25 },
  { x: SPAN_X + 30, y: SPAN_Y + 25 },
  { x: -30, y: SPAN_Y + 25 },
];

function markerSquares(): Point[][] {
  const half = MARKER / 2;
  return calibrationNodes().map((n) => [
    { x: n.x - half, y: n.y - half },
    { x: n.x + half, y: n.y - half },
    { x: n.x + half, y: n.y + half },
    { x: n.x - half, y: n.y + half },
  ]);
}

interface Layer {
  readonly poly: Point[];
  readonly value: number;
}

function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** First layer containing the pixel wins; `table` is the fallback. */
function render(layers: readonly Layer[], table: number): ImageDataLike {
  const data = new Uint8ClampedArray(W * H * 4);
  const boxes = layers.map((l) => ({
    minX: Math.min(...l.poly.map((p) => p.x)),
    maxX: Math.max(...l.poly.map((p) => p.x)),
    minY: Math.min(...l.poly.map((p) => p.y)),
    maxY: Math.max(...l.poly.map((p) => p.y)),
  }));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = table;
      for (let i = 0; i < layers.length; i++) {
        const b = boxes[i];
        if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
        if (pointInPolygon({ x, y }, layers[i].poly)) {
          v = layers[i].value;
          break;
        }
      }
      const o = (y * W + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

interface SceneOptions {
  readonly camera?: Camera;
  readonly tool?: Point[];
  readonly table?: number;
  readonly skipMarkers?: number;
  /** Project through swapped axes — the sheet photographed sideways. */
  readonly sideways?: boolean;
}

function renderSheet(options: SceneOptions = {}): ImageDataLike {
  const camera = options.camera ?? makeCamera(0.22, 0.14);
  const project = (poly: readonly Point[]): Point[] =>
    poly.map((p) => camera(options.sideways ? { x: p.y, y: p.x } : p));

  const squares = markerSquares().slice(options.skipMarkers ?? 0);
  const layers: Layer[] = [];
  if (options.tool) layers.push({ poly: project(options.tool), value: 70 });
  for (const square of squares) layers.push({ poly: project(square), value: 20 });
  layers.push({ poly: project(PAPER), value: 250 });
  return render(layers, options.table ?? 120);
}

/** An L-shaped tool inside the ring, in sheet millimetres. */
const TOOL: Point[] = [
  { x: 55, y: 50 },
  { x: 115, y: 50 },
  { x: 115, y: 80 },
  { x: 80, y: 80 },
  { x: 80, y: 160 },
  { x: 55, y: 160 },
];

const PROBE_A: Point = { x: 60, y: 60 };
const PROBE_B: Point = { x: 140, y: 120 };
const PROBE_DIST = Math.hypot(PROBE_B.x - PROBE_A.x, PROBE_B.y - PROBE_A.y);

describe('detectCalibrationGrid', () => {
  it('finds every marker on a clean tilted shot', () => {
    const grid = detectCalibrationGrid(renderSheet());
    expect(grid).not.toBeNull();
    if (!grid) return;
    expect(grid.markers).toHaveLength(calibrationNodes().length);
    expect(grid.rmsMm).toBeLessThan(0.5);
  });

  // The real proof: points the fit never saw come back at their true sheet
  // millimetres, which is what sizes the tool.
  it('rectifies points it was not fitted to, to true millimetres', () => {
    const camera = makeCamera(0.22, 0.14);
    const grid = detectCalibrationGrid(renderSheet({ camera, tool: TOOL }));
    expect(grid).not.toBeNull();
    if (!grid) return;

    for (const probe of [PROBE_A, PROBE_B]) {
      const recovered = applyHomography(grid.homography, camera(probe));
      expect(recovered.x).toBeCloseTo(probe.x, 0);
      expect(recovered.y).toBeCloseTo(probe.y, 0);
    }
  });

  it('recovers true size from a sheet photographed sideways', () => {
    // Pulled back: turned sideways the sheet is wider than it is tall, and the
    // fixture's frame is portrait.
    const camera = makeCamera(0.18, 0.1, 2000);
    const grid = detectCalibrationGrid(renderSheet({ camera, sideways: true }));
    expect(grid).not.toBeNull();
    if (!grid) return;
    expect(grid.markers.length).toBeGreaterThanOrEqual(calibrationNodes().length - 1);

    // Orientation is free to differ (the sheet is turned), so measure a
    // distance rather than coordinates.
    const a = applyHomography(grid.homography, camera({ x: PROBE_A.y, y: PROBE_A.x }));
    const b = applyHomography(grid.homography, camera({ x: PROBE_B.y, y: PROBE_B.x }));
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(PROBE_DIST, 0);
  });

  it('still solves when the tool covers some markers', () => {
    const camera = makeCamera(0.2, 0.12);
    // A tool wide enough to swallow the left column's middle markers.
    const wideTool: Point[] = [
      { x: -10, y: 60 },
      { x: 120, y: 60 },
      { x: 120, y: 150 },
      { x: -10, y: 150 },
    ];
    const grid = detectCalibrationGrid(renderSheet({ camera, tool: wideTool }));
    expect(grid).not.toBeNull();
    if (!grid) return;
    expect(grid.markers.length).toBeLessThan(calibrationNodes().length);
    expect(grid.markers.length).toBeGreaterThanOrEqual(8);

    const a = applyHomography(grid.homography, camera(PROBE_A));
    const b = applyHomography(grid.homography, camera(PROBE_B));
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(PROBE_DIST, 0);
  });

  // A dark table flips the polarity `buildMask` would infer from the image
  // border; marker detection thresholds on "printed black" instead.
  it.each([20, 120, 235])('survives a table at luma %i', (table) => {
    const grid = detectCalibrationGrid(renderSheet({ table }));
    expect(grid).not.toBeNull();
    expect(grid?.markers.length).toBeGreaterThanOrEqual(calibrationNodes().length - 1);
  });

  it('declines when too few markers are in frame', () => {
    // Ten of the eighteen removed: not enough left to bracket the sheet.
    expect(detectCalibrationGrid(renderSheet({ skipMarkers: 10 }))).toBeNull();
  });

  it('declines on a photo with no sheet at all', () => {
    const camera = makeCamera(0.2, 0.12);
    const card: Point[] = [
      { x: 20, y: 20 },
      { x: 105.6, y: 20 },
      { x: 105.6, y: 73.98 },
      { x: 20, y: 73.98 },
    ];
    const project = (poly: readonly Point[]): Point[] => poly.map(camera);
    const image = render(
      [
        { poly: project(TOOL), value: 60 },
        { poly: project(card), value: 30 },
      ],
      235
    );
    expect(detectCalibrationGrid(image)).toBeNull();
  });

  it('declines on an empty image', () => {
    expect(
      detectCalibrationGrid({ width: 0, height: 0, data: new Uint8ClampedArray() })
    ).toBeNull();
  });
});
