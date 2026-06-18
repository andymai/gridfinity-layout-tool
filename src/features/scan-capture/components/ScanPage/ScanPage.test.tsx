import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { ScanPage } from './ScanPage';

const mockDecodeCanvas = vi.fn();
const mockImageData = vi.fn();
const mockAutoSeed = vi.fn();
const mockSegment = vi.fn();
const mockTraceSegmented = vi.fn();
const mockTrace = vi.fn();
const mockPreload = vi.fn();
const mockCardSkew = vi.fn(() => 0);

vi.mock('@/shared/scanTrace', () => ({
  decodeImageToCanvas: (...args: unknown[]) => mockDecodeCanvas(...args),
  imageDataFromCanvas: (...args: unknown[]) => mockImageData(...args),
  computeAutoSeed: (...args: unknown[]) => mockAutoSeed(...args),
  segmentAt: (...args: unknown[]) => mockSegment(...args),
  traceSceneSegmented: (...args: unknown[]) => mockTraceSegmented(...args),
  traceScene: (...args: unknown[]) => mockTrace(...args),
  preloadSegmenter: (...args: unknown[]) => mockPreload(...args),
  pointsToSvgPath: () => 'M0 0 L10 0 L10 10',
  cardPerspectiveSkew: (...args: unknown[]) => mockCardSkew(...args),
  STEEP_CARD_SKEW: 0.2,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const TOKEN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const IMAGE = { width: 24, height: 20, data: new Uint8ClampedArray(24 * 20 * 4) };
const MASK = { width: 24, height: 20, data: new Float32Array(24 * 20) };
const PTS = [
  { x: 0, y: 0 },
  { x: 25, y: 0 },
  { x: 25, y: 45 },
];
// A scene with a detected card → millimetre output.
const SCENE_MM = {
  imagePoints: PTS,
  outputPoints: PTS,
  units: 'mm' as const,
  card: {
    corners: [
      { x: 1, y: 1 },
      { x: 9, y: 1 },
      { x: 9, y: 6 },
      { x: 1, y: 6 },
    ] as const,
    fitness: 0.97,
  },
};
// A scene with no card → pixel output, desktop will ask for the size.
const SCENE_PX = { imagePoints: PTS, outputPoints: PTS, units: 'px' as const, card: null };

function selectPhoto(): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('ScanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    mockDecodeCanvas.mockResolvedValue(document.createElement('canvas'));
    mockImageData.mockReturnValue(IMAGE);
    mockAutoSeed.mockReturnValue({ x: 0.5, y: 0.5 });
    mockSegment.mockResolvedValue(MASK);
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
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
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

  it('cautions about accuracy when the card was shot at a steep angle', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
    mockCardSkew.mockReturnValue(0.5);
    render(<ScanPage token={TOKEN} />);

    selectPhoto();

    expect(await screen.findByText('scan.cardSteepAngle')).toBeInTheDocument();
  });

  it('shows the no-card warning and a single overlay when no card is detected', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_PX));
    render(<ScanPage token={TOKEN} />);

    selectPhoto();

    expect(await screen.findByText('scan.noCardTitle')).toBeInTheDocument();
    expect(screen.getByText('scan.noCardHint')).toBeInTheDocument();
    expect(document.querySelectorAll('polygon')).toHaveLength(1);
  });

  it('re-segments at the tapped point', async () => {
    mockTraceSegmented.mockReturnValue(ok(SCENE_MM));
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
});
