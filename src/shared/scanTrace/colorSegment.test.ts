import { describe, it, expect } from 'vitest';
import { fillPolygon, kernelSize, scoreThreshold, segmentTools } from './colorSegment';
import { labelComponents } from './components';
import type { ImageDataLike, Mask, Point } from './types';

type Rgb = readonly [number, number, number];

/** A frame painted back to front: each layer wins inside its own test. */
function paint(
  width: number,
  height: number,
  background: (x: number, y: number) => Rgb,
  layers: readonly {
    readonly inside: (x: number, y: number) => boolean;
    readonly rgb: (x: number, y: number, under: Rgb) => Rgb;
  }[],
  alpha?: (x: number, y: number) => number
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rgb = background(x, y);
      for (const layer of layers) if (layer.inside(x, y)) rgb = layer.rgb(x, y, rgb);
      const o = (y * width + x) * 4;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = alpha ? alpha(x, y) : 255;
    }
  }
  return { width, height, data };
}

const rect =
  (x0: number, y0: number, x1: number, y1: number) =>
  (x: number, y: number): boolean =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1;

const solid = (rgb: Rgb) => (): Rgb => rgb;

const at = (mask: Mask, x: number, y: number): number => mask.data[y * mask.width + x];

function countIn(mask: Mask, inside: (x: number, y: number) => boolean): number {
  let n = 0;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) if (inside(x, y) && at(mask, x, y) === 1) n++;
  }
  return n;
}

function area(inside: (x: number, y: number) => boolean, width: number, height: number): number {
  let n = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (inside(x, y)) n++;
  return n;
}

const pieces = (mask: Mask) => labelComponents(mask).components.filter((c) => c.area > 20);

// Light falls off left to right by 50 grey levels: a threshold on raw
// brightness would call the dim side an object.
const litTable = (x: number): Rgb => {
  const v = Math.round(225 - (50 * x) / 320);
  return [v, v - 4, v - 12];
};

describe('segmentTools', () => {
  it('keeps a grey tool and drops its own cast shadow', () => {
    const W = 320;
    const H = 240;
    const tool = rect(90, 80, 190, 140);
    // Offset down-right, darker but the same colour as the table under it.
    const shadow = rect(100, 90, 210, 165);
    const image = paint(W, H, (x) => litTable(x), [
      {
        inside: shadow,
        rgb: (_x, _y, under) => [under[0] - 30, under[1] - 30, under[2] - 30],
      },
      { inside: tool, rgb: solid([70, 72, 78]) },
    ]);

    const mask = segmentTools(image);

    expect(countIn(mask, tool)).toBeGreaterThan(0.97 * area(tool, W, H));
    const shadowOnly = (x: number, y: number) => shadow(x, y) && !tool(x, y);
    expect(countIn(mask, shadowOnly)).toBeLessThan(0.03 * area(shadowOnly, W, H));
    expect(pieces(mask)).toHaveLength(1);
  });

  // A muted tool barely darker than the table, beside a shadow darker than it.
  // Weighted the same as colour, the shadow's lightness would put it level
  // with the tool and the threshold would take both.
  it('drops a shadow darker than a muted tool', () => {
    const W = 320;
    const H = 240;
    const tool = rect(90, 80, 190, 140);
    const shadow = rect(130, 100, 230, 160);
    const image = paint(W, H, solid([200, 200, 200]), [
      { inside: shadow, rgb: solid([165, 165, 165]) },
      { inside: tool, rgb: solid([180, 175, 155]) },
    ]);

    const mask = segmentTools(image);

    expect(countIn(mask, tool)).toBeGreaterThan(0.97 * area(tool, W, H));
    const shadowOnly = (x: number, y: number) => shadow(x, y) && !tool(x, y);
    expect(countIn(mask, shadowOnly)).toBeLessThan(0.03 * area(shadowOnly, W, H));
  });

  it('ignores light falling off across the frame', () => {
    const W = 320;
    const H = 240;
    const tool = rect(130, 90, 190, 150);
    const image = paint(
      W,
      H,
      (x) => {
        const v = Math.round(235 - (110 * x) / W);
        return [v, v, v];
      },
      [{ inside: tool, rgb: solid([180, 175, 155]) }]
    );

    const mask = segmentTools(image);

    expect(countIn(mask, tool)).toBeGreaterThan(0.97 * area(tool, W, H));
    expect(countIn(mask, (x, y) => !tool(x, y))).toBe(0);
  });

  // Orange scores three times what black does. Counted at full weight, the
  // threshold would fall between the two and lose the black tool.
  it('keeps a black tool beside a saturated orange one', () => {
    const W = 320;
    const H = 240;
    const black = rect(40, 60, 110, 180);
    const orange = rect(200, 60, 270, 180);
    const image = paint(W, H, solid([235, 235, 235]), [
      { inside: black, rgb: solid([30, 30, 30]) },
      { inside: orange, rgb: solid([240, 110, 20]) },
    ]);

    const mask = segmentTools(image);

    expect(countIn(mask, black)).toBeGreaterThan(0.97 * area(black, W, H));
    expect(countIn(mask, orange)).toBeGreaterThan(0.97 * area(orange, W, H));
  });

  it('keeps two tools apart when a stray line joins them', () => {
    const W = 320;
    const H = 240;
    const left = rect(40, 60, 120, 180);
    const right = rect(200, 60, 280, 180);
    const line = rect(121, 120, 199, 120);
    const red = solid([170, 40, 40]);
    const image = paint(W, H, solid([215, 210, 200]), [
      { inside: left, rgb: red },
      { inside: right, rgb: red },
      { inside: line, rgb: red },
    ]);

    const mask = segmentTools(image);

    expect(pieces(mask)).toHaveLength(2);
    expect(countIn(mask, line)).toBe(0);
  });

  // Too narrow to hold a solid square, the second tool is still a tool, and
  // the line joining it to the first must not be given back.
  it('keeps a narrow tool apart from its neighbour when a stray line joins them', () => {
    const W = 320;
    const H = 240;
    const wide = rect(40, 60, 120, 180);
    const narrow = rect(180, 60, 184, 180);
    const line = rect(121, 120, 179, 120);
    const red = solid([170, 40, 40]);
    const image = paint(W, H, solid([215, 210, 200]), [
      { inside: wide, rgb: red },
      { inside: narrow, rgb: red },
      { inside: line, rgb: red },
    ]);

    const mask = segmentTools(image);

    expect(pieces(mask)).toHaveLength(2);
    expect(countIn(mask, line)).toBe(0);
  });

  // The blade is wide enough to survive the cleanup on its own, so the shaft
  // touches two pieces; it still rejoins the handle, bringing the blade.
  it('gives back a flathead shaft together with its blade tip', () => {
    const W = 320;
    const H = 240;
    const handle = rect(30, 90, 110, 150);
    const shaft = rect(111, 119, 260, 120);
    const blade = rect(261, 117, 274, 122);
    const blue = solid([40, 60, 170]);
    const image = paint(W, H, solid([220, 215, 205]), [
      { inside: handle, rgb: blue },
      { inside: shaft, rgb: blue },
      { inside: blade, rgb: blue },
    ]);

    const mask = segmentTools(image);

    expect(countIn(mask, shaft)).toBe(area(shaft, W, H));
    expect(pieces(mask)).toHaveLength(1);
  });

  it('gives back a thin shaft the cleanup erased', () => {
    const W = 320;
    const H = 240;
    const handle = rect(30, 90, 110, 150);
    // Two pixels wide: an opening with the three-pixel kernel erases it.
    const shaft = rect(111, 119, 290, 120);
    const blue = solid([40, 60, 170]);
    const image = paint(W, H, solid([220, 215, 205]), [
      { inside: handle, rgb: blue },
      { inside: shaft, rgb: blue },
    ]);

    const mask = segmentTools(image);

    expect(countIn(mask, shaft)).toBe(area(shaft, W, H));
    expect(pieces(mask)).toHaveLength(1);
  });

  it('drops a speck touching nothing', () => {
    const W = 320;
    const H = 240;
    const tool = rect(60, 60, 160, 160);
    const speck = rect(250, 200, 251, 201);
    const green = solid([40, 150, 60]);
    const image = paint(W, H, solid([220, 215, 205]), [
      { inside: tool, rgb: green },
      { inside: speck, rgb: green },
    ]);

    expect(countIn(segmentTools(image), speck)).toBe(0);
  });

  it('samples the surface inside the region, not the table around it', () => {
    const W = 360;
    const H = 300;
    const paper = rect(40, 30, 320, 270);
    const markers = [
      rect(50, 40, 70, 60),
      rect(290, 40, 310, 60),
      rect(50, 240, 70, 260),
      rect(290, 240, 310, 260),
    ];
    const tool = rect(140, 110, 220, 190);
    const image = paint(W, H, solid([90, 70, 50]), [
      { inside: paper, rgb: solid([245, 245, 240]) },
      ...markers.map((inside) => ({ inside, rgb: solid([15, 15, 15] as Rgb) })),
      { inside: tool, rgb: solid([110, 110, 115]) },
    ]);
    const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];

    const mask = segmentTools(image, {
      region: square(50, 40, 310, 260),
      // Detected a little inside the printed squares, as a real detector can be.
      exclude: [
        square(53, 43, 67, 57),
        square(293, 43, 307, 57),
        square(53, 243, 67, 257),
        square(293, 243, 307, 257),
      ],
    });

    expect(pieces(mask)).toHaveLength(1);
    expect(countIn(mask, tool)).toBeGreaterThan(0.97 * area(tool, W, H));
    expect(countIn(mask, (x, y) => !tool(x, y))).toBe(0);
  });

  it('takes in more of a faint tool as the sensitivity rises', () => {
    const W = 320;
    const H = 240;
    const strong = rect(30, 60, 130, 180);
    const faint = rect(190, 60, 290, 180);
    const image = paint(W, H, solid([200, 200, 200]), [
      { inside: strong, rgb: solid([40, 40, 40]) },
      { inside: faint, rgb: solid([175, 175, 175]) },
    ]);

    const faintAt = (sensitivity: number) => countIn(segmentTools(image, { sensitivity }), faint);

    expect(faintAt(-100)).toBe(0);
    expect(faintAt(110)).toBe(area(faint, W, H));
  });

  it('uses a cut-out photo’s alpha as the mask', () => {
    const W = 120;
    const H = 100;
    const tool = rect(30, 20, 90, 80);
    const image = paint(W, H, solid([0, 0, 0]), [], (x, y) => (tool(x, y) ? 255 : 0));

    const mask = segmentTools(image);

    expect(countIn(mask, tool)).toBe(area(tool, W, H));
    expect(countIn(mask, (x, y) => !tool(x, y))).toBe(0);
  });

  it('returns an empty mask for an empty image', () => {
    const mask = segmentTools({ width: 0, height: 0, data: new Uint8ClampedArray(0) });
    expect(mask.data).toHaveLength(0);
  });
});

describe('scoreThreshold', () => {
  const bimodal = Uint8Array.from([...Array(500).fill(2), ...Array(100).fill(60)]);

  it('cuts between the surface and the tool at zero sensitivity', () => {
    const t = scoreThreshold(bimodal);
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(60);
  });

  it('scales the cut down as sensitivity rises and up as it falls', () => {
    expect(scoreThreshold(bimodal, 64)).toBeLessThan(scoreThreshold(bimodal));
    expect(scoreThreshold(bimodal, -64)).toBeGreaterThan(scoreThreshold(bimodal));
  });

  it('stays within 1 to 254', () => {
    expect(scoreThreshold(bimodal, 128)).toBe(1);
    expect(scoreThreshold(Uint8Array.from([0, 255]), -127)).toBeLessThanOrEqual(254);
  });
});

describe('kernelSize', () => {
  it('is odd and at least 3', () => {
    expect(kernelSize(320, 240)).toBe(3);
    expect(kernelSize(1280, 1200)).toBe(5);
    expect(kernelSize(4000, 3000) % 2).toBe(1);
  });
});

describe('fillPolygon', () => {
  it('fills pixel centres inside, counting the top edge and not the bottom', () => {
    const fill = fillPolygon(
      [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 3 },
        { x: 1, y: 3 },
      ],
      6,
      5
    );
    const count = fill.reduce((s, v) => s + v, 0);
    expect(count).toBe(8);
  });
});
