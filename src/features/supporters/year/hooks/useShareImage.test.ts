import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ShareSpec } from '../components/YearCardView/shareSpec';
import type * as ShareCardModule from '../utils/shareCard';
import type { ShareTheme } from '../utils/shareCard';
import { useShareImage } from './useShareImage';

const drawn: { title: string | null } = { title: null };
vi.mock('../utils/shareCard', async (original) => ({
  ...(await original<typeof ShareCardModule>()),
  drawShareCard: (_ctx: unknown, spec: ShareSpec) => {
    drawn.title = spec.title;
  },
}));

const theme: ShareTheme = {
  accent: '#f59e0b',
  accentText: '#f59e0b',
  appFont: 'Inter',
  pixelFont: '"Press Start 2P"',
  kicker: 'Your 2026',
  site: 'gridfinitylayouttool.com',
};

function card(title: string): ShareSpec {
  return { title, lines: [], visual: { kind: 'big', text: '1' } };
}

const fontLoad = vi.fn<(font: string) => Promise<unknown>>();

beforeEach(() => {
  fontLoad.mockReset().mockResolvedValue([]);
  Object.defineProperty(document, 'fonts', { value: { load: fontLoad }, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => {
    done(new Blob([drawn.title ?? '']));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShareImage', () => {
  it('waits for each new card before it offers an image', async () => {
    const { result, rerender } = renderHook(({ spec }) => useShareImage(spec, theme), {
      initialProps: { spec: card('A') },
    });
    await waitFor(() => expect(result.current).not.toBeNull());
    let release: () => void = () => undefined;
    fontLoad.mockReturnValue(new Promise((resolve) => (release = () => resolve([]))));
    rerender({ spec: card('B') });
    expect(result.current).toBeNull();
    release();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(await result.current?.text()).toBe('B');
  });

  it('drops an older render that lands after the card changed', async () => {
    let releaseOld: () => void = () => undefined;
    fontLoad.mockReturnValueOnce(new Promise((resolve) => (releaseOld = () => resolve([]))));
    const { result, rerender } = renderHook(({ spec }) => useShareImage(spec, theme), {
      initialProps: { spec: card('old') },
    });
    rerender({ spec: card('new') });
    await waitFor(() => expect(result.current).not.toBeNull());
    releaseOld();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await result.current?.text()).toBe('new');
  });

  it('still makes an image when the fonts fail to load', async () => {
    fontLoad.mockRejectedValue(new Error('offline'));
    const spec = card('A');
    const { result } = renderHook(() => useShareImage(spec, theme));
    await waitFor(() => expect(result.current).not.toBeNull());
  });
});
