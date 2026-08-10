/**
 * End-to-end sizing through the printable calibration sheet: a photographed
 * tool comes out at its true millimetres, on both the ML and classical paths.
 */

import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { traceScene, traceSceneSegmented, computeAutoSeed, withCardSize } from './traceScene';
import {
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  CALIBRATION_PITCH_MM,
  CALIBRATION_MARKER_MM,
  calibrationNodes,
} from './calibrationGrid';
import type { SoftMask } from './softContour';
import type { ImageDataLike, Point } from './types';

const W = 600;
const H = 780;
const SPAN_X = (CALIBRATION_COLS - 1) * CALIBRATION_PITCH_MM;
const SPAN_Y = (CALIBRATION_ROWS - 1) * CALIBRATION_PITCH_MM;

/** Tilted pinhole camera; sheet millimetres in, image pixels out. */
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
    const x = p.x - SPAN_X / 2;
    const y = p.y - SPAN_Y / 2;
    const xc = r[0][0] * x + r[0][1] * y;
    const yc = r[1][0] * x + r[1][1] * y;
    const zc = r[2][0] * x + r[2][1] * y + dist;
    return { x: (focal * xc) / zc + W / 2, y: (focal * yc) / zc + H / 2 };
  };
}

const cam = makeCamera(0.2, 0.12);
const project = (poly: readonly Point[]): Point[] => poly.map(cam);

// L-shaped tool inside the marker ring: 60 × 110 mm bounding box.
const TOOL_MM: Point[] = [
  { x: 55, y: 50 },
  { x: 115, y: 50 },
  { x: 115, y: 80 },
  { x: 80, y: 80 },
  { x: 80, y: 160 },
  { x: 55, y: 160 },
];
const TOOL_W = 60;
const TOOL_H = 110;

const PAPER: Point[] = [
  { x: -30, y: -25 },
  { x: SPAN_X + 30, y: -25 },
  { x: SPAN_X + 30, y: SPAN_Y + 25 },
  { x: -30, y: SPAN_Y + 25 },
];

function markerSquares(): Point[][] {
  const half = CALIBRATION_MARKER_MM / 2;
  return calibrationNodes().map((n) => [
    { x: n.x - half, y: n.y - half },
    { x: n.x + half, y: n.y - half },
    { x: n.x + half, y: n.y + half },
    { x: n.x - half, y: n.y + half },
  ]);
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

const toolImage = project(TOOL_MM);

function renderSheet(): ImageDataLike {
  const layers = [
    { poly: toolImage, value: 90 },
    ...markerSquares().map((s) => ({ poly: project(s), value: 20 })),
    { poly: project(PAPER), value: 250 },
  ];
  const boxes = layers.map((l) => ({
    minX: Math.min(...l.poly.map((p) => p.x)),
    maxX: Math.max(...l.poly.map((p) => p.x)),
    minY: Math.min(...l.poly.map((p) => p.y)),
    maxY: Math.max(...l.poly.map((p) => p.y)),
  }));

  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 140; // table
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

function toolSoftMask(): SoftMask {
  const data = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (pointInPolygon({ x, y }, toolImage)) data[y * W + x] = 1;
    }
  }
  return { width: W, height: H, data };
}

function bbox(points: readonly Point[]): { w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

const scene = renderSheet();

describe('calibration sheet sizing', () => {
  it('sizes the tool to true millimetres on the classical path', () => {
    const result = traceScene(scene, { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('mm');
    expect(result.value.grid?.kind).toBe('sheet');
    expect(result.value.card).toBeNull();

    const out = bbox(result.value.outputPoints);
    // Well inside a millimetre on a 110mm tool — the card path's own fixture
    // only manages 2.5mm on a 45mm one.
    expect(Math.abs(out.w - TOOL_W)).toBeLessThan(0.5);
    expect(Math.abs(out.h - TOOL_H)).toBeLessThan(0.5);
  });

  it('sizes the tool to true millimetres on the segmenter path', () => {
    const result = traceSceneSegmented(scene, toolSoftMask(), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('mm');
    expect(result.value.grid).not.toBeNull();

    const out = bbox(result.value.outputPoints);
    // Well inside a millimetre on a 110mm tool — the card path's own fixture
    // only manages 2.5mm on a 45mm one.
    expect(Math.abs(out.w - TOOL_W)).toBeLessThan(0.5);
    expect(Math.abs(out.h - TOOL_H)).toBeLessThan(0.5);
  });

  it('reports the fit it actually achieved', () => {
    const result = traceScene(scene, { smooth: false });
    if (!isOk(result) || !result.value.grid) throw new Error('fixture failed');
    expect(result.value.grid.cells).toHaveLength(calibrationNodes().length);
    expect(result.value.grid.rmsMm).toBeLessThan(0.5);
  });

  // The markers are printed black, so they are foreground on the same threshold
  // the tool is. Left in, the largest-blob pick would find a marker or graft one
  // onto the tool; the traced outline proves they were excluded.
  it('traces the tool rather than a marker', () => {
    const result = traceScene(scene, { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');
    const traced = bbox(result.value.imagePoints);
    const expected = bbox(toolImage);
    expect(Math.abs(traced.w - expected.w)).toBeLessThan(3);
    expect(Math.abs(traced.h - expected.h)).toBeLessThan(3);
  });

  it('seeds the segmenter on the tool, not on a marker', () => {
    const seed = computeAutoSeed(scene);
    const expected = bbox(toolImage);
    const xs = toolImage.map((p) => p.x);
    const ys = toolImage.map((p) => p.y);
    expect(seed.x * W).toBeGreaterThan(Math.min(...xs));
    expect(seed.x * W).toBeLessThan(Math.min(...xs) + expected.w);
    expect(seed.y * H).toBeGreaterThan(Math.min(...ys));
    expect(seed.y * H).toBeLessThan(Math.min(...ys) + expected.h);
  });

  // Smoothing must not resize the tool. The curve fit's error metric only
  // samples the points it is handed, so fitting the RDP-simplified polygon let
  // a cubic bow outside a long straight edge while scoring a perfect fit at the
  // two endpoints that edge had been reduced to — a silent outward offset that
  // measured ~4.5mm on a 68mm tool, independent of the size reference and
  // larger than anything the reference contributes.
  it('smooths the outline without inflating it', () => {
    const raw = traceScene(scene, { smooth: false });
    const smoothed = traceScene(scene, {});
    if (!isOk(raw) || !isOk(smoothed)) throw new Error('fixture failed');

    // Genuinely smoothed: many more vertices than the simplified polygon.
    expect(smoothed.value.outputPoints.length).toBeGreaterThan(raw.value.outputPoints.length * 3);

    const rawBox = bbox(raw.value.outputPoints);
    const smoothBox = bbox(smoothed.value.outputPoints);
    expect(Math.abs(smoothBox.w - rawBox.w)).toBeLessThan(0.5);
    expect(Math.abs(smoothBox.h - rawBox.h)).toBeLessThan(0.5);
    expect(Math.abs(smoothBox.w - TOOL_W)).toBeLessThan(0.6);
    expect(Math.abs(smoothBox.h - TOOL_H)).toBeLessThan(0.6);
  });

  // The sheet's dimensions are printed, not measured, so there is nothing for
  // the card editor to correct — and it must not silently rescale the outline.
  it('ignores a card size entered against a sheet-sized scene', () => {
    const result = traceScene(scene, { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');
    expect(withCardSize(result.value, 100, 60)).toBe(result.value);
  });
});
