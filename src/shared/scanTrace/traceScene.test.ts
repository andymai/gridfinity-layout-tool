import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import {
  traceScene,
  traceSceneSegmented,
  detectCard,
  buildToolTraceSoft,
  withCardSize,
  withReference,
  sameReference,
  type SceneReference,
} from './traceScene';
import { CARD_WIDTH_MM, CARD_HEIGHT_MM } from './cardDetect';
import { binarize } from './softContour';
import type { SoftMask } from './softContour';
import type { ImageDataLike, Point } from './types';

// Tilted pinhole camera over the world z=0 plane (principal point at centre).
const F = 600;
const CXP = 180;
const CYP = 130;
const DIST = 520;

function camera(tiltX: number, tiltY: number) {
  const cxr = Math.cos(tiltX);
  const sxr = Math.sin(tiltX);
  const cyr = Math.cos(tiltY);
  const syr = Math.sin(tiltY);
  const r = [
    [cyr, 0, syr],
    [sxr * syr, cxr, -sxr * cyr],
    [-cxr * syr, sxr, cxr * cyr],
  ];
  return (x: number, y: number): Point => {
    const xc = r[0][0] * x + r[0][1] * y;
    const yc = r[1][0] * x + r[1][1] * y;
    const zc = r[2][0] * x + r[2][1] * y + DIST;
    return { x: (F * xc) / zc + CXP, y: (F * yc) / zc + CYP };
  };
}

const cam = camera(0.32, 0.2);
const project = (pts: Point[]): Point[] => pts.map((p) => cam(p.x, p.y));

const CARD_MM: Point[] = [
  { x: -42.8, y: -26.99 },
  { x: 42.8, y: -26.99 },
  { x: 42.8, y: 26.99 },
  { x: -42.8, y: 26.99 },
];
// L-shaped tool, 25 × 45 mm bounding box.
const TOOL_MM: Point[] = [
  { x: 60, y: -22 },
  { x: 85, y: -22 },
  { x: 85, y: -7 },
  { x: 70, y: -7 },
  { x: 70, y: 23 },
  { x: 60, y: 23 },
];

function pointInPolygon(p: Point, poly: Point[]): boolean {
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

// A second tool, 10 × 40 mm, to the right of the first.
const BAR_MM: Point[] = [
  { x: 95, y: -20 },
  { x: 105, y: -20 },
  { x: 105, y: 20 },
  { x: 95, y: 20 },
];

function render(
  withCard: boolean,
  width = 360,
  height = 260,
  tools: readonly Point[][] = [TOOL_MM]
): ImageDataLike {
  const cardImg = project(CARD_MM);
  const toolImgs = tools.map(project);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const here = { x, y };
      const v =
        withCard && pointInPolygon(here, cardImg)
          ? 235
          : toolImgs.some((t) => pointInPolygon(here, t))
            ? 150
            : 15;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

function bbox(points: readonly Point[]): { w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

describe('traceScene', () => {
  it('traces every tool in the photo, each to true millimetres', () => {
    const result = traceScene(render(true, 360, 260, [TOOL_MM, BAR_MM]), { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');

    expect(result.value.units).toBe('mm');
    expect(result.value.shapes).toHaveLength(2);
    const [first, second] = result.value.shapes.map((s) => bbox(s.outputPoints));
    expect(Math.abs(first.w - 25)).toBeLessThan(2.5);
    expect(Math.abs(first.h - 45)).toBeLessThan(2.5);
    expect(Math.abs(second.w - 10)).toBeLessThan(2.5);
    expect(Math.abs(second.h - 40)).toBeLessThan(2.5);
  });

  it('rectifies the tool to true millimetres when a card is present', () => {
    // smoothing off so the assertion measures card-scale accuracy.
    const result = traceScene(render(true), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('mm');
    expect(result.value.card).not.toBeNull();
    expect(bbox(result.value.shapes[0].imagePoints).w).toBeGreaterThan(20);
    const out = bbox(result.value.shapes[0].outputPoints);
    expect(Math.abs(out.w - 25)).toBeLessThan(2.5);
    expect(Math.abs(out.h - 45)).toBeLessThan(2.5);
  });

  it('falls back to pixel units when no card is present', () => {
    const result = traceScene(render(false));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.units).toBe('px');
    expect(result.value.card).toBeNull();
    expect(result.value.shapes[0].outputPoints).toEqual(result.value.shapes[0].imagePoints);
  });
});

describe('withCardSize', () => {
  const traced = (): ReturnType<typeof traceScene> => traceScene(render(true), { smooth: false });

  it('rescales the outline when the card is measured larger than nominal', () => {
    const result = traced();
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const base = bbox(result.value.shapes[0].outputPoints);
    const bigger = withCardSize(result.value, CARD_WIDTH_MM * 1.1, CARD_HEIGHT_MM * 1.1);

    const out = bbox(bigger.shapes[0].outputPoints);
    expect(out.w / base.w).toBeCloseTo(1.1, 5);
    expect(out.h / base.h).toBeCloseTo(1.1, 5);
    expect(bigger.units).toBe('mm');
    // Only the metric map changes — the on-photo overlay is untouched.
    expect(bigger.shapes[0].imagePoints).toBe(result.value.shapes[0].imagePoints);
  });

  it('scales each axis independently, so a wrong side only skews that side', () => {
    const result = traced();
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const base = bbox(result.value.shapes[0].outputPoints);
    const longer = withCardSize(result.value, CARD_WIDTH_MM * 1.1, CARD_HEIGHT_MM);

    const out = bbox(longer.shapes[0].outputPoints);
    expect(out.w / base.w).toBeCloseTo(1.1, 5);
    expect(out.h / base.h).toBeCloseTo(1, 5);
  });

  it('leaves a card-less trace in pixel units', () => {
    const result = traceScene(render(false));
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const rescaled = withCardSize(result.value, 100, 60);
    expect(rescaled).toBe(result.value);
    expect(rescaled.units).toBe('px');
  });
});

describe('traceSceneSegmented excludes the tool from card detection', () => {
  // Two card-aspect rectangles: the real card (left) and a slightly-larger
  // rectangular tool (right). The tool sits higher, so it labels first and a
  // naive whole-image card search picks IT — the reported failure. The tool
  // mask should keep that from happening.
  const W = 360;
  const H = 260;
  const CARD = { x0: 30, y0: 100, x1: 130, y1: 163 }; // 100×63 ≈ 1.587
  const TOOL = { x0: 210, y0: 80, x1: 330, y1: 168 }; // 120×88 ≈ 1.36

  const inRect = (x: number, y: number, r: typeof CARD): boolean =>
    x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

  function scene(): ImageDataLike {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const v = inRect(x, y, CARD) ? 235 : inRect(x, y, TOOL) ? 150 : 15;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  }

  function toolMask(): SoftMask {
    const data = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (inRect(x, y, TOOL)) data[y * W + x] = 1;
    }
    return { width: W, height: H, data };
  }

  const centroidX = (pts: readonly Point[]): number =>
    pts.reduce((s, p) => s + p.x, 0) / pts.length;

  it('a whole-image search picks the wrong rectangle (the tool)', () => {
    const card = detectCard(scene());
    expect(card).not.toBeNull();
    if (!card) return;
    expect(centroidX(card.corners)).toBeGreaterThan(W / 2); // the right-hand tool
  });

  it('excluding the tool mask picks the real card instead', () => {
    const card = detectCard(scene(), {}, binarize(toolMask()));
    expect(card).not.toBeNull();
    if (!card) return;
    expect(centroidX(card.corners)).toBeLessThan(W / 2); // the left-hand card
  });

  it('rectifies the tool to true mm via the real card', () => {
    const result = traceSceneSegmented(scene(), toolMask(), { smooth: false });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.units).toBe('mm');
    expect(centroidX(result.value.card?.corners ?? [{ x: 0, y: 0 }])).toBeLessThan(W / 2);
  });
});

describe('buildToolTraceSoft', () => {
  const W = 80;
  const H = 60;

  it('traces a soft mask into a closed outline with sub-pixel vertices', () => {
    // Interior fully foreground; a one-pixel ramp on the left edge so the 0.5
    // crossing lands at a fractional x (proving sub-pixel, not pixel-snapped).
    const data = new Float32Array(W * H);
    for (let y = 15; y <= 45; y++) {
      for (let x = 20; x <= 60; x++) data[y * W + x] = 1;
      data[y * W + 19] = 0.25; // ramp: crosses 0.5 between x=19 and x=20 → x≈19.33
    }
    const r = buildToolTraceSoft({ width: W, height: H, data }, null, { smooth: false });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.units).toBe('px');
    expect(r.value.shapes[0].imagePoints.length).toBeGreaterThanOrEqual(4);
    const minX = Math.min(...r.value.shapes[0].imagePoints.map((p) => p.x));
    expect(Number.isInteger(minX)).toBe(false);
  });

  it('reports NO_OBJECT for an empty soft mask', () => {
    const r = buildToolTraceSoft({ width: W, height: H, data: new Float32Array(W * H) }, null, {});
    expect(isOk(r)).toBe(false);
  });
});

describe('withCardSize on several tools', () => {
  it('rescales every tool by the same card', () => {
    const result = traceScene(render(true, 360, 260, [TOOL_MM, BAR_MM]), { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');
    const longer = withCardSize(result.value, CARD_WIDTH_MM * 1.1, CARD_HEIGHT_MM * 1.1);
    result.value.shapes.forEach((shape, i) => {
      const before = bbox(shape.outputPoints);
      const after = bbox(longer.shapes[i].outputPoints);
      expect(after.w / before.w).toBeCloseTo(1.1, 1);
      expect(after.h / before.h).toBeCloseTo(1.1, 1);
    });
  });
});

describe('sameReference', () => {
  const card = (dx: number): SceneReference => ({
    kind: 'card',
    card: {
      corners: [
        { x: 10 + dx, y: 10 },
        { x: 90 + dx, y: 10 },
        { x: 90 + dx, y: 60 },
        { x: 10 + dx, y: 60 },
      ],
      fitness: 1,
    },
  });

  it('matches a card found at the same corners', () => {
    expect(sameReference(card(0), card(0.2))).toBe(true);
    expect(sameReference(null, null)).toBe(true);
  });

  it('tells a card found elsewhere, or none, apart', () => {
    expect(sameReference(card(0), card(30))).toBe(false);
    expect(sameReference(card(0), null)).toBe(false);
  });
});

describe('withReference', () => {
  it('keeps the outlines, sizes them by the new card and drops the card itself', () => {
    const traced = traceScene(render(true, 360, 260, [TOOL_MM, BAR_MM]), { smooth: false });
    if (!isOk(traced) || !traced.value.reference) throw new Error('fixture failed');
    const unsized: SceneReference | null = null;
    const pixels = withReference(traced.value, unsized);
    expect(pixels.units).toBe('px');
    expect(pixels.shapes.map((s) => s.imagePoints)).toEqual(
      traced.value.shapes.map((s) => s.imagePoints)
    );

    // Sized again by the same card, from a scene that had traced it as a tool.
    const withCardAsTool = {
      ...pixels,
      shapes: [...pixels.shapes, { imagePoints: project(CARD_MM), outputPoints: [] }],
    };
    const resized = withReference(withCardAsTool, traced.value.reference);
    expect(resized.units).toBe('mm');
    expect(resized.shapes).toEqual(traced.value.shapes);
  });
});

describe('traceScene holes', () => {
  // A 40 × 40 mm ring with a 24 × 24 mm hole, right of the card.
  const RING_MM: Point[] = [
    { x: 55, y: -20 },
    { x: 95, y: -20 },
    { x: 95, y: 20 },
    { x: 55, y: 20 },
  ];
  const HOLE_MM: Point[] = [
    { x: 63, y: -12 },
    { x: 87, y: -12 },
    { x: 87, y: 12 },
    { x: 63, y: 12 },
  ];
  // A 12 × 12 mm piece resting in the hole, clear of the ring all round.
  const NUT_MM: Point[] = [
    { x: 69, y: -6 },
    { x: 81, y: -6 },
    { x: 81, y: 6 },
    { x: 69, y: 6 },
  ];

  function renderRing(withNut: boolean): ImageDataLike {
    const W = 360;
    const H = 260;
    const card = project(CARD_MM);
    const ring = project(RING_MM);
    const hole = project(HOLE_MM);
    const nut = project(NUT_MM);
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const at = { x, y };
        const inTool =
          (pointInPolygon(at, ring) && !pointInPolygon(at, hole)) ||
          (withNut && pointInPolygon(at, nut));
        const v = pointInPolygon(at, card) ? 235 : inTool ? 150 : 15;
        const o = (y * W + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  }

  it('traces a ring with its hole, both to true millimetres', () => {
    const result = traceScene(renderRing(false), { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');
    const [ring] = result.value.shapes;
    expect(ring.holes).toHaveLength(1);
    const outer = bbox(ring.outputPoints);
    const hole = bbox(ring.holes?.[0].outputPoints ?? []);
    expect(Math.abs(outer.w - 40)).toBeLessThan(2.5);
    expect(Math.abs(hole.w - 24)).toBeLessThan(2.5);
    expect(Math.abs(hole.h - 24)).toBeLessThan(2.5);
  });

  // No reference, so widths are pixels: a 5px slit, the size of a glint on a
  // shiny tool, is too narrow to leave an island; a 30px window is not.
  it('drops a hole too narrow to leave an island standing', () => {
    const W = 200;
    const H = 200;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tool = x >= 20 && x < 180 && y >= 20 && y < 180;
        const slit = x >= 40 && x < 45 && y >= 40 && y < 160;
        const window = x >= 100 && x < 130 && y >= 80 && y < 110;
        const v = tool && !slit && !window ? 40 : 220;
        const o = (y * W + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    const result = traceScene({ width: W, height: H, data }, { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');
    const holes = result.value.shapes[0].holes ?? [];
    expect(holes).toHaveLength(1);
    expect(bbox(holes[0].outputPoints).w).toBeGreaterThan(25);
  });

  it('flags a tool resting in the hole rather than dropping it', () => {
    const result = traceScene(renderRing(true), { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');
    const flags = result.value.shapes.map((s) => s.inHole === true);
    expect(flags).toEqual([false, true]);
  });

  it('re-sizes the hole with the outline when the card is measured', () => {
    const result = traceScene(renderRing(false), { smooth: false });
    if (!isOk(result)) throw new Error('fixture failed');
    const longer = withCardSize(result.value, CARD_WIDTH_MM * 1.1, CARD_HEIGHT_MM * 1.1);
    const before = bbox(result.value.shapes[0].holes?.[0].outputPoints ?? []);
    const after = bbox(longer.shapes[0].holes?.[0].outputPoints ?? []);
    expect(after.w / before.w).toBeCloseTo(1.1, 1);
  });
});
