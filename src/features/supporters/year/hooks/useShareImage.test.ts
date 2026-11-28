import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ModelSlot, Scene } from '../cards/scene';
import type * as ShareCardModule from '../utils/shareCard';
import type { ShareTheme } from '../utils/shareCard';
import { useShareImage, type ShareRequest } from './useShareImage';

const drawn: { kind: string | null; model: unknown } = { kind: null, model: undefined };
const images = vi.hoisted(() => ({ load: vi.fn<(src: string) => Promise<HTMLImageElement>>() }));
vi.mock('../utils/loadImage', () => ({ loadImage: images.load }));
vi.mock('../utils/shareCard', async (original) => ({
  ...(await original<typeof ShareCardModule>()),
  drawShareCard: (_ctx: unknown, scene: Scene, _theme: unknown, images: { model?: unknown }) => {
    drawn.kind = scene.kind;
    drawn.model = images.model;
  },
}));

const theme: ShareTheme = {
  kicker: 'Your 2026',
  locale: 'en',
  keys: ['Roll the credits', 'Support on Ko-fi'],
};

const slot: ModelSlot = {
  kind: 'drop',
  x: 0,
  y: 400,
  w: 1080,
  h: 820,
  origin: '50% 73%',
  end: 6,
  look: {
    tint: '#D27800',
    edge: '#2B1700',
    edgeOpacity: 0.3,
    sky: '#FFFFFF',
    ground: '#2B1700',
    rim: '#FFB81C',
    fov: 24,
    elevation: 30,
    fit: 0.9,
  },
};

function request(kind: Scene['kind'], thumbnail: string | null = null): ShareRequest {
  return {
    scene: {
      kind,
      colours: { bg: '#000000', ink: '#FFFFFF' },
      texts: [],
      draw: () => undefined,
      still: 0,
      ...(thumbnail ? { model: slot } : {}),
    },
    thumbnail,
  };
}

beforeEach(() => {
  drawn.kind = null;
  drawn.model = undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => {
    done(new Blob([drawn.kind ?? '']));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShareImage', () => {
  it('draws the settled card and offers it as a PNG', async () => {
    const drawers = request('drawers');
    const { result } = renderHook(() => useShareImage(drawers, theme));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(await result.current?.text()).toBe('drawers');
  });

  it('drops an older render that lands after the card changed', async () => {
    let release: () => void = () => undefined;
    images.load.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(new Image())))
    );
    const first = request('complicated', 'data:image/png;base64,a');
    const second = request('exports');
    const { result, rerender } = renderHook(({ req }) => useShareImage(req, theme), {
      initialProps: { req: first },
    });
    rerender({ req: second });
    await waitFor(() => expect(result.current).not.toBeNull());
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await result.current?.text()).toBe('exports');
  });

  it('falls back to the thumbnail when no 3D canvas is on screen', async () => {
    images.load.mockResolvedValue(new Image());
    const complicated = request('complicated', 'data:image/png;base64,a');
    const { result } = renderHook(() => useShareImage(complicated, theme));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(drawn.model).toBeInstanceOf(HTMLImageElement);
  });

  it('still makes an image when the thumbnail fails to load', async () => {
    images.load.mockRejectedValue(new Error('offline'));
    const complicated = request('complicated', 'data:image/png;base64,a');
    const { result } = renderHook(() => useShareImage(complicated, theme));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(drawn.model).toBeUndefined();
  });
});
