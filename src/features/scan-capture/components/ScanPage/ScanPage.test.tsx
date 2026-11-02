import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as ScanTrace from '@/shared/scanTrace';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import type { SceneShape, SceneTrace } from '@/shared/scanTrace';
import { ScanPage } from './ScanPage';

const mockDecodeCanvas = vi.fn();
const mockImageData = vi.fn();
const mockSegment = vi.fn();
const mockTraceSegmented = vi.fn();
const mockTrace = vi.fn();
const mockPreload = vi.fn();
const mockCardSkew = vi.fn((..._args: unknown[]) => 0);
const mockWithCardSize = vi.fn((...args: unknown[]) => args[0]);

// The image work is stubbed; the pure scene helpers (merging a redraw,
// comparing references, seeding) run for real.
vi.mock('@/shared/scanTrace', async (importOriginal) => ({
  ...(await importOriginal<typeof ScanTrace>()),
  decodeImageToCanvas: (...args: unknown[]) => mockDecodeCanvas(...args),
  imageDataFromCanvas: (...args: unknown[]) => mockImageData(...args),
  segmentAt: (...args: unknown[]) => mockSegment(...args),
  traceSceneSegmented: (...args: unknown[]) => mockTraceSegmented(...args),
  traceScene: (...args: unknown[]) => mockTrace(...args),
  preloadSegmenter: (...args: unknown[]) => mockPreload(...args),
  cardPerspectiveSkew: (...args: unknown[]) => mockCardSkew(...args),
  withCardSize: (...args: unknown[]) => mockWithCardSize(...args),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const TOKEN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const IMAGE = { width: 100, height: 80, data: new Uint8ClampedArray(100 * 80 * 4) };
const MASK = { width: 100, height: 80, data: new Float32Array(100 * 80) };

const box = (x0: number, y0: number, x1: number, y1: number): SceneShape => {
  const points = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return { imagePoints: points, outputPoints: points };
};
const TOOL = box(10, 10, 35, 55);
const SECOND = box(60, 10, 90, 30);
const CARD = {
  corners: [
    { x: 1, y: 1 },
    { x: 9, y: 1 },
    { x: 9, y: 6 },
    { x: 1, y: 6 },
  ] as const,
  fitness: 0.97,
};
// A scene with a detected card → millimetre output.
const SCENE_MM: SceneTrace = {
  shapes: [TOOL],
  units: 'mm',
  card: CARD,
  grid: null,
  reference: { kind: 'card', card: CARD },
};
// A scene with no card → pixel output, desktop will ask for the size.
const SCENE_PX: SceneTrace = {
  shapes: [TOOL],
  units: 'px',
  card: null,
  grid: null,
  reference: null,
};
const SCENE_TWO: SceneTrace = { ...SCENE_MM, shapes: [TOOL, SECOND] };
// The model's default redraw lands away from every tool, so it is never taken.
const SCENE_ELSEWHERE: SceneTrace = { ...SCENE_MM, shapes: [box(70, 60, 90, 75)] };

function lastUploadedSvg(fetchMock: ReturnType<typeof vi.fn>): string {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
  return (JSON.parse(init.body as string) as { svg: string }).svg;
}

function selectPhoto(): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('ScanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockWithCardSize.mockImplementation((...args: unknown[]) => args[0]);
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    mockDecodeCanvas.mockResolvedValue(document.createElement('canvas'));
    mockImageData.mockReturnValue(IMAGE);
    mockSegment.mockResolvedValue(MASK);
    mockTrace.mockReturnValue(ok(SCENE_MM));
    mockTraceSegmented.mockReturnValue(ok(SCENE_ELSEWHERE));
    mockCardSkew.mockReturnValue(0);
    // jsdom gives 0×0 rects by default; the tap handler needs a real box.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('starts on the capture screen and warms the model', () => {
    render(<ScanPage token={TOKEN} />);
    expect(screen.getByText('scan.takePhoto')).toBeInTheDocument();
    expect(screen.getByText('scan.capture.heading')).toBeInTheDocument();
    expect(mockPreload).toHaveBeenCalled();
  });

  it('shows the annotated example photo, callouts, and on-device privacy note', () => {
    render(<ScanPage token={TOKEN} />);
    const example = screen.getByAltText('scan.capture.exampleAlt');
    expect(example).toHaveAttribute('src', '/images/scan/scan-example.webp');
    expect(screen.getByText('scan.capture.label.tool')).toBeInTheDocument();
    expect(screen.getByText('scan.capture.label.card')).toBeInTheDocument();
    expect(screen.getByText('scan.capture.label.topDown')).toBeInTheDocument();
    expect(screen.getByText('scan.capture.privacy')).toBeInTheDocument();
  });

  it('segments a photo and shows the review overlay with the tap hint', async () => {
    render(<ScanPage token={TOKEN} />);

    selectPhoto();

    expect(await screen.findByText('scan.review.tapHint')).toBeInTheDocument();
    // The "is this your tool?" confirm prompt makes the tap-to-reselect explicit.
    expect(screen.getByText('scan.review.confirmTitle')).toBeInTheDocument();
    expect(screen.getByText('scan.use')).toBeInTheDocument();
    // Two overlays: the tool outline and the detected-card highlight.
    expect(document.querySelectorAll('polygon')).toHaveLength(2);
    expect(screen.getByText('binDesigner.cutouts.scanImport.resultSize')).toBeInTheDocument();
    expect(screen.getByText('scan.cardMeasured')).toBeInTheDocument();
    // A flat shot (skew 0) shows no steep-angle caution.
    expect(screen.queryByText('scan.cardSteepAngle')).toBeNull();
  });

  it('offers an upload option that accepts an existing photo without forcing the camera', async () => {
    render(<ScanPage token={TOKEN} />);

    // Both options are on the capture screen.
    expect(screen.getByText('scan.takePhoto')).toBeInTheDocument();
    expect(screen.getByText('scan.uploadPhoto')).toBeInTheDocument();

    // The upload input omits `capture`, so the OS offers the gallery / file
    // picker instead of forcing the live camera (the camera input keeps it).
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    expect(inputs).toHaveLength(2);
    const uploadInput = inputs.find((i) => !i.hasAttribute('capture'));
    expect(uploadInput).toBeDefined();

    // Choosing an existing photo runs the same segmentation path as the camera.
    const file = new File(['x'], 'gallery.jpg', { type: 'image/jpeg' });
    Object.defineProperty(uploadInput!, 'files', { value: [file], configurable: true });
    fireEvent.change(uploadInput!);

    expect(await screen.findByText('scan.review.tapHint')).toBeInTheDocument();
  });

  it('cautions about accuracy when the card was shot at a steep angle', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
    mockCardSkew.mockReturnValue(0.5);
    render(<ScanPage token={TOKEN} />);

    selectPhoto();

    expect(await screen.findByText('scan.cardSteepAngle')).toBeInTheDocument();
  });

  it('shows the no-card warning and a single overlay when no card is detected', async () => {
    mockTrace.mockReturnValue(ok(SCENE_PX));
    render(<ScanPage token={TOKEN} />);

    selectPhoto();

    expect(await screen.findByText('scan.noCardTitle')).toBeInTheDocument();
    expect(screen.getByText('scan.noCardHint')).toBeInTheDocument();
    expect(document.querySelectorAll('polygon')).toHaveLength(1);
  });

  it('re-segments at the tapped point', async () => {
    render(<ScanPage token={TOKEN} />);
    selectPhoto();

    const img = await screen.findByAltText('scan.photoAlt');
    expect(mockSegment).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(img, { clientX: 40, clientY: 60 });

    await waitFor(() => expect(mockSegment).toHaveBeenCalledTimes(2));
    // Second call seeds from the tap (40/100, 60/100), not the auto-seed.
    expect(mockSegment).toHaveBeenLastCalledWith(expect.anything(), { x: 0.4, y: 0.6 });
  });

  it('falls back to the classical tracer when the model fails', async () => {
    mockSegment.mockRejectedValue(new Error('model unavailable'));
    mockTrace.mockReturnValue(ok(SCENE_PX));
    render(<ScanPage token={TOKEN} />);

    selectPhoto();

    // Classical mode → no tap-to-reselect, so no confirm prompt; retake guidance instead.
    expect(await screen.findByText('scan.review.retakeHint')).toBeInTheDocument();
    expect(screen.queryByText('scan.review.confirmTitle')).toBeNull();
    expect(mockTrace).toHaveBeenCalled();
  });

  it('lists every tool it found and uploads them all in one outline file', async () => {
    mockTrace.mockReturnValue(ok(SCENE_TWO));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ScanPage token={TOKEN} />);
    selectPhoto();

    expect(await screen.findByText('scan.review.confirmTitleMany')).toBeInTheDocument();
    expect(screen.getAllByText('scan.review.toolLabel')).toHaveLength(2);
    expect(screen.getByText('scan.review.toolsFound')).toBeInTheDocument();
    // Two tool outlines plus the card.
    expect(document.querySelectorAll('polygon')).toHaveLength(3);
    // The model redrew each tool from a seed inside it.
    expect(mockSegment).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText('scan.useMany'));

    expect(await screen.findByText('scan.sent.titleMany')).toBeInTheDocument();
    expect(lastUploadedSvg(fetchMock).match(/<path /g)).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('leaves a removed tool out of the upload', async () => {
    mockTrace.mockReturnValue(ok(SCENE_TWO));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ScanPage token={TOKEN} />);
    selectPhoto();

    fireEvent.click((await screen.findAllByLabelText('scan.review.removeTool'))[1]);

    // Down to one tool: the list goes, and so does a way to remove the last.
    expect(screen.queryByText('scan.review.toolLabel')).toBeNull();
    fireEvent.click(screen.getByText('scan.use'));
    await screen.findByText('scan.sent.title');
    expect(lastUploadedSvg(fetchMock).match(/<path /g)).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('holds removal until a tap’s redraw has landed', async () => {
    mockTrace.mockReturnValue(ok(SCENE_TWO));
    render(<ScanPage token={TOKEN} />);
    selectPhoto();
    const img = await screen.findByAltText('scan.photoAlt');

    mockSegment.mockReturnValue(new Promise(() => {}));
    fireEvent.pointerDown(img, { clientX: 20, clientY: 30 });

    await waitFor(() =>
      expect(screen.getAllByLabelText('scan.review.removeTool')[1]).toBeDisabled()
    );
    fireEvent.click(screen.getAllByLabelText('scan.review.removeTool')[1]);
    expect(screen.getAllByText('scan.review.toolLabel')).toHaveLength(2);
  });

  it('undoes a tap that swallowed other tools', async () => {
    mockTrace.mockReturnValue(ok(SCENE_TWO));
    render(<ScanPage token={TOKEN} />);
    selectPhoto();
    const img = await screen.findByAltText('scan.photoAlt');
    expect(screen.queryByText('scan.review.undo')).toBeNull();

    // The model grabs both tools as one.
    const both = box(5, 5, 95, 60);
    mockTraceSegmented.mockReturnValue(ok({ ...SCENE_MM, shapes: [both] }));
    fireEvent.pointerDown(img, { clientX: 20, clientY: 30 });

    fireEvent.click(await screen.findByText('scan.review.undo'));

    expect(screen.getAllByText('scan.review.toolLabel')).toHaveLength(2);
    expect(screen.queryByText('scan.review.undo')).toBeNull();
  });

  it('takes the model’s redraw when it agrees with the tool it was seeded in', async () => {
    const redrawn = box(11, 11, 34, 54);
    mockTraceSegmented.mockReturnValue(ok({ ...SCENE_MM, shapes: [redrawn] }));
    render(<ScanPage token={TOKEN} />);
    selectPhoto();

    await screen.findByAltText('scan.photoAlt');
    const outline = document.querySelectorAll('polygon')[1];
    expect(outline.getAttribute('points')).toBe('11,11 34,11 34,54 11,54');
  });

  it('asks the model for the middle of the frame when the colour pass finds nothing', async () => {
    mockTrace.mockReturnValue(err({ code: 'NO_OBJECT' }));
    render(<ScanPage token={TOKEN} />);
    selectPhoto();

    expect(await screen.findByText('scan.review.confirmTitle')).toBeInTheDocument();
    expect(mockSegment).toHaveBeenCalledWith(expect.anything(), { x: 0.5, y: 0.5 });
  });

  it('uploads the outline and confirms it was sent', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    render(<ScanPage token={TOKEN} />);
    selectPhoto();
    fireEvent.click(await screen.findByText('scan.use'));

    expect(await screen.findByText('scan.sent.title')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/scan-session/${TOKEN}`,
      expect.objectContaining({ method: 'POST' })
    );
    vi.unstubAllGlobals();
  });

  it('returns to capture so the user can scan another tool', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    render(<ScanPage token={TOKEN} />);
    selectPhoto();
    fireEvent.click(await screen.findByText('scan.use'));

    fireEvent.click(await screen.findByText('scan.sent.another'));

    expect(await screen.findByText('scan.takePhoto')).toBeInTheDocument();
    expect(screen.getByText('scan.capture.heading')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('attempts to close the tab and shows a close hint when Done is tapped', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<ScanPage token={TOKEN} />);
    selectPhoto();
    fireEvent.click(await screen.findByText('scan.use'));

    fireEvent.click(await screen.findByText('scan.sent.done'));

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('scan.finished.body')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows a no-object error when both ML and classical tracing fail', async () => {
    mockSegment.mockRejectedValue(new Error('model unavailable'));
    mockTrace.mockReturnValue(err({ code: 'NO_OBJECT' }));
    render(<ScanPage token={TOKEN} />);

    selectPhoto();

    expect(await screen.findByText('scan.error.noObject')).toBeInTheDocument();
  });

  it('reports an expired session when the upload 404s', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    render(<ScanPage token={TOKEN} />);
    selectPhoto();
    fireEvent.click(await screen.findByText('scan.use'));

    expect(await screen.findByText('scan.error.expired')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  describe('reference card size', () => {
    async function openEditor(): Promise<void> {
      render(<ScanPage token={TOKEN} />);
      selectPhoto();
      fireEvent.click(await screen.findByText('scan.cardSize.change'));
    }

    it('is offered only when a card was actually detected', async () => {
      mockTrace.mockReturnValue(ok(SCENE_PX));
      render(<ScanPage token={TOKEN} />);
      selectPhoto();

      expect(await screen.findByText('scan.noCardTitle')).toBeInTheDocument();
      expect(screen.queryByText('scan.cardSize.label')).toBeNull();
    });

    it('starts collapsed on the nominal ID-1 card', async () => {
      render(<ScanPage token={TOKEN} />);
      selectPhoto();

      expect(await screen.findByText('scan.cardSize.label')).toBeInTheDocument();
      expect(screen.queryByLabelText('scan.cardSize.longSide')).toBeNull();
      expect(mockWithCardSize).toHaveBeenLastCalledWith(SCENE_MM, 85.6, 53.98);
    });

    it('re-rectifies the outline against a caliper-measured side', async () => {
      await openEditor();

      fireEvent.change(screen.getByLabelText('scan.cardSize.longSide'), {
        target: { value: '85.9' },
      });

      expect(mockWithCardSize).toHaveBeenLastCalledWith(SCENE_MM, 85.9, 53.98);
    });

    it('holds the last good value while a side is half-typed or out of range', async () => {
      await openEditor();
      const longSide = screen.getByLabelText('scan.cardSize.longSide');

      fireEvent.change(longSide, { target: { value: '' } });
      expect(screen.queryByText('scan.cardSize.range')).toBeNull();

      fireEvent.change(longSide, { target: { value: '8' } });
      expect(screen.getByText('scan.cardSize.range')).toBeInTheDocument();
      expect(mockWithCardSize).toHaveBeenLastCalledWith(SCENE_MM, 85.6, 53.98);
    });

    it('reuses the measured card for the next scan on this phone', async () => {
      await openEditor();

      fireEvent.change(screen.getByLabelText('scan.cardSize.shortSide'), {
        target: { value: '54.1' },
      });
      fireEvent.click(screen.getByText('scan.retake'));
      selectPhoto();

      await waitFor(() =>
        expect(mockTrace).toHaveBeenLastCalledWith(IMAGE, { widthMm: 85.6, heightMm: 54.1 })
      );
      // The redraw is sized against the card the colour pass already found.
      await waitFor(() =>
        expect(mockTraceSegmented).toHaveBeenLastCalledWith(
          IMAGE,
          MASK,
          { widthMm: 85.6, heightMm: 54.1 },
          SCENE_MM.reference
        )
      );
    });

    it('offers a way back to a standard card only once one is measured', async () => {
      await openEditor();
      expect(screen.queryByText('scan.cardSize.useStandard')).toBeNull();

      fireEvent.change(screen.getByLabelText('scan.cardSize.longSide'), {
        target: { value: '85.9' },
      });
      fireEvent.click(screen.getByText('scan.cardSize.useStandard'));

      expect(mockWithCardSize).toHaveBeenLastCalledWith(SCENE_MM, 85.6, 53.98);
      expect(screen.queryByText('scan.cardSize.useStandard')).toBeNull();
    });
  });
});
