import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { err, ok } from '@/core/result';
import type * as ScanTrace from '@/shared/scanTrace';
import type { SceneShape, SceneTrace, SoftMask } from '@/shared/scanTrace';
import { TraceView } from './TraceView';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const W = 200;
const H = 100;
const IMAGE = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
const SOFT: SoftMask = { width: W, height: H, data: new Float32Array(W * H) };
const mockTrace = vi.fn();
const mockDecode = vi.fn();

vi.mock('@/shared/scanTrace', async (importOriginal) => ({
  ...(await importOriginal<typeof ScanTrace>()),
  decodeImageToCanvas: (...args: unknown[]) => mockDecode(...args),
  imageDataFromCanvas: () => IMAGE,
  detectReference: () => null,
  preloadSegmenter: () => {},
  traceScene: (...args: unknown[]) => mockTrace(...args),
  traceSceneSegmented: () => err({ code: 'NO_OBJECT', detail: '' }),
  segmentAt: async () => SOFT,
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
const SCENE: SceneTrace = {
  shapes: [box(10, 10, 50, 40), box(100, 20, 150, 80)],
  units: 'px',
  card: null,
  grid: null,
  reference: null,
};

function choosePhoto(type = 'image/jpeg') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'tools.jpg', { type });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

function click(el: Element, x: number, y: number) {
  fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: x, clientY: y, button: 0, pointerId: 1 });
}

/** Never reports a size, so the canvas stays unfitted. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('TraceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Unmeasured, the photo sits unscaled at the corner: a client point is a photo pixel.
    vi.stubGlobal('ResizeObserver', SilentObserver);
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
    mockDecode.mockResolvedValue({});
    mockTrace.mockReturnValue(ok(SCENE));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts from a drop zone and holds Add back', () => {
    render(<TraceView open onClose={vi.fn()} onTraced={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.traceView.drop.title')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.scanImport.add')).toBeDisabled();
  });

  it('opens on a photo dropped or pasted on the editor, loading it once', async () => {
    const photo = new File(['x'], 'tools.jpg', { type: 'image/jpeg' });
    const { rerender } = render(
      <TraceView open onClose={vi.fn()} onTraced={vi.fn()} initialPhoto={photo} />
    );
    await screen.findAllByText('scan.review.toolLabel');
    rerender(<TraceView open onClose={vi.fn()} onTraced={vi.fn()} initialPhoto={photo} />);
    expect(mockDecode).toHaveBeenCalledTimes(1);
  });

  it('traces a photo, takes a ruler and adds the tools as a millimetre SVG', async () => {
    const onTraced = vi.fn();
    const onClose = vi.fn();
    render(<TraceView open onClose={onClose} onTraced={onTraced} />);
    choosePhoto();

    await screen.findAllByText('scan.review.toolLabel');
    expect(screen.getByText('binDesigner.cutouts.traceView.needsScale')).toBeInTheDocument();
    const add = screen.getByText('binDesigner.cutouts.traceView.addMany');
    expect(add).toBeDisabled();

    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.scale.drawRuler'));
    const canvas = screen.getByRole('application');
    click(canvas, 0, 50);
    click(canvas, 100, 50);
    fireEvent.change(screen.getByLabelText('binDesigner.cutouts.traceView.ruler.length'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.apply'));

    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);

    const [svg] = onTraced.mock.calls[0] as [string];
    expect(svg).toContain('data-scan-units="mm"');
    expect(svg.match(/<path /g)).toHaveLength(2);
    // 140 px across at 2 px to the millimetre.
    expect(svg).toContain('viewBox="0 0 70 35"');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers to clean up the outlines once the photo has a scale', async () => {
    render(<TraceView open onClose={vi.fn()} onTraced={vi.fn()} />);
    choosePhoto();
    await screen.findAllByText('scan.review.toolLabel');
    expect(screen.queryByText('binDesigner.cutouts.traceView.cleanup.heading')).toBeNull();

    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.scale.drawRuler'));
    const canvas = screen.getByRole('application');
    click(canvas, 0, 50);
    click(canvas, 100, 50);
    fireEvent.change(screen.getByLabelText('binDesigner.cutouts.traceView.ruler.length'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.apply'));

    expect(
      await screen.findByText('binDesigner.cutouts.traceView.cleanup.heading')
    ).toBeInTheDocument();
    // Two tools: one mirror setting would not suit both.
    expect(screen.getByText('binDesigner.cutouts.traceView.cleanup.hint')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.outline.mirror')).toBeNull();
  });

  it('leaves a marking mode on Escape without closing', async () => {
    const onClose = vi.fn();
    render(<TraceView open onClose={onClose} onTraced={vi.fn()} />);
    choosePhoto();
    await screen.findAllByText('scan.review.toolLabel');

    fireEvent.click(screen.getByText('binDesigner.cutouts.traceView.scale.markPaper'));
    expect(screen.getByText('binDesigner.cutouts.traceView.paper.hint')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText('binDesigner.cutouts.traceView.paper.hint')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('takes a dropped photo, and nothing that is not one', async () => {
    render(<TraceView open onClose={vi.fn()} onTraced={vi.fn()} />);
    const zone = screen.getByText('binDesigner.cutouts.traceView.drop.title').closest('div')
      ?.parentElement as HTMLElement;

    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] },
    });
    expect(mockDecode).not.toHaveBeenCalled();

    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    await screen.findAllByText('scan.review.toolLabel');
  });

  it('says so when a photo cannot be read', async () => {
    mockDecode.mockRejectedValue(new Error('bad'));
    render(<TraceView open onClose={vi.fn()} onTraced={vi.fn()} />);
    choosePhoto();
    expect(await screen.findByRole('alert')).toHaveTextContent('scan.error.decode');
  });
});
