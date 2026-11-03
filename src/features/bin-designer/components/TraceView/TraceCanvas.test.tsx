import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Point, SceneTrace } from '@/shared/scanTrace';
import { TraceCanvas } from './TraceCanvas';
import type { TraceMode } from './traceMode';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

// With no box size to fit to, the photo sits unscaled at the corner and a
// client point is a photo pixel.
const PHOTO = {
  canvas: {} as HTMLCanvasElement,
  image: { width: 200, height: 100, data: new Uint8ClampedArray(200 * 100 * 4) },
  url: 'blob:photo',
};
const SCENE: SceneTrace = { shapes: [], units: 'px', card: null, grid: null, reference: null };

const onTap = vi.fn();
const onRegion = vi.fn();
const onMarks = vi.fn();

function renderCanvas(
  overrides: Partial<{
    mode: TraceMode;
    marks: readonly Point[];
    busy: boolean;
    canRefine: boolean;
    scene: SceneTrace;
  }> = {}
) {
  const { container } = render(
    <TraceCanvas
      photo={PHOTO}
      scene={SCENE}
      shapes={[]}
      keepHoles={false}
      mode="tap"
      region={null}
      marks={[]}
      busy={false}
      canRefine
      onTap={onTap}
      onRegion={onRegion}
      onMarks={onMarks}
      {...overrides}
    />
  );
  return container.querySelector<HTMLElement>('[role="application"]') as HTMLElement;
}

function click(el: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: x, clientY: y, button: 0, pointerId: 1 });
}

function drag(el: HTMLElement, from: Point, to: Point) {
  fireEvent.pointerDown(el, { clientX: from.x, clientY: from.y, button: 0, pointerId: 1 });
  fireEvent.pointerMove(el, { clientX: (from.x + to.x) / 2, clientY: (from.y + to.y) / 2 });
  fireEvent.pointerMove(el, { clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(el, { clientX: to.x, clientY: to.y, button: 0, pointerId: 1 });
}

/** Never reports a size, so the canvas stays unfitted. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('TraceCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', SilentObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('taps a tool at its place on the photo', () => {
    click(renderCanvas(), 50, 25);
    expect(onTap).toHaveBeenCalledWith({ x: 0.25, y: 0.25 });
  });

  it('pans on a drag instead of tapping', () => {
    drag(renderCanvas(), { x: 50, y: 25 }, { x: 90, y: 60 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('taps nothing off the photo, mid-redraw, or with no model', () => {
    click(renderCanvas(), 300, 50);
    click(renderCanvas({ busy: true }), 50, 25);
    click(renderCanvas({ canRefine: false }), 50, 25);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('places ruler ends, and starts over once both are down', () => {
    click(renderCanvas({ mode: 'ruler' }), 10, 10);
    expect(onMarks).toHaveBeenLastCalledWith([{ x: 10, y: 10 }]);

    const ends = [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
    ];
    click(renderCanvas({ mode: 'ruler', marks: ends }), 80, 80);
    expect(onMarks).toHaveBeenLastCalledWith([{ x: 80, y: 80 }]);
  });

  it('moves a ruler end that is dragged', () => {
    const ends = [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
    ];
    drag(renderCanvas({ mode: 'ruler', marks: ends }), { x: 50, y: 10 }, { x: 60, y: 20 });
    expect(onMarks).toHaveBeenLastCalledWith([
      { x: 10, y: 10 },
      { x: 60, y: 20 },
    ]);
  });

  it('keeps paper corners on the photo', () => {
    click(renderCanvas({ mode: 'paper', marks: [{ x: 1, y: 1 }] }), 260, 140);
    expect(onMarks).toHaveBeenLastCalledWith([
      { x: 1, y: 1 },
      { x: 200, y: 100 },
    ]);
  });

  it('draws a region, and ignores a slip', () => {
    drag(renderCanvas({ mode: 'region' }), { x: 60, y: 40 }, { x: 10, y: 10 });
    expect(onRegion).toHaveBeenCalledWith([
      { x: 10, y: 10 },
      { x: 60, y: 10 },
      { x: 60, y: 40 },
      { x: 10, y: 40 },
    ]);
    onRegion.mockClear();
    drag(renderCanvas({ mode: 'region' }), { x: 60, y: 40 }, { x: 62, y: 42 });
    expect(onRegion).not.toHaveBeenCalled();
  });

  it('magnifies the photo under the pointer while marking, and only then', () => {
    // The loupe needs a measured box to find its corner in.
    vi.stubGlobal(
      'ResizeObserver',
      class SizedObserver implements ResizeObserver {
        private readonly report: ResizeObserverCallback;
        constructor(report: ResizeObserverCallback) {
          this.report = report;
        }
        observe(el: Element) {
          this.report([{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], this);
          void el;
        }
        unobserve() {}
        disconnect() {}
      }
    );
    const marking = renderCanvas({ mode: 'ruler' });
    fireEvent.pointerMove(marking, { clientX: 40, clientY: 30 });
    const loupe = marking.querySelector<HTMLElement>('[style*="background-image"]');
    expect(loupe).not.toBeNull();
    fireEvent.pointerLeave(marking);
    expect(marking.querySelector('[style*="background-image"]')).toBeNull();

    const tapping = renderCanvas();
    fireEvent.pointerMove(tapping, { clientX: 40, clientY: 30 });
    expect(tapping.querySelector('[style*="background-image"]')).toBeNull();
  });

  it('labels a ruler the user set with its length', () => {
    renderCanvas({
      scene: {
        ...SCENE,
        units: 'mm',
        reference: {
          kind: 'ruler',
          ruler: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, lengthMm: 42 },
        },
      },
    });
    expect(screen.getByText('binDesigner.cutouts.traceView.rulerLength')).toBeInTheDocument();
  });
});
