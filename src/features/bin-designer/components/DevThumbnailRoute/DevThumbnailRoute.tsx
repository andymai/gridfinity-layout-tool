/**
 * Dev-only route that renders a single example preset and exposes a capture
 * hook on `window` so a Playwright script can pre-render committed gallery
 * thumbnails. Never ships: gated behind `import.meta.env.DEV` plus the
 * `devThumbnails` query param at the App router level.
 *
 * The route reuses the designer's real generation + preview path
 * (`useGeneration` + `PreviewCanvas`) so the captured image is identical to
 * what the user sees in the designer.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PreviewCanvas } from '@/features/bin-designer/components/PreviewCanvas';
import { useGeneration } from '@/features/bin-designer/hooks/useGeneration';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import {
  captureThumbnailAtPreset,
  exportPreviewGlb,
  __debugSceneMaterials,
} from '@/features/bin-designer/utils/thumbnail';

const THUMBNAIL_SIZE = 512;

interface ThumbnailCaptureBridge {
  __thumbnailReady?: boolean;
  __captureThumbnail?: () => string | null;
  __exportGlb?: () => Promise<string | null>;
}

export function DevThumbnailRoute() {
  const setParams = useDesignerStore((s) => s.setParams);
  const { status, mesh, params } = useDesignerStore(
    useShallow((s) => ({
      status: s.generation.status,
      mesh: s.generation.mesh,
      params: s.params,
    }))
  );

  useGeneration();

  // Load the requested example's params into the store once on mount.
  // `params=<base64 JSON>` renders an arbitrary partial-params design instead
  // (used by gen-seo-images for marketing renders with no gallery example).
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const id = search.get('example');
    const example = EXAMPLE_DESIGNS.find((e) => e.id === id);
    if (example) {
      setParams(example.params);
      return;
    }
    const rawParams = search.get('params');
    if (rawParams) {
      // URLSearchParams decodes an unencoded '+' as a space; also accept
      // base64url payloads so callers don't have to worry about either.
      const normalized = rawParams.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
      try {
        setParams(JSON.parse(atob(normalized)) as Parameters<typeof setParams>[0]);
      } catch (e) {
        console.error('[DevThumbnailRoute] invalid params payload', e);
      }
    }
  }, [setParams]);

  // Once generation completes with a real mesh, publish the capture bridge.
  //
  // R3F's Canvas measures its drawing buffer via a ResizeObserver; if it
  // observed a 0×0 box while the route was first mounting, the buffer locks at
  // zero and captures come back blank. We wait until the route is actually
  // laid out (non-zero rect) and the canvas reports a real size for a few
  // consecutive frames before declaring readiness.
  useEffect(() => {
    if (status !== 'complete' || !mesh?.vertices) return;

    let frame = 0;
    let stableFrames = 0;
    const publish = () => {
      const el = document.getElementById('dev-thumbnail-route');
      const visible = el !== null && el.getBoundingClientRect().width > 0;

      // R3F measures the canvas via a ResizeObserver. If it observed a
      // 0×0 box while the route was suspended (display: none), it locks the
      // drawing buffer at zero and never re-measures on its own. Nudge it
      // with a resize event each frame until the canvas reports a real size.
      const canvas = el?.querySelector('canvas') ?? null;
      const canvasSized = canvas !== null && canvas.clientWidth > 0;
      if (visible && !canvasSized) {
        window.dispatchEvent(new Event('resize'));
      }

      stableFrames = visible && canvasSized ? stableFrames + 1 : 0;

      // Require a short run of stable frames so the font has resettled and
      // R3F has drawn the completed mesh before we sample the canvas.
      if (stableFrames >= 8) {
        const bridge = window as unknown as ThumbnailCaptureBridge;
        bridge.__captureThumbnail = (): string | null =>
          captureThumbnailAtPreset(
            {
              width: params.width,
              depth: params.depth,
              height: params.height,
              gridUnitMm: params.gridUnitMm,
              gridUnitMmY: params.gridUnitMmY,
              heightUnitMm: params.heightUnitMm,
            },
            { size: THUMBNAIL_SIZE, mimeType: 'image/png' }
          );
        bridge.__exportGlb = async (): Promise<string | null> => {
          const buf = await exportPreviewGlb();
          if (!buf) return null;
          let bin = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          return btoa(bin);
        };
        (window as unknown as { __debugScene?: () => unknown }).__debugScene =
          __debugSceneMaterials;
        bridge.__thumbnailReady = true;
        return;
      }
      frame = window.requestAnimationFrame(publish);
    };
    frame = window.requestAnimationFrame(publish);

    return () => window.cancelAnimationFrame(frame);
  }, [
    status,
    mesh,
    params.width,
    params.depth,
    params.height,
    params.gridUnitMm,
    params.gridUnitMmY,
    params.heightUnitMm,
  ]);

  // Fixed, definite-size container so R3F's Canvas measures a non-zero
  // viewport. A collapsed (0×0) layout box yields blank captures.
  return (
    <div
      id="dev-thumbnail-route"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      <PreviewCanvas hideChrome />
    </div>
  );
}
