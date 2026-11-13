import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as ScanTrace from '@/shared/scanTrace';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import type { SceneShape, SceneTrace } from '@/shared/scanTrace';
import { ScanCaptureFlow } from './ScanCaptureFlow';

const mockTrace = vi.fn();
const mockDetect = vi.fn();
vi.mock('@/shared/scanTrace', async (importOriginal) => ({
  ...(await importOriginal<typeof ScanTrace>()),
  detectReference: (...args: unknown[]) => mockDetect(...args),
  decodeImageToCanvas: async () => document.createElement('canvas'),
  imageDataFromCanvas: () => ({
    width: 100,
    height: 80,
    data: new Uint8ClampedArray(100 * 80 * 4),
  }),
  segmentAt: async () => ({ width: 100, height: 80, data: new Float32Array(100 * 80) }),
  // The model's redraw lands away from the tool, so the colour trace stands.
  traceSceneSegmented: () =>
    ok({
      ...SCENE,
      shapes: [
        {
          imagePoints: [
            { x: 70, y: 60 },
            { x: 90, y: 60 },
            { x: 90, y: 75 },
            { x: 70, y: 75 },
          ],
          outputPoints: [
            { x: 70, y: 60 },
            { x: 90, y: 60 },
            { x: 90, y: 75 },
            { x: 70, y: 75 },
          ],
        },
      ],
    }),
  traceScene: (...args: unknown[]) => mockTrace(...args),
  preloadSegmenter: () => {},
  cardPerspectiveSkew: () => 0,
  withCardSize: (scene: unknown) => scene,
}));
vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const points = [
  { x: 10, y: 10 },
  { x: 35, y: 10 },
  { x: 35, y: 55 },
  { x: 10, y: 55 },
];
const TOOL: SceneShape = { imagePoints: points, outputPoints: points };
const SCENE: SceneTrace = { shapes: [TOOL], units: 'px', card: null, grid: null, reference: null };

function selectPhoto(): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('ScanCaptureFlow', () => {
  beforeEach(() => {
    mockTrace.mockReturnValue(ok(SCENE));
    mockDetect.mockReturnValue(null);
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  it('leaves the title to the dialog it sits in', () => {
    const { unmount } = render(<ScanCaptureFlow layout="page" onUse={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'scan.title' })).toBeInTheDocument();
    unmount();

    render(<ScanCaptureFlow layout="embedded" onUse={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'scan.title' })).toBeNull();
  });

  it('hands the outline on and starts over once the caller has taken it', async () => {
    const onUse = vi.fn(async () => ({ kind: 'taken' as const }));
    render(<ScanCaptureFlow layout="embedded" onUse={onUse} />);
    selectPhoto();
    fireEvent.click(await screen.findByText('scan.use'));

    await waitFor(() => expect(onUse).toHaveBeenCalledWith(expect.stringContaining('<svg'), 1));
    expect(await screen.findByText('scan.takePhoto')).toBeInTheDocument();
  });

  it('sizes from a plain sheet and lets the user correct or rule it out', async () => {
    const sheet = (longMm: number, shortMm: number) => ({
      kind: 'paper' as const,
      paper: {
        corners: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 },
        ] as const,
        widthMm: longMm,
        heightMm: shortMm,
      },
    });
    mockTrace.mockReturnValue(ok({ ...SCENE, units: 'mm', reference: sheet(297, 210) }));
    render(<ScanCaptureFlow layout="embedded" onUse={vi.fn()} />);
    selectPhoto();

    expect(await screen.findByText('scan.paperMeasured')).toBeInTheDocument();
    expect(screen.getByRole('radio', { checked: true })).toHaveTextContent(
      'binDesigner.cutouts.traceView.paper.a4'
    );

    mockDetect.mockReturnValue(sheet(279.4, 215.9));
    fireEvent.click(
      screen.getByRole('radio', { name: 'binDesigner.cutouts.traceView.paper.letter' })
    );
    expect(mockDetect).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ paper: 'letter' })
    );
    expect(screen.getByText('scan.paperMeasured')).toBeInTheDocument();

    // Ruling the sheet out moves where the tools are looked for, so they are traced again.
    mockDetect.mockReturnValue(null);
    mockTrace.mockClear();
    mockTrace.mockReturnValue(ok(SCENE));
    fireEvent.click(screen.getByRole('radio', { name: 'scan.paper.notPaper' }));
    expect(await screen.findByText('scan.noReferenceHint')).toBeInTheDocument();
    expect(mockTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paper: 'off' })
    );
    expect(screen.getByRole('radio', { checked: true })).toHaveTextContent('scan.paper.notPaper');
  });

  it('keeps the review open to try again when the caller throws', async () => {
    const onUse = vi.fn(() => Promise.reject(new Error('store refused')));
    render(<ScanCaptureFlow layout="embedded" onUse={onUse} />);
    selectPhoto();
    fireEvent.click(await screen.findByText('scan.use'));

    await waitFor(() => expect(onUse).toHaveBeenCalledTimes(1));
    const use = await screen.findByRole('button', { name: 'scan.use' });
    await waitFor(() => expect(use).toBeEnabled());
    fireEvent.click(use);
    await waitFor(() => expect(onUse).toHaveBeenCalledTimes(2));
  });
});
