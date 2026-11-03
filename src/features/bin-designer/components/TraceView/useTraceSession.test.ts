import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import type * as ScanTrace from '@/shared/scanTrace';
import {
  paperReference,
  rulerReference,
  type SceneShape,
  type SceneTrace,
  type SoftMask,
} from '@/shared/scanTrace';
import { useTraceSession } from './useTraceSession';

const W = 200;
const H = 100;
const IMAGE = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
const CANVAS = {} as HTMLCanvasElement;
const SOFT: SoftMask = { width: W, height: H, data: new Float32Array(W * H) };

const mockDecode = vi.fn();
const mockDetect = vi.fn();
const mockTrace = vi.fn();
const mockTraceSegmented = vi.fn();
const mockSegment = vi.fn();

vi.mock('@/shared/scanTrace', async (importOriginal) => ({
  ...(await importOriginal<typeof ScanTrace>()),
  decodeImageToCanvas: (...args: unknown[]) => mockDecode(...args),
  imageDataFromCanvas: () => IMAGE,
  detectReference: (...args: unknown[]) => mockDetect(...args),
  preloadSegmenter: () => {},
  traceScene: (...args: unknown[]) => mockTrace(...args),
  traceSceneSegmented: (...args: unknown[]) => mockTraceSegmented(...args),
  segmentAt: (...args: unknown[]) => mockSegment(...args),
}));

const box = (x0: number, y0: number, x1: number, y1: number): SceneShape => {
  const points = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return { imagePoints: points, outputPoints: points };
};

const TOOLS = [box(10, 10, 50, 40), box(100, 20, 150, 80)];
const SCENE: SceneTrace = { shapes: TOOLS, units: 'px', card: null, grid: null, reference: null };
const RULER = rulerReference({ x: 0, y: 0 }, { x: 100, y: 0 }, 50);
const PAPER = paperReference(
  [
    { x: 5, y: 5 },
    { x: 195, y: 5 },
    { x: 195, y: 95 },
    { x: 5, y: 95 },
  ],
  'a4',
  { width: W, height: H }
);

const photo = () => new File(['x'], 'tools.jpg', { type: 'image/jpeg' });

async function loaded() {
  const hook = renderHook(() => useTraceSession());
  await act(() => hook.result.current.load(photo()));
  return hook;
}

const width = (shape: SceneShape) => {
  const xs = shape.outputPoints.map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
};

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:photo');
  URL.revokeObjectURL = vi.fn();
  mockDecode.mockResolvedValue(CANVAS);
  mockDetect.mockReturnValue(null);
  mockTrace.mockReturnValue(ok(SCENE));
  mockSegment.mockResolvedValue(SOFT);
  mockTraceSegmented.mockReturnValue(err({ code: 'NO_OBJECT', detail: '' }));
});

describe('useTraceSession', () => {
  it('traces every tool against the photo’s own reference', async () => {
    mockDetect.mockReturnValue(RULER);
    const { result } = await loaded();

    expect(mockTrace).toHaveBeenCalledWith(IMAGE, expect.any(Object), RULER);
    expect(result.current.shapes).toHaveLength(2);
    expect(result.current.photo?.url).toBe('blob:photo');
  });

  it('adds nothing until the photo has a scale', async () => {
    const { result } = await loaded();
    expect(result.current.scene?.units).toBe('px');
    expect(result.current.traced()).toBeNull();
  });

  it('sizes the tools by a ruler without tracing them again', async () => {
    const { result } = await loaded();
    act(() => result.current.setScale(RULER));

    expect(mockTrace).toHaveBeenCalledTimes(1);
    expect(result.current.manual).toBe(true);
    expect(width(result.current.shapes[0])).toBeCloseTo(20);
    expect(result.current.traced()).toContain('data-scan-units="mm"');
  });

  it('keeps a removal through a ruler, and back to the photo’s reference', async () => {
    const { result } = await loaded();
    act(() => result.current.remove(0));
    act(() => result.current.setScale(RULER));
    act(() => result.current.setScale(null));

    expect(result.current.manual).toBe(false);
    expect(result.current.scene?.units).toBe('px');
    expect(result.current.shapes).toHaveLength(1);
  });

  it('looks for the tools again on marked paper', async () => {
    const { result } = await loaded();
    act(() => result.current.setScale(PAPER));

    await waitFor(() => expect(result.current.working).toBe(false));
    expect(mockTrace).toHaveBeenCalledTimes(2);
    expect(mockTrace).toHaveBeenLastCalledWith(IMAGE, expect.any(Object), PAPER);
    expect(result.current.manual).toBe(true);
  });

  it('looks only inside a drawn region', async () => {
    const { result } = await loaded();
    const region = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 50 },
      { x: 0, y: 50 },
    ];
    mockTrace.mockReturnValue(ok({ ...SCENE, shapes: [TOOLS[0]] }));
    act(() => result.current.setRegion(region));

    await waitFor(() => expect(result.current.shapes).toHaveLength(1));
    expect(mockTrace).toHaveBeenLastCalledWith(IMAGE, expect.objectContaining({ region }), null);
    expect(result.current.canUndo).toBe(true);
  });

  it('removes the tool asked, and undoes it', async () => {
    const { result } = await loaded();
    act(() => result.current.remove(1));
    expect(result.current.shapes.map((s) => s.imagePoints)).toEqual([TOOLS[0].imagePoints]);

    act(() => result.current.undo());
    expect(result.current.shapes).toHaveLength(2);
  });

  it('drops a redraw that a newer trace overtook', async () => {
    const { result } = await loaded();
    let land: (mask: SoftMask) => void = () => {};
    mockSegment.mockReturnValueOnce(new Promise<SoftMask>((resolve) => (land = resolve)));
    mockTraceSegmented.mockReturnValue(ok({ ...SCENE, shapes: [box(0, 0, 190, 90)] }));

    act(() => result.current.tap({ x: 0.5, y: 0.5 }));
    mockTrace.mockReturnValue(ok({ ...SCENE, shapes: [TOOLS[1]] }));
    mockSegment.mockRejectedValue(new Error('no model'));
    act(() => result.current.commitSensitivity(30));
    await waitFor(() => expect(result.current.working).toBe(false));
    await act(async () => land(SOFT));

    expect(result.current.shapes.map((s) => s.imagePoints)).toEqual([TOOLS[1].imagePoints]);
    expect(result.current.sensitivity).toBe(30);
  });

  it('turns tapping off once the model cannot run', async () => {
    const { result } = await loaded();
    mockSegment.mockRejectedValue(new Error('no model'));
    act(() => result.current.tap({ x: 0.2, y: 0.2 }));

    await waitFor(() => expect(result.current.canRefine).toBe(false));
  });

  it('undoes a cleared ruler back to a scale a tap keeps', async () => {
    const { result } = await loaded();
    act(() => result.current.setScale(RULER));
    act(() => result.current.setScale(null));
    act(() => result.current.undo());
    expect(result.current.manual).toBe(true);

    act(() => result.current.tap({ x: 0.5, y: 0.5 }));
    await waitFor(() => expect(result.current.working).toBe(false));
    expect(mockTraceSegmented).toHaveBeenLastCalledWith(IMAGE, SOFT, expect.any(Object), RULER);
  });

  it('undoes a sensitivity change along with what it traced', async () => {
    const { result } = await loaded();
    act(() => result.current.setSensitivity(30));
    expect(result.current.sensitivity).toBe(30);
    act(() => result.current.commitSensitivity(30));
    await waitFor(() => expect(result.current.working).toBe(false));

    act(() => result.current.undo());
    expect(result.current.sensitivity).toBe(0);
  });

  it('frees the old photo when a replacement fails mid-redraw', async () => {
    const { result } = await loaded();
    mockSegment.mockReturnValueOnce(new Promise<SoftMask>(() => {}));
    act(() => result.current.tap({ x: 0.5, y: 0.5 }));
    expect(result.current.working).toBe(true);

    mockDecode.mockRejectedValueOnce(new Error('not an image'));
    await act(() => result.current.load(photo()));

    expect(result.current.failed).toBe(true);
    expect(result.current.working).toBe(false);
    expect(result.current.photo).not.toBeNull();
  });

  it('adds nothing while another photo loads', async () => {
    const { result } = await loaded();
    act(() => result.current.setScale(RULER));
    expect(result.current.traced()).not.toBeNull();

    let decoded: (canvas: HTMLCanvasElement) => void = () => {};
    mockDecode.mockReturnValueOnce(new Promise((resolve) => (decoded = resolve)));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.load(photo());
    });
    expect(result.current.traced()).toBeNull();
    await act(async () => {
      decoded(CANVAS);
      await pending;
    });
  });

  it('makes no photo URL for a view closed mid-load', async () => {
    const { result, unmount } = renderHook(() => useTraceSession());
    let decoded: (canvas: HTMLCanvasElement) => void = () => {};
    mockDecode.mockReturnValueOnce(new Promise((resolve) => (decoded = resolve)));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.load(photo());
    });
    unmount();
    decoded(CANVAS);
    await pending;

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('says so when the photo cannot be read', async () => {
    mockDecode.mockRejectedValue(new Error('not an image'));
    const { result } = renderHook(() => useTraceSession());
    await act(() => result.current.load(photo()));

    expect(result.current.failed).toBe(true);
    expect(result.current.photo).toBeNull();
  });
});
