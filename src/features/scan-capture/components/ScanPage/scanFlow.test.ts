import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as ScanTrace from '@/shared/scanTrace';
import { err, ok } from '@/core/result';
import type { SceneShape, SceneTrace } from '@/shared/scanTrace';
import { MAX_AUTO_REFINE, svgFromShapes, traceAll, traceTap } from './scanFlow';

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
