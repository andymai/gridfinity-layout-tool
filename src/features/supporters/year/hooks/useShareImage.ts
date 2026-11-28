import { useEffect, useState } from 'react';
import type { Scene } from '../cards/scene';
import { loadImage } from '../utils/loadImage';
import { SHARE_HEIGHT, SHARE_WIDTH, drawShareCard, type ShareTheme } from '../utils/shareCard';

export interface ShareRequest {
  readonly scene: Scene;
  /** The turning bin's thumbnail, for when no 3D canvas is on screen. */
  readonly thumbnail: string | null;
  /** The card turns a real mesh, so the image waits for its canvas to draw. */
  readonly turns: boolean;
}

/** The 3D canvas, not the thumbnail canvas that stands in while it loads. */
const MODEL_CANVAS = '[data-year-model] [role="img"] canvas';
/** About a second of frames for a just-mounted canvas to draw its first one. */
const DRAW_WAIT_FRAMES = 60;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Whether the canvas holds any drawn pixel yet; a fresh WebGL canvas is clear. */
function hasDrawn(canvas: HTMLCanvasElement): boolean {
  const probe = document.createElement('canvas');
  probe.width = 32;
  probe.height = 32;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true;
  ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
  const data = ctx.getImageData(0, 0, probe.width, probe.height).data;
  for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) return true;
  return false;
}

/** The 3D canvas once it has mounted and drawn; a card stepped to while paused may still be loading it. */
async function drawnModelCanvas(): Promise<HTMLCanvasElement | null> {
  for (let frame = 0; frame < DRAW_WAIT_FRAMES; frame++) {
    const canvas = document.querySelector<HTMLCanvasElement>(MODEL_CANVAS);
    if (canvas && hasDrawn(canvas)) return canvas;
    await nextFrame();
  }
  return null;
}

/** The card's own 3D canvas once it has drawn, else the design's thumbnail. */
async function loadModel(request: ShareRequest): Promise<CanvasImageSource | undefined> {
  if (!request.scene.model) return undefined;
  const canvas = request.turns ? await drawnModelCanvas() : null;
  if (canvas) return canvas;
  if (!request.thumbnail) return undefined;
  return loadImage(request.thumbnail);
}

async function render(request: ShareRequest, theme: ShareTheme): Promise<Blob | null> {
  // A thumbnail that fails to load still leaves a card worth saving.
  const model = await loadModel(request).catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawShareCard(ctx, request.scene, theme, { model });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * The share PNG for a card, rendered ahead of the click: a share sheet needs
 * a fresh user gesture, and drawing inside the click would spend it.
 */
export function useShareImage(request: ShareRequest | null, theme: ShareTheme): Blob | null {
  const [result, setResult] = useState<{ request: ShareRequest; blob: Blob } | null>(null);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    render(request, theme).then(
      (blob) => {
        if (blob && !cancelled) setResult({ request, blob });
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [request, theme]);

  return result?.request === request ? result.blob : null;
}
