import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { paperReference, rulerReference, PAPER_SIZES, MIN_RULER_PX } from './manualReference';
import { sameReference, traceScene, withReference, type SceneTrace } from './traceScene';
import type { ImageDataLike, Point } from './types';

// A tilted pinhole camera over the table, far enough back to frame a sheet.
const F = 600;
const DIST = 900;
const W = 400;
const H = 300;

function camera(tiltX: number, tiltY: number) {
  const [cx, sx, cy, sy] = [Math.cos(tiltX), Math.sin(tiltX), Math.cos(tiltY), Math.sin(tiltY)];
  return (p: Point): Point => {
    const xc = cy * p.x;
    const yc = sx * sy * p.x + cx * p.y;
    const zc = -cx * sy * p.x + sx * p.y + DIST;
    return { x: (F * xc) / zc + W / 2, y: (F * yc) / zc + H / 2 };
  };
}

const cam = camera(0.25, 0.15);
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

// An A4 sheet, landscape, centred under the camera, and a 60 × 25 mm tool on it.
const SHEET_MM = rect(-148.5, -105, 148.5, 105);
const TOOL_MM = rect(-30, -12.5, 30, 12.5);
const SHEET_PX = SHEET_MM.map(cam);

function inside(p: Point, poly: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

function render(polys: readonly { readonly poly: readonly Point[]; readonly v: number }[]) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      let v = 40;
      for (const { poly, v: value } of polys) if (inside({ x, y }, poly)) v = value;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data } satisfies ImageDataLike;
}

const size = (points: readonly Point[]) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

const signedArea = (points: readonly Point[]): number =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;

const sceneOf = (imagePoints: readonly Point[]): SceneTrace => ({
  shapes: [{ imagePoints, outputPoints: imagePoints }],
  units: 'px',
  card: null,
  grid: null,
  reference: null,
});

describe('rulerReference', () => {
  it('sizes outlines by the marked length over the marked pixels', () => {
    const ruler = rulerReference({ x: 10, y: 10 }, { x: 210, y: 10 }, 100);
    expect(ruler).not.toBeNull();
    const sized = withReference(sceneOf(rect(0, 0, 400, 60)), ruler);
    expect(sized.units).toBe('mm');
    const { w, h } = size(sized.shapes[0].outputPoints);
    expect(w).toBeCloseTo(200);
    expect(h).toBeCloseTo(30);
  });

  it('takes no length that is not a positive number, and no slip of a ruler', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    expect(rulerReference(a, b, 0)).toBeNull();
    expect(rulerReference(a, b, -5)).toBeNull();
    expect(rulerReference(a, b, Number.NaN)).toBeNull();
    expect(rulerReference(a, { x: MIN_RULER_PX - 1, y: 0 }, 50)).toBeNull();
  });

  it('is the same ruler only with the same ends and length', () => {
    const ruler = rulerReference({ x: 0, y: 0 }, { x: 100, y: 0 }, 50);
    expect(sameReference(ruler, rulerReference({ x: 0, y: 0 }, { x: 100, y: 0 }, 50))).toBe(true);
    expect(sameReference(ruler, rulerReference({ x: 0, y: 0 }, { x: 100, y: 0 }, 51))).toBe(false);
    expect(sameReference(ruler, rulerReference({ x: 0, y: 0 }, { x: 120, y: 0 }, 50))).toBe(false);
  });
});

describe('paperReference', () => {
  it('rectifies a tool on a tilted sheet to true millimetres', () => {
    const paper = paperReference(SHEET_PX, 'a4');
    const sized = withReference(sceneOf(TOOL_MM.map(cam)), paper);
    const { w, h } = size(sized.shapes[0].outputPoints);
    expect(w).toBeCloseTo(60, 0);
    expect(h).toBeCloseTo(25, 0);
  });

  // Clicked counter-clockwise from the bottom right: the same sheet, the right way round.
  it('reads the corners in any click order without mirroring the tool', () => {
    const shuffled = [SHEET_PX[2], SHEET_PX[1], SHEET_PX[0], SHEET_PX[3]];
    const tool: Point[] = [
      { x: -30, y: -12.5 },
      { x: 30, y: -12.5 },
      { x: 30, y: 12.5 },
      { x: -10, y: 12.5 },
      { x: -10, y: 30 },
      { x: -30, y: 30 },
    ];
    const paper = paperReference(shuffled, 'a4');
    const out = withReference(sceneOf(tool.map(cam)), paper).shapes[0].outputPoints;
    expect(Math.sign(signedArea(out))).toBe(Math.sign(signedArea(tool)));
    expect(signedArea(out)).toBeCloseTo(signedArea(tool), -1);
  });

  it('turns no sheet up from a dented quad, three points or a speck', () => {
    expect(paperReference(SHEET_PX.slice(0, 3), 'a4')).toBeNull();
    // Pulled in past the diagonal from the bottom right corner.
    const pit = { x: (SHEET_PX[0].x + 200) / 2, y: (SHEET_PX[0].y + 150) / 2 };
    const dented = [SHEET_PX[0], SHEET_PX[1], pit, SHEET_PX[3]];
    expect(paperReference(dented, 'a4')).toBeNull();
    expect(paperReference(rect(10, 10, 20, 20), 'letter')).toBeNull();
  });

  it('carries the chosen sheet size', () => {
    const paper = paperReference(SHEET_PX, 'letter');
    expect(paper?.kind === 'paper' && paper.paper.longMm).toBe(PAPER_SIZES.letter.longMm);
    expect(sameReference(paper, paperReference(SHEET_PX, 'a4'))).toBe(false);
  });

  // The table around the sheet is darker than the paper, so searched as a
  // whole the frame reads the white sheet as one giant tool.
  it('looks for tools on the sheet only', () => {
    const image = render([
      { poly: SHEET_PX, v: 235 },
      { poly: TOOL_MM.map(cam), v: 120 },
    ]);
    const paper = paperReference(SHEET_PX, 'a4');
    const traced = traceScene(image, { smooth: false }, paper);
    if (!isOk(traced)) throw new Error('fixture failed');
    expect(traced.value.shapes).toHaveLength(1);
    const { w, h } = size(traced.value.shapes[0].outputPoints);
    expect(Math.abs(w - 60)).toBeLessThan(3);
    expect(Math.abs(h - 25)).toBeLessThan(3);
  });
});

describe('traceScene region', () => {
  it('traces only the tools inside a drawn region', () => {
    const left = rect(40, 100, 120, 140);
    const right = rect(260, 100, 340, 160);
    const image = render([
      { poly: left, v: 200 },
      { poly: right, v: 200 },
    ]);
    const all = traceScene(image, { smooth: false }, null);
    const one = traceScene(image, { smooth: false, region: rect(200, 60, 390, 200) }, null);
    if (!isOk(all) || !isOk(one)) throw new Error('fixture failed');
    expect(all.value.shapes).toHaveLength(2);
    expect(one.value.shapes).toHaveLength(1);
    expect(size(one.value.shapes[0].outputPoints).w).toBeCloseTo(80, -1);
  });
});
