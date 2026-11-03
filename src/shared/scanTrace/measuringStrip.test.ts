import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { detectMarkerStrip, stripSizeMm, STRIP_MARGIN_MM } from './measuringStrip';
import { CALIBRATION_MARKER_MM, CALIBRATION_PITCH_MM } from './calibrationGrid';
import { traceScene } from './traceScene';
import type { ImageDataLike, Point } from './types';

const W = 760;
const H = 560;
/** Pixels a millimetre, straight down onto the table. */
const SCALE = 3;

function inside(p: Point, poly: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit;
  }
  return hit;
}

/** Millimetres on the table to image pixels. */
const px = (p: Point): Point => ({ x: p.x * SCALE, y: p.y * SCALE });

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** A strip of `markers` from `start`, running at `angle`, as paper and its markers in mm. */
function stripLayers(
  markers: number,
  start: Point,
  angle: number
): { poly: Point[]; value: number }[] {
  const { length, width } = stripSizeMm(markers);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const at = (along: number, across: number): Point => ({
    x: start.x + ux * along - uy * across,
    y: start.y + uy * along + ux * across,
  });
  const quad = (a0: number, c0: number, a1: number, c1: number): Point[] => [
    at(a0, c0),
    at(a1, c0),
    at(a1, c1),
    at(a0, c1),
  ];
  const squares = Array.from({ length: markers }, (_, i) => {
    const a0 = STRIP_MARGIN_MM + i * CALIBRATION_PITCH_MM;
    return {
      poly: quad(
        a0,
        STRIP_MARGIN_MM,
        a0 + CALIBRATION_MARKER_MM,
        STRIP_MARGIN_MM + CALIBRATION_MARKER_MM
      ),
      value: 20,
    };
  });
  return [...squares, { poly: quad(0, 0, length, width), value: 250 }];
}

/** Draws the first layer a pixel falls in, over a mid-grey table. */
function render(layers: readonly { poly: Point[]; value: number }[]): ImageDataLike {
  const shown = layers.map((l) => ({ ...l, poly: l.poly.map(px) }));
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const layer = shown.find((l) => inside({ x, y }, l.poly));
      const v = layer ? layer.value : 140;
      const o = (y * W + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

const bbox = (points: readonly Point[]) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

describe('stripSizeMm', () => {
  it('spans its markers at the sheet’s pitch, with a margin all round', () => {
    expect(stripSizeMm(3)).toEqual({ length: 2 * 42 + 14 + 12, width: 26 });
    expect(stripSizeMm(5).length).toBe(4 * 42 + 26);
  });
});

describe('detectMarkerStrip', () => {
  it('finds a strip at any angle and reads its scale', () => {
    const strip = detectMarkerStrip(render(stripLayers(4, { x: 40, y: 30 }, 0.5)));
    expect(strip).not.toBeNull();
    if (!strip) return;
    expect(strip.lengthMm).toBe(3 * CALIBRATION_PITCH_MM);
    const pxPerMm = Math.hypot(strip.b.x - strip.a.x, strip.b.y - strip.a.y) / strip.lengthMm;
    expect(pxPerMm).toBeCloseTo(SCALE, 1);
  });

  it('wants three markers in a row, so two squares are not a strip', () => {
    const two = stripLayers(3, { x: 40, y: 60 }, 0).filter((_, i) => i !== 2);
    expect(detectMarkerStrip(render(two))).toBeNull();
  });

  it('passes over markers inside an area it is told to leave, such as a sheet’s', () => {
    const scene = render(stripLayers(4, { x: 40, y: 60 }, 0));
    const all = rect(0, 0, W, H);
    expect(detectMarkerStrip(scene, [all])).toBeNull();
  });
});

describe('tracing a tool under a strip', () => {
  // A 160 by 40 mm bar on the table.
  const BAR = { poly: rect(40, 70, 160, 40), value: 90 };

  it('measures by the strip and bridges the tool across it, flagging it', () => {
    // A strip laid across the bar's middle, running down the photo.
    const across = stripLayers(4, { x: 133, y: 14 }, Math.PI / 2);
    const result = traceScene(render([...across, BAR]), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const { reference, units, shapes } = result.value;
    expect(reference?.kind).toBe('strip');
    expect(units).toBe('mm');
    expect(shapes).toHaveLength(1);
    const size = bbox(shapes[0].outputPoints);
    expect(Math.abs(size.w - 160)).toBeLessThan(1.5);
    expect(Math.abs(size.h - 40)).toBeLessThan(1.5);
    expect(shapes[0].underStrip).toBe(true);
  });

  it('leaves the end of a tool the strip covers where the strip begins, and flags it', () => {
    // The strip over the bar's right end: tool shows on one side of it only.
    const end = stripLayers(4, { x: 214, y: 14 }, Math.PI / 2);
    const result = traceScene(render([...end, BAR]), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const [shape] = result.value.shapes;
    expect(bbox(shape.outputPoints).w).toBeLessThan(160 - 10);
    expect(shape.underStrip).toBe(true);
  });
});
