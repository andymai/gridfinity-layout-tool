import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { detectBaseplateGrid, BASEPLATE_PITCH_MM } from './baseplateDetect';
import { traceScene } from './traceScene';
import { applyHomography } from './perspective';
import type { ImageDataLike, Point } from './types';

const W = 640;
const H = 640;
const PITCH = BASEPLATE_PITCH_MM;
// The dark region a camera sees is the socket FLOOR, seen down through the
// tapered wall — narrower than the 42mm cell, with a visible rim between
// neighbours. That gap is what lets adjacent sockets label separately.
const SOCKET_MM = 36;
const SOCKET_RADIUS_MM = 4;

/** Tilted pinhole camera; baseplate millimetres in, image pixels out. */
function makeCamera(centre: Point, tiltX: number, tiltY: number, focal: number, dist = 1000) {
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
    const x = p.x - centre.x;
    const y = p.y - centre.y;
    const xc = r[0][0] * x + r[0][1] * y;
    const yc = r[1][0] * x + r[1][1] * y;
    const zc = r[2][0] * x + r[2][1] * y + dist;
    return { x: (focal * xc) / zc + W / 2, y: (focal * yc) / zc + H / 2 };
  };
}

type Camera = (p: Point) => Point;

/**
 * A socket opening: a square with rounded corners, which is exactly why the
 * detector fits centres rather than corners.
 */
function roundedSquare(cx: number, cy: number, size: number, radius: number): Point[] {
  const half = size / 2;
  const inner = half - radius;
  const points: Point[] = [];
  const corners: Array<[number, number, number]> = [
    [inner, inner, 0],
    [-inner, inner, Math.PI / 2],
    [-inner, -inner, Math.PI],
    [inner, -inner, (3 * Math.PI) / 2],
  ];
  for (const [ox, oy, start] of corners) {
    for (let s = 0; s <= 6; s++) {
      const a = start + (s / 6) * (Math.PI / 2);
      points.push({ x: cx + ox + radius * Math.cos(a), y: cy + oy + radius * Math.sin(a) });
    }
  }
  return points;
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

interface PlateOptions {
  readonly cols: number;
  readonly rows: number;
  readonly camera: Camera;
  readonly plateLuma?: number;
  readonly socketLuma?: number;
  readonly tool?: Point[];
  readonly socketMm?: number;
}

function renderPlate(options: PlateOptions): ImageDataLike {
  const socketSize = options.socketMm ?? SOCKET_MM;
  const layers: Array<{ poly: Point[]; value: number }> = [];
  if (options.tool) layers.push({ poly: options.tool.map(options.camera), value: 40 });
  for (let row = 0; row < options.rows; row++) {
    for (let col = 0; col < options.cols; col++) {
      const socket = roundedSquare(
        col * PITCH,
        row * PITCH,
        socketSize,
        Math.min(SOCKET_RADIUS_MM, socketSize / 3)
      );
      layers.push({ poly: socket.map(options.camera), value: options.socketLuma ?? 95 });
    }
  }
  const boxes = layers.map((l) => ({
    minX: Math.min(...l.poly.map((p) => p.x)),
    maxX: Math.max(...l.poly.map((p) => p.x)),
    minY: Math.min(...l.poly.map((p) => p.y)),
    maxY: Math.max(...l.poly.map((p) => p.y)),
  }));

  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = options.plateLuma ?? 150;
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

function plateCamera(cols: number, rows: number, focal = 2600): Camera {
  return makeCamera(
    { x: ((cols - 1) * PITCH) / 2, y: ((rows - 1) * PITCH) / 2 },
    0.18,
    0.11,
    focal
  );
}

/** Measure a known separation through the recovered map — the actual claim. */
function measured(homography: readonly number[], camera: Camera, a: Point, b: Point): number {
  const ma = applyHomography(homography, camera(a));
  const mb = applyHomography(homography, camera(b));
  return Math.hypot(mb.x - ma.x, mb.y - ma.y);
}

describe('detectBaseplateGrid', () => {
  it('sizes from a 4x4 plate with sockets darker than the rims', () => {
    const camera = plateCamera(4, 4);
    const fit = detectBaseplateGrid(renderPlate({ cols: 4, rows: 4, camera }));
    expect(fit).not.toBeNull();
    if (!fit) return;

    expect(fit.cells).toHaveLength(16);
    expect(fit.rmsMm).toBeLessThan(1);
    expect(measured(fit.homography, camera, { x: 10, y: 20 }, { x: 90, y: 80 })).toBeCloseTo(
      100,
      0
    );
  });

  // Whether a socket reads darker or lighter than its rim is a lighting
  // accident, so the scan tries both rather than assuming.
  it('sizes from the same plate with the contrast inverted', () => {
    const camera = plateCamera(4, 4);
    const fit = detectBaseplateGrid(
      renderPlate({ cols: 4, rows: 4, camera, plateLuma: 90, socketLuma: 165 })
    );
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.cells.length).toBeGreaterThanOrEqual(12);
    expect(measured(fit.homography, camera, { x: 10, y: 20 }, { x: 90, y: 80 })).toBeCloseTo(
      100,
      0
    );
  });

  // How much plate is in frame is not known in advance, so the extent is fitted
  // rather than assumed — including non-square plates.
  it('discovers a non-square extent', () => {
    const camera = plateCamera(3, 5, 2100);
    const fit = detectBaseplateGrid(renderPlate({ cols: 3, rows: 5, camera }));
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.cells).toHaveLength(15);
    expect(measured(fit.homography, camera, { x: 0, y: 0 }, { x: 84, y: 168 })).toBeCloseTo(
      Math.hypot(84, 168),
      0
    );
  });

  it('still solves when the tool covers the middle sockets', () => {
    const camera = plateCamera(4, 4);
    // Covers the inner 2x2 sockets outright while clearing the outer ring.
    const tool: Point[] = [
      { x: 22, y: 22 },
      { x: 104, y: 22 },
      { x: 104, y: 104 },
      { x: 22, y: 104 },
    ];
    const fit = detectBaseplateGrid(renderPlate({ cols: 4, rows: 4, camera, tool }));
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.cells.length).toBeLessThan(16);
    expect(fit.cells.length).toBeGreaterThanOrEqual(8);
    expect(measured(fit.homography, camera, { x: 0, y: 126 }, { x: 126, y: 126 })).toBeCloseTo(
      126,
      0
    );
  });

  // A lattice alone is not enough: the cells have to be socket-sized for their
  // pitch, or we have locked onto something that merely happens to be regular.
  it('rejects a 42mm lattice of cells far too small to be sockets', () => {
    const camera = plateCamera(4, 4);
    expect(detectBaseplateGrid(renderPlate({ cols: 4, rows: 4, camera, socketMm: 12 }))).toBeNull();
  });

  it('declines on a photo with no lattice at all', () => {
    const camera = plateCamera(4, 4);
    const card: Point[] = [
      { x: 10, y: 10 },
      { x: 95.6, y: 10 },
      { x: 95.6, y: 63.98 },
      { x: 10, y: 63.98 },
    ];
    const layers = [
      card,
      [
        { x: 100, y: 100 },
        { x: 140, y: 105 },
        { x: 138, y: 160 },
      ],
    ];
    const data = new Uint8ClampedArray(W * H * 4);
    const polys = layers.map((l) => l.map(camera));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = polys.some((p) => pointInPolygon({ x, y }, p)) ? 60 : 220;
        const o = (y * W + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    expect(detectBaseplateGrid({ width: W, height: H, data })).toBeNull();
  });

  it('declines on an empty image', () => {
    expect(detectBaseplateGrid({ width: 0, height: 0, data: new Uint8ClampedArray() })).toBeNull();
  });

  // The rig lives here rather than beside the sheet's tests, so the end-to-end
  // check does too: a baseplate scene must reach the tracer as a sized scene.
  it('sizes a scanned tool end to end through traceScene', () => {
    const camera = plateCamera(4, 4);
    // Covers the sockets it touches outright. A tool that covers one only
    // PARTLY leaves an uncovered sliver joined to it, which the classical
    // largest-blob trace cannot tell from the tool — see `traceScene`.
    const tool: Point[] = [
      { x: 22, y: 22 },
      { x: 104, y: 22 },
      { x: 104, y: 104 },
      { x: 22, y: 104 },
    ];
    const result = traceScene(renderPlate({ cols: 4, rows: 4, camera, tool }), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('mm');
    expect(result.value.grid?.kind).toBe('baseplate');
    expect(result.value.card).toBeNull();

    const xs = result.value.outputPoints.map((p) => p.x);
    const ys = result.value.outputPoints.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(82, 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(82, 0);
  });
});
