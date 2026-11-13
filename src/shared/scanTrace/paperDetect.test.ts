import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { findPaper } from './paperDetect';
import { detectReference, traceScene } from './traceScene';
import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from './cardDetect';
import type { ImageDataLike, Point } from './types';

const F = 900;
const DIST = 900;
const W = 640;
const H = 480;

function camera(tiltX: number, tiltY: number, dist = DIST) {
  const [cx, sx, cy, sy] = [Math.cos(tiltX), Math.sin(tiltX), Math.cos(tiltY), Math.sin(tiltY)];
  return (p: Point): Point => {
    const xc = cy * p.x;
    const yc = sx * sy * p.x + cx * p.y;
    const zc = -cx * sy * p.x + sx * p.y + dist;
    return { x: (F * xc) / zc + W / 2, y: (F * yc) / zc + H / 2 };
  };
}

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

const A4 = rect(-148.5, -105, 148.5, 105);
const A4_UPRIGHT = rect(-105, -148.5, 105, 148.5);
const LETTER = rect(-139.7, -107.95, 139.7, 107.95);
const TOOL = rect(-40, -10, 40, 10);

const TABLE = [70, 55, 40] as const;
const PAPER = [238, 238, 232] as const;
const RED = [200, 60, 40] as const;

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

/** Later layers paint over earlier ones; each is a polygon in millimetres. */
function render(
  cam: (p: Point) => Point,
  layers: readonly (readonly [readonly Point[], readonly [number, number, number]])[],
  table: readonly [number, number, number] = TABLE
): ImageDataLike {
  const drawn = layers.map(([poly, colour]) => [poly.map(cam), colour] as const);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let colour = table;
      for (const [poly, c] of drawn) if (inside({ x, y }, poly)) colour = c;
      const o = (y * W + x) * 4;
      data[o] = colour[0];
      data[o + 1] = colour[1];
      data[o + 2] = colour[2];
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

/** A phone photo's flaws: light falling off to one side, a soft focus, and sensor noise. */
function degraded(image: ImageDataLike): ImageDataLike {
  const { width, height, data } = image;
  const lit = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gain = 0.72 + (0.28 * (x + y)) / (width + height);
      for (let c = 0; c < 3; c++)
        lit[(y * width + x) * 4 + c] = data[(y * width + x) * 4 + c] * gain;
    }
  }
  const out = new Uint8ClampedArray(data.length);
  let seed = 7;
  const noise = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff - 0.5) * 12;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            sum += lit[(yy * width + xx) * 4 + c];
            count++;
          }
        }
        out[(y * width + x) * 4 + c] = sum / count + noise();
      }
      out[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { width, height, data: out };
}

function size(points: readonly Point[]): [number, number] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return [Math.max(w, h), Math.min(w, h)];
}

const flat = camera(0, 0);
const tilted = camera(0.15, 0.1);

describe('findPaper', () => {
  it.each([
    ['A4, straight down', A4, flat, 'a4'],
    ['A4, tilted', A4, tilted, 'a4'],
    ['A4 upright', A4_UPRIGHT, camera(0.1, -0.12, 1100), 'a4'],
    ['US Letter, straight down', LETTER, flat, 'letter'],
    ['US Letter, tilted', LETTER, tilted, 'letter'],
  ] as const)('reads %s by its shape', (_name, sheet, cam, expected) => {
    const found = findPaper(
      render(cam, [
        [sheet, PAPER],
        [TOOL, RED],
      ])
    );
    expect(found?.size).toBe(expected);
    const truth = sheet.map(cam);
    for (const corner of found?.corners ?? []) {
      expect(
        Math.min(...truth.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)))
      ).toBeLessThan(1);
    }
  });

  it('keeps its corners when a tool lies across an edge', () => {
    const across = rect(100, -8, 190, 8);
    const found = findPaper(
      render(tilted, [
        [A4, PAPER],
        [across, RED],
      ])
    );
    expect(found?.size).toBe('a4');
    const truth = A4.map(tilted);
    for (const corner of found?.corners ?? []) {
      expect(
        Math.min(...truth.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)))
      ).toBeLessThan(1);
    }
  });

  it('reads a sheet that a tool lying right across cuts in two', () => {
    const across = rect(-10, -125, 10, 125);
    const image = render(tilted, [
      [A4, PAPER],
      [across, RED],
    ]);
    const found = findPaper(image);
    expect(found?.size).toBe('a4');
    const truth = A4.map(tilted);
    for (const corner of found?.corners ?? []) {
      expect(
        Math.min(...truth.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)))
      ).toBeLessThan(1);
    }
    expect(detectReference(image)?.kind).toBe('paper');
  });

  it('takes no two white things apart for one sheet', () => {
    expect(
      findPaper(
        render(flat, [
          [rect(-200, -105, -100, 105), PAPER],
          [rect(100, -105, 200, 105), PAPER],
        ])
      )
    ).toBeNull();
  });

  it('reads a sheet on a pale wooden table through uneven light, blur and noise', () => {
    const found = findPaper(
      degraded(
        render(
          tilted,
          [
            [LETTER, PAPER],
            [TOOL, RED],
            [rect(60, 40, 110, 70), [40, 40, 45]],
          ],
          [176, 138, 96]
        )
      )
    );
    expect(found?.size).toBe('letter');
    const truth = LETTER.map(tilted);
    for (const corner of found?.corners ?? []) {
      expect(
        Math.min(...truth.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)))
      ).toBeLessThan(1.5);
    }
  });

  it('takes no sheet the photo cuts off', () => {
    expect(
      findPaper(
        render(camera(0, 0, 380), [
          [A4, PAPER],
          [TOOL, RED],
        ])
      )
    ).toBeNull();
  });

  it('takes no white table for a sheet', () => {
    expect(findPaper(render(flat, [[TOOL, RED]], PAPER))).toBeNull();
  });

  it('takes no wallet card for a sheet', () => {
    const card = rect(
      -CARD_WIDTH_MM / 2,
      -CARD_HEIGHT_MM / 2,
      CARD_WIDTH_MM / 2,
      CARD_HEIGHT_MM / 2
    );
    expect(findPaper(render(camera(0.1, 0.05, 300), [[card, PAPER]]))).toBeNull();
  });

  it('takes no coloured sheet for paper', () => {
    expect(findPaper(render(flat, [[A4, [240, 200, 90]]]))).toBeNull();
  });

  it('takes no square sheet for paper', () => {
    expect(findPaper(render(flat, [[rect(-105, -105, 105, 105), PAPER]]))).toBeNull();
  });
});

describe('a plain sheet as the size reference', () => {
  it.each([
    ['A4', A4, tilted],
    ['US Letter', LETTER, tilted],
    ['A4 from straight above', A4, flat],
  ] as const)('sizes a tool on %s to true millimetres', (_name, sheet, cam) => {
    const image = render(cam, [
      [sheet, PAPER],
      [TOOL, RED],
    ]);
    expect(detectReference(image)?.kind).toBe('paper');
    const traced = traceScene(image, { smooth: false });
    if (!isOk(traced)) throw new Error(traced.error.code);
    expect(traced.value.units).toBe('mm');
    expect(traced.value.shapes).toHaveLength(1);
    // The binary trace runs through pixel centres, a pixel (1 mm here) inside in all.
    const [long, short] = size(traced.value.shapes[0].outputPoints);
    expect(long).toBeGreaterThan(78.5);
    expect(long).toBeLessThan(80.5);
    expect(short).toBeGreaterThan(18.5);
    expect(short).toBeLessThan(20.5);
  });

  it('sizes by the sheet the user names over the one its shape reads as', () => {
    const image = render(flat, [
      [A4, PAPER],
      [TOOL, RED],
    ]);
    const read = traceScene(image, { smooth: false });
    const named = traceScene(image, { smooth: false, paper: 'letter' });
    if (!isOk(read) || !isOk(named)) throw new Error('fixture failed');
    const [asA4] = size(read.value.shapes[0].outputPoints);
    const [asLetter] = size(named.value.shapes[0].outputPoints);
    expect(asLetter / asA4).toBeCloseTo(279.4 / 297, 2);
  });

  it('reads a sheet turned off as neither paper nor a card', () => {
    const image = render(tilted, [
      [A4, PAPER],
      [TOOL, RED],
    ]);
    expect(detectReference(image, { paper: 'off' })).toBeNull();
  });

  it('still finds a card beside a sheet turned off', () => {
    const card = rect(160, -27, 160 + CARD_WIDTH_MM, -27 + CARD_HEIGHT_MM);
    const image = render(camera(0.05, 0.05, 1000), [
      [A4, PAPER],
      [TOOL, RED],
      [card, [225, 225, 225]],
    ]);
    expect(detectReference(image)?.kind).toBe('paper');
    expect(detectReference(image, { paper: 'off' })?.kind).toBe('card');
  });

  it('still finds a card lying on a sheet turned off', () => {
    const card = rect(40, 20, 40 + CARD_WIDTH_MM, 20 + CARD_HEIGHT_MM);
    const image = render(
      camera(0.05, 0.05, 700),
      [
        [A4, PAPER],
        [rect(-120, -60, -40, -40), [40, 40, 40]],
        [card, [30, 90, 200]],
      ],
      [60, 60, 60]
    );
    expect(detectReference(image)?.kind).toBe('paper');
    const reference = detectReference(image, { paper: 'off' });
    expect(reference?.kind).toBe('card');
    if (reference?.kind !== 'card') return;
    const truth = card.map(camera(0.05, 0.05, 700));
    for (const corner of reference.card.corners) {
      expect(
        Math.min(...truth.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)))
      ).toBeLessThan(3);
    }
  });

  it('marks a tool that runs past the sheet, whose outline stops at the edge', () => {
    const image = render(tilted, [
      [A4, PAPER],
      [rect(90, 40, 200, 60), RED],
      [TOOL, RED],
    ]);
    const traced = traceScene(image, { smooth: false });
    if (!isOk(traced)) throw new Error(traced.error.code);
    const [long, short] = [...traced.value.shapes].sort(
      (a, b) => size(b.outputPoints)[0] - size(a.outputPoints)[0]
    );
    expect(size(long.outputPoints)[0]).toBeGreaterThan(70);
    expect(traced.value.shapes).toHaveLength(2);
    const [across, within] = traced.value.shapes[0].offSheet
      ? traced.value.shapes
      : [traced.value.shapes[1], traced.value.shapes[0]];
    expect(across.offSheet).toBe(true);
    expect(within.offSheet).toBeUndefined();
    expect(short).toBeDefined();
  });

  it('leaves a card on a plain table as the reference', () => {
    const card = rect(
      -CARD_WIDTH_MM / 2,
      -CARD_HEIGHT_MM / 2,
      CARD_WIDTH_MM / 2,
      CARD_HEIGHT_MM / 2
    );
    const image = render(camera(0.1, 0.05, 420), [
      [card, PAPER],
      [rect(70, -30, 90, 30), RED],
    ]);
    expect(detectReference(image)?.kind).toBe('card');
  });
});
