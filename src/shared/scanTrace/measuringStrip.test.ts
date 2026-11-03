import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import {
  bridgeSoftAcrossStrip,
  detectMarkerStrip,
  stripSizeMm,
  STRIP_MARGIN_MM,
} from './measuringStrip';
import { CALIBRATION_MARKER_MM, CALIBRATION_PITCH_MM, calibrationNodes } from './calibrationGrid';
import { traceScene, traceSceneSegmented, withReference } from './traceScene';
import type { SoftMask } from './softContour';
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
function render(
  layers: readonly { poly: Point[]; value: number }[],
  frame = { width: W, height: H, scale: SCALE, table: 140 }
): ImageDataLike {
  const { width, height, scale, table } = frame;
  const shown = layers.map((l) => ({
    ...l,
    poly: l.poly.map((p) => ({ x: p.x * scale, y: p.y * scale })),
  }));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const layer = shown.find((l) => inside({ x, y }, l.poly));
      const v = layer ? layer.value : table;
      const o = (y * width + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
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

  it('takes a straight short strip over a longer row that is bent', () => {
    // Five markers whose middle one sits 2 mm off the line, and a true strip.
    const bent = stripLayers(5, { x: 20, y: 20 }, 0).map((layer, i) =>
      i === 2 ? { ...layer, poly: layer.poly.map((p) => ({ x: p.x, y: p.y + 2 })) } : layer
    );
    const strip = detectMarkerStrip(render([...bent, ...stripLayers(3, { x: 30, y: 110 }, 0)]));
    expect(strip?.lengthMm).toBe(2 * CALIBRATION_PITCH_MM);
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

  it('keeps a tool whose middle lies under the strip when the scale is set again', () => {
    // A 60 mm square, the strip down its middle, so its deepest point is under the paper.
    const square = { poly: rect(90, 60, 60, 60), value: 90 };
    const middle = stripLayers(4, { x: 133, y: 14 }, Math.PI / 2);
    const result = traceScene(render([...middle, square]), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.shapes).toHaveLength(1);
    expect(withReference(result.value, result.value.reference).shapes).toHaveLength(1);
  });

  it('keeps the strip note when the scale is changed to a ruler', () => {
    const across = stripLayers(4, { x: 133, y: 14 }, Math.PI / 2);
    const result = traceScene(render([...across, BAR]), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const ruler = {
      kind: 'ruler' as const,
      ruler: { a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, lengthMm: 100 },
    };
    expect(withReference(result.value, ruler).shapes[0].underStrip).toBe(true);
  });

  it('bridges the model’s mask too, so a redraw keeps the whole tool', () => {
    const across = stripLayers(4, { x: 133, y: 14 }, Math.PI / 2);
    const image = render([...across, BAR]);
    const strip = detectMarkerStrip(image);
    expect(strip).not.toBeNull();
    if (!strip) return;
    // What a model sees: the bar's two visible pieces, either side of the paper.
    const bar = BAR.poly.map(px);
    const data = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inside({ x, y }, bar) && !inside({ x, y }, strip.paper)) data[y * W + x] = 1;
      }
    }
    const soft: SoftMask = { width: W, height: H, data };
    const redrawn = traceSceneSegmented(image, soft, { smooth: false }, { kind: 'strip', strip });
    expect(isOk(redrawn)).toBe(true);
    if (!isOk(redrawn)) return;
    expect(Math.abs(bbox(redrawn.value.shapes[0].outputPoints).w - 160)).toBeLessThan(1.5);
  });

  it('keeps a calibration sheet under the strip from tracing as tools', () => {
    // A sheet on a dark table, a tool inside its ring, a strip across the tool.
    const frame = { width: 600, height: 600, scale: 2, table: 70 };
    const half = CALIBRATION_MARKER_MM / 2;
    const ring = calibrationNodes().map((n) => ({
      poly: rect(40 + n.x - half, 40 + n.y - half, CALIBRATION_MARKER_MM, CALIBRATION_MARKER_MM),
      value: 20,
    }));
    const tool = { poly: rect(85, 120, 110, 30), value: 100 };
    const strip = stripLayers(3, { x: 127, y: 75 }, Math.PI / 2);
    const paper = { poly: rect(15, 15, 168 + 50, 210 + 50), value: 245 };
    const result = traceScene(render([...strip, ...ring, tool, paper], frame), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const { reference, shapes } = result.value;
    expect(reference?.kind).toBe('strip');
    expect(reference?.kind === 'strip' && reference.sheet).toBeTruthy();
    expect(shapes).toHaveLength(1);
    expect(Math.abs(bbox(shapes[0].outputPoints).w - 110)).toBeLessThan(2);
  });

  it('leaves the model’s confidence alone away from the strip, changing only the bridged gap', () => {
    const across = stripLayers(4, { x: 133, y: 14 }, Math.PI / 2);
    const strip = detectMarkerStrip(render([...across, BAR]));
    expect(strip).not.toBeNull();
    if (!strip) return;
    const bar = BAR.poly.map(px);
    const data = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inside({ x, y }, bar) && !inside({ x, y }, strip.paper)) data[y * W + x] = 0.7;
      }
    }
    const out = bridgeSoftAcrossStrip({ width: W, height: H, data }, strip).data;
    // A pixel well inside the bar, far from the strip, keeps the model's 0.7.
    const far = Math.round(90 * SCALE) * W + Math.round(60 * SCALE);
    expect(out[far]).toBeCloseTo(0.7);
    // A pixel under the strip, inside the bar, is filled.
    const under = Math.round(90 * SCALE) * W + Math.round(120 * SCALE);
    expect(out[under]).toBe(1);
  });
});
