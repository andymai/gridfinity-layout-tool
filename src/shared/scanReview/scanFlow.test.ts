import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as ScanTrace from '@/shared/scanTrace';
import { err, ok } from '@/core/result';
import type { SceneReference, SceneShape, SceneTrace } from '@/shared/scanTrace';
import {
  MAX_AUTO_REFINE,
  svgFromShapes,
  traceAll,
  traceTap,
  visibleShapes,
  withoutShape,
} from './scanFlow';

const mockSegment = vi.fn();
const mockTrace = vi.fn();
const mockTraceSegmented = vi.fn();

vi.mock('@/shared/scanTrace', async (importOriginal) => ({
  ...(await importOriginal<typeof ScanTrace>()),
  segmentAt: (...args: unknown[]) => mockSegment(...args),
  traceScene: (...args: unknown[]) => mockTrace(...args),
  traceSceneSegmented: (...args: unknown[]) => mockTraceSegmented(...args),
}));

const W = 100;
const H = 80;
const IMAGE = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
const CANVAS = {} as HTMLCanvasElement;
const EMPTY = { width: W, height: H, data: new Float32Array(W * H) };

const box = (x0: number, y0: number, x1: number, y1: number): SceneShape => {
  const points = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return { imagePoints: points, outputPoints: points };
};

const card = (x: number) => ({
  corners: [
    { x, y: 60 },
    { x: x + 20, y: 60 },
    { x: x + 20, y: 75 },
    { x, y: 75 },
  ] as const,
  fitness: 1,
});

const scene = (shapes: SceneShape[], cardAt = 0): SceneTrace => ({
  shapes,
  units: 'mm',
  card: card(cardAt),
  grid: null,
  reference: { kind: 'card', card: card(cardAt) },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSegment.mockResolvedValue(EMPTY);
});

describe('traceAll', () => {
  it('stops asking the model once it fails, keeping the colour outlines', async () => {
    const found = scene([box(5, 5, 30, 40), box(50, 5, 90, 40)]);
    mockTrace.mockReturnValue(ok(found));
    mockSegment.mockRejectedValue(new Error('no model'));

    const traced = await traceAll(CANVAS, IMAGE, {});

    expect(traced).toEqual(ok({ scene: found, canRefine: false }));
    expect(mockSegment).toHaveBeenCalledTimes(1);
  });

  it('asks the model about at most a handful of tools', async () => {
    const many = Array.from({ length: MAX_AUTO_REFINE + 4 }, (_, i) =>
      box(i * 8, 5, i * 8 + 6, 40)
    );
    mockTrace.mockReturnValue(ok(scene(many)));
    mockTraceSegmented.mockReturnValue(ok(scene([box(0, 0, 1, 1)])));

    await traceAll(CANVAS, IMAGE, {});

    expect(mockSegment).toHaveBeenCalledTimes(MAX_AUTO_REFINE);
  });

  it('asks the model about the middle of a drawn region, and takes nothing outside it', async () => {
    const region = [
      { x: 60, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 80 },
      { x: 60, y: 80 },
    ];
    mockTrace.mockReturnValue(err({ code: 'NO_OBJECT', detail: '' }));
    mockTraceSegmented.mockReturnValue(ok(scene([box(5, 5, 30, 30)])));

    const outside = await traceAll(CANVAS, IMAGE, { region }, null);

    expect(mockSegment).toHaveBeenCalledWith(CANVAS, { x: 0.8, y: 0.75 });
    expect(outside).toEqual(err('noObject'));

    mockTraceSegmented.mockReturnValue(ok(scene([box(65, 45, 95, 75)])));
    const inside = await traceAll(CANVAS, IMAGE, { region }, null);
    expect(inside.ok && inside.value.scene.shapes).toHaveLength(1);
  });

  it('sizes the photo by a settled reference instead of looking for one', async () => {
    const ruler: SceneReference = {
      kind: 'ruler',
      ruler: { a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, lengthMm: 20 },
    };
    mockTrace.mockReturnValue(err({ code: 'NO_OBJECT', detail: '' }));
    mockTraceSegmented.mockReturnValue(ok(scene([box(0, 0, 1, 1)])));

    await traceAll(CANVAS, IMAGE, {}, ruler);

    expect(mockTrace).toHaveBeenCalledWith(IMAGE, {}, ruler);
    expect(mockTraceSegmented).toHaveBeenCalledWith(IMAGE, EMPTY, {}, ruler);
  });
});

describe('traceTap', () => {
  it('re-sizes the kept outlines, not the photo, when the tap moves the card', async () => {
    // The colour pass took a card-shaped tool for the card, and traced the
    // real card as a tool; the user had already removed something else.
    const tool = box(50, 5, 90, 40);
    const realCard = box(71, 61, 89, 74);
    const before = scene([tool, realCard], 0);
    const tapped = scene([box(2, 58, 24, 77)], 70);
    mockTraceSegmented.mockReturnValue(ok(tapped));

    const next = await traceTap(CANVAS, IMAGE, before, { x: 0.1, y: 0.85 }, {});
    if (!next.ok) throw new Error('tap failed');

    expect(mockTrace).not.toHaveBeenCalled();
    expect(next.value.reference).toEqual(tapped.reference);
    expect(next.value.shapes.map((s) => s.imagePoints)).toEqual([
      tool.imagePoints,
      tapped.shapes[0].imagePoints,
    ]);
  });

  it('reports a model that cannot run instead of throwing', async () => {
    mockSegment.mockRejectedValue(new Error('no model'));
    const next = await traceTap(CANVAS, IMAGE, scene([box(5, 5, 30, 40)]), { x: 0.2, y: 0.2 }, {});
    expect(next).toEqual(err('modelFailed'));
  });

  it('keeps a reference the user set, whatever the tapped tool lies near', async () => {
    const ruler: SceneReference = {
      kind: 'ruler',
      ruler: { a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, lengthMm: 20 },
    };
    const before = { ...scene([box(50, 5, 90, 40)]), card: null, reference: ruler };
    mockTraceSegmented.mockReturnValue(ok({ ...before, shapes: [box(5, 5, 30, 40)] }));

    const next = await traceTap(CANVAS, IMAGE, before, { x: 0.15, y: 0.25 }, {}, true);

    expect(mockTraceSegmented).toHaveBeenCalledWith(IMAGE, EMPTY, {}, ruler);
    expect(next.ok && next.value.reference).toBe(ruler);
  });

  it('keeps the scene’s reference when the tap agrees with it', async () => {
    const before = scene([box(50, 5, 90, 40)]);
    mockTraceSegmented.mockReturnValue(ok(scene([box(5, 5, 30, 40)])));

    const next = await traceTap(CANVAS, IMAGE, before, { x: 0.15, y: 0.25 }, {});

    expect(mockTrace).not.toHaveBeenCalled();
    expect(next.ok && next.value.shapes).toHaveLength(2);
  });
});

describe('svgFromShapes', () => {
  it('writes one path per tool in a shared frame', () => {
    const svg = svgFromShapes([box(10, 20, 40, 30), box(60, 20, 70, 50)], 'mm');
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('viewBox="0 0 60 30"');
    expect(svg).toContain('data-scan-units="mm"');
  });

  it('leaves an unscaled outline untagged', () => {
    expect(svgFromShapes([box(0, 0, 5, 5)], 'px')).not.toContain('data-scan-units');
  });
});

describe('holes', () => {
  const ring: SceneShape = { ...box(0, 0, 40, 40), holes: [box(10, 10, 30, 30)] };
  const nut: SceneShape = { ...box(15, 15, 25, 25), inHole: true };

  it('leaves a tool lying in a hole out unless holes are kept', () => {
    expect(visibleShapes([ring, nut], false, 'px')).toEqual([ring]);
    expect(visibleShapes([ring, nut], true, 'px')).toEqual([ring, nut]);
  });

  // In millimetres a 20 mm hole stays and a 2 mm one goes.
  it('keeps only the holes wide enough to leave an island standing', () => {
    const withSlit: SceneShape = { ...ring, holes: [box(10, 10, 30, 30), box(32, 5, 34, 35)] };
    const [shown] = visibleShapes([withSlit], true, 'mm');
    expect(shown.holes).toEqual([box(10, 10, 30, 30)]);
  });

  // 1 mm across in a millimetre scene: too narrow to keep, so the tool in it
  // would be a pocket inside the pocket.
  it('hides a tool whose hole was too narrow to keep', () => {
    const slotted: SceneShape = { ...box(0, 0, 40, 40), holes: [box(10, 10, 11, 30)] };
    const pin: SceneShape = { ...box(10.2, 15, 10.8, 25), inHole: true };
    expect(visibleShapes([slotted, pin], true, 'mm')).toEqual([box(0, 0, 40, 40)]);
  });

  // A ring's wide hole holds a slotted tool, and a pin lies in the 1 mm slot.
  // Once the slot is filled in, the pin sits on the slotted tool's material,
  // however wide the ring's hole around both.
  it('hides a tool in a narrow hole of a tool that lies in a kept hole', () => {
    const outer: SceneShape = { ...box(0, 0, 80, 80), holes: [box(5, 5, 75, 75)] };
    const slotted: SceneShape = {
      ...box(10, 10, 50, 50),
      holes: [box(20, 20, 21, 40)],
      inHole: true,
    };
    const pin: SceneShape = { ...box(20.2, 25, 20.8, 35), inHole: true };
    const shown = visibleShapes([outer, slotted, pin], true, 'mm');
    expect(shown).toEqual([outer, { ...box(10, 10, 50, 50), inHole: true }]);
  });

  it('frees a tool from a hole once the ring around it is removed', () => {
    const other = box(50, 0, 60, 10);
    expect(withoutShape([ring, nut, other], ring)).toEqual([box(15, 15, 25, 25), other]);
    expect(withoutShape([ring, nut, other], other)).toEqual([ring, nut]);
  });

  it('writes a kept hole as an even-odd subpath of its tool', () => {
    const svg = svgFromShapes([ring], 'mm', true);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg.match(/M/g)).toHaveLength(2);
  });

  it('leaves holes out of the outline when they are not kept', () => {
    const svg = svgFromShapes([ring], 'mm', false);
    expect(svg).not.toContain('fill-rule');
    expect(svg.match(/M/g)).toHaveLength(1);
  });
});
