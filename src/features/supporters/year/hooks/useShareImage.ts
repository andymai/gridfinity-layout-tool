import { useEffect, useState } from 'react';
import type { ShareSpec, ShareVisual } from '../components/YearCardView/shareSpec';
import { SHARE_HEIGHT, SHARE_WIDTH, drawShareCard, type ShareTheme } from '../utils/shareCard';

async function loadImage(visual: ShareVisual): Promise<CanvasImageSource | undefined> {
  let src: string | null = null;
  if (visual.kind === 'canvas') {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'section[aria-roledescription="slide"] canvas'
    );
    if (canvas) return canvas;
    src = visual.thumbnail;
  } else if (visual.kind === 'image') {
    src = visual.src;
  }
  if (!src) return undefined;
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

async function render(spec: ShareSpec, theme: ShareTheme): Promise<Blob | null> {
  // Canvas text uses whatever font is ready; load both first or the image
  // falls back to a system font.
  await Promise.all([
    document.fonts.load(`400 34px ${theme.pixelFont}`),
    document.fonts.load(`700 84px ${theme.appFont}`),
  ]);
  const image = await loadImage(spec.visual);
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawShareCard(ctx, spec, theme, { image });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * The share PNG for a card, rendered ahead of the click: a share sheet needs
 * a fresh user gesture, and drawing inside the click would spend it.
 */
export function useShareImage(spec: ShareSpec | null, theme: ShareTheme): Blob | null {
  const [result, setResult] = useState<{ spec: ShareSpec; blob: Blob } | null>(null);

  useEffect(() => {
    if (!spec) return;
    let cancelled = false;
    render(spec, theme).then(
      (blob) => {
        if (blob && !cancelled) setResult({ spec, blob });
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [spec, theme]);

  return result?.spec === spec ? result.blob : null;
}
