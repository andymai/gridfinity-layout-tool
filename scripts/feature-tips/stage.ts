/**
 * The 3D stage for feature-tip clips: the dev-only `?devThumbnails=1` route
 * (the designer's own generation + PreviewCanvas, chrome hidden), rendered
 * frame by frame from a fixed camera, with the backdrop quad and ghost
 * overlays hidden and the part composited onto each theme's card surface in
 * the page. Each frame comes back as one PNG per theme.
 */

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import type { BinParams } from '../../src/features/bin-designer/types';

export type Theme = 'light' | 'dark';
export type ThemeFrames = Record<Theme, Buffer>;

/**
 * The corners of each visible part's own box. Framing on these, rather than
 * one box around everything, leaves no room for the empty corners of a union:
 * a hinged lid standing open would otherwise shrink the bin to a third.
 */
export interface Bounds {
  points: [number, number, number][];
}

export interface Camera {
  /** Degrees around Z, 0 = +X. The designer's isometric preset is -45. */
  az: number;
  /** Degrees above the XY plane. The isometric preset is ~30.5. */
  el: number;
  /** Fraction of the frame's width and height the part's box may reach. */
  fill: number;
  fov: number;
}

/**
 * The designer's isometric preset (CAMERA_PRESETS.isometric, [0.6, -0.6, 0.5]
 * at CAMERA_FOV 45) raised from ~30 to 55 degrees: at the preset's height the
 * walls hide the floor, scoops and pockets a tip is about. Higher than ~60
 * and a bin flattens into a tray.
 */
export const CLIP_CAMERA: Camera = { az: -45, el: 55, fill: 0.86, fov: 45 };

/** A camera framed on a design: where it looks and how far back it stands. */
export interface View {
  camera: Camera;
  center: [number, number, number];
  dist: number;
}

/** Same angles, eased target and distance: a push in or out between two framings. */
export function lerpView(a: View, b: View, t: number): View {
  return {
    camera: a.camera,
    center: [0, 1, 2].map(
      (i) => (a.center[i] ?? 0) + ((b.center[i] ?? 0) - (a.center[i] ?? 0)) * t
    ) as [number, number, number],
    dist: a.dist + (b.dist - a.dist) * t,
  };
}

export type ParamOverrides = { [K in keyof BinParams]?: unknown };

export interface Stage {
  page: Page;
  setParams(overrides: ParamOverrides): Promise<void>;
  /** Drives the preview's lid slider: mm for a capping/sliding lid, degrees for a hinged one. */
  setLidOffset(value: number): Promise<number>;
  lidOffsetMax(): Promise<number>;
  bounds(): Promise<Bounds>;
  /** Frames `bounds` from the camera's angles so every point fits and the whole is centred. */
  fit(camera: Camera, bounds: Bounds): Promise<View>;
  /** Paints the part in `color` (a palette hex) from the next render on; null restores the preview colour. */
  setTint(color: string | null): void;
  render(view: View): Promise<ThemeFrames>;
  blend(a: ThemeFrames, b: ThemeFrames, t: number): Promise<ThemeFrames>;
  close(): Promise<void>;
}

const GPU_ARGS = [
  '--use-angle=vulkan',
  '--enable-features=Vulkan',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
];

const toBuffer = (dataUrl: string): Buffer => Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');

export async function openStage(
  base: string,
  size: { width: number; height: number },
  surfaces: Record<Theme, string>
): Promise<Stage> {
  const browser: Browser = await chromium.launch({ args: GPU_ARGS });
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    // The PWA worker answers fetches before the dev server sees them.
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    // tsx compiles with keepNames, which wraps named functions in a module-level
    // `__name` helper that does not exist inside page.evaluate.
    w.__name = (f: unknown) => f;
    const observed: unknown[] = [];
    w.__observed = observed;
    w.__THREE_DEVTOOLS__ = {
      dispatchEvent: (e: { detail: unknown }) => observed.push(e.detail),
    };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  let tint: string | null = null;

  const tiny = Buffer.from(JSON.stringify({ width: 1, depth: 1, height: 3 })).toString('base64');
  await page.goto(`${base}/?devThumbnails=1&params=${tiny}`);
  await page.waitForFunction(
    () => (window as unknown as { __thumbnailReady?: boolean }).__thumbnailReady === true,
    null,
    { timeout: 120000 }
  );
  await page.evaluate(installBridge, surfaces);

  return {
    page,
    async setParams(overrides) {
      await page.evaluate(async (o) => {
        const { useDesignerStore } = await import(
          '/src/features/bin-designer/store/designer.ts' as string
        );
        const { DEFAULT_BIN_PARAMS } = await import(
          '/src/features/bin-designer/constants/defaults.ts' as string
        );
        const before = useDesignerStore.getState().generation.mesh;
        const merged: Record<string, unknown> = { ...DEFAULT_BIN_PARAMS };
        for (const [k, v] of Object.entries(o)) {
          const d = merged[k];
          merged[k] =
            v && typeof v === 'object' && !Array.isArray(v) && d && typeof d === 'object'
              ? { ...d, ...v }
              : v;
        }
        // setParams merges, so optional fields a previous design set must be cleared.
        for (const k of ['cellMask', 'surfaceText', 'pullTab'])
          if (!(k in o)) merged[k] = undefined;
        useDesignerStore.getState().setParams(merged);
        // A Manifold draft lands first and can show holes the exact build fills,
        // so wait for a new, exact mesh. A cache hit never replaces the mesh,
        // hence the grace period before an unchanged one counts as built.
        const started = performance.now();
        for (;;) {
          const g = useDesignerStore.getState().generation;
          if (g.status === 'error') throw new Error('generation failed');
          const exact = g.status === 'complete' && !g.isDraft;
          if (exact && (g.mesh !== before || performance.now() - started > 2500)) break;
          if (performance.now() - started > 120000) throw new Error('generation timed out');
          await new Promise((r) => setTimeout(r, 40));
        }
      }, overrides);
      await page.evaluate(() => (window as unknown as Bridge).__tip.settle(6));
    },
    async setLidOffset(value) {
      const applied = await page.evaluate(
        (v) => (window as unknown as Bridge).__tip.setLidOffset(v),
        value
      );
      await page.evaluate(() => (window as unknown as Bridge).__tip.settle(3));
      return applied;
    },
    lidOffsetMax: () => page.evaluate(() => (window as unknown as Bridge).__tip.lidOffsetMax()),
    bounds: () => page.evaluate(() => (window as unknown as Bridge).__tip.bounds()),
    fit: (camera, bounds) =>
      page.evaluate(([c, b]) => (window as unknown as Bridge).__tip.fit(c, b), [
        camera,
        bounds,
      ] as const),
    setTint(color) {
      tint = color;
    },
    async render(view) {
      const urls = await page.evaluate(
        ([v, c]) => (window as unknown as Bridge).__tip.render(v, c),
        [view, tint] as const
      );
      return { light: toBuffer(urls.light), dark: toBuffer(urls.dark) };
    },
    async blend(a, b, t) {
      const urls = await page.evaluate(
        ([x, y, k]) => (window as unknown as Bridge).__tip.blend(x, y, k),
        [
          {
            light: `data:image/png;base64,${a.light.toString('base64')}`,
            dark: `data:image/png;base64,${a.dark.toString('base64')}`,
          },
          {
            light: `data:image/png;base64,${b.light.toString('base64')}`,
            dark: `data:image/png;base64,${b.dark.toString('base64')}`,
          },
          t,
        ] as const
      );
      return { light: toBuffer(urls.light), dark: toBuffer(urls.dark) };
    },
    close: () => browser.close(),
  };
}

interface Bridge {
  __tip: {
    settle(frames: number): Promise<void>;
    setLidOffset(value: number): number;
    lidOffsetMax(): number;
    bounds(): Bounds;
    fit(camera: Camera, bounds: Bounds): View;
    render(view: View, tint: string | null): Record<Theme, string>;
    blend(
      a: Record<Theme, string>,
      b: Record<Theme, string>,
      t: number
    ): Promise<Record<Theme, string>>;
  };
}

async function installBridge(surfaces: Record<Theme, string>): Promise<void> {
  const EDGE_OPACITY = 0.4;
  const w = window as any;
  const renderer = w.__observed.filter((o: any) => o && o.isWebGLRenderer).pop();
  let camera: any = null;
  const original = renderer.render.bind(renderer);
  renderer.render = (s: any, c: any) => {
    camera = c;
    return original(s, c);
  };
  // The canvas renders on demand, so nudge it until one render reveals the camera.
  for (let i = 0; i < 60 && !camera; i++) {
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => requestAnimationFrame(r));
  }
  renderer.render = original;
  if (!camera) throw new Error('preview never rendered');

  const scene = (): any =>
    w.__observed
      .filter((o: any) => o && o.isScene)
      .map((s: any) => {
        let n = 0;
        s.traverse((o: any) => {
          if (o.isMesh) n++;
        });
        return [n, s];
      })
      .sort((a: any, b: any) => b[0] - a[0])[0][1];

  // Everything that isn't the part: the gradient backdrop and the ghost overlays.
  const chrome = (o: any): boolean => o.renderOrder >= 2 || Boolean(o.material?.uniforms?.colorTop);
  const withHidden = <T>(s: any, fn: () => T): T => {
    const hidden: any[] = [];
    s.traverse((o: any) => {
      if (o.visible && chrome(o)) {
        hidden.push(o);
        o.visible = false;
      }
    });
    try {
      return fn();
    } finally {
      for (const o of hidden) o.visible = true;
    }
  };

  const lidInput = (): HTMLInputElement | null =>
    document.querySelector<HTMLInputElement>('#dev-thumbnail-route input[type="range"]');

  const onSurface = (src: HTMLCanvasElement, color: string): string => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    if (!g) throw new Error('no 2d context');
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    return c.toDataURL('image/png');
  };

  // The hemisphere light's ground colour is the one theme-dependent input to
  // the part's shading, so each theme's frame is lit the way that theme's
  // preview lights it.
  const { THREE_COLORS } = await import('/src/shared/hooks/useThemeEffect.ts' as string);
  const hemisphere = (): any => {
    let light: any = null;
    scene().traverse((o: any) => {
      if (o.isHemisphereLight) light = o;
    });
    if (!light) throw new Error('no hemisphere light in the preview scene');
    return light;
  };

  const axes = (cam: Camera) => {
    const V = camera.position.constructor;
    const a = (cam.az * Math.PI) / 180;
    const e = (cam.el * Math.PI) / 180;
    const toCamera = new V(Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e));
    const right = toCamera
      .clone()
      .negate()
      .cross(new V(0, 0, 1))
      .normalize();
    const up = right.clone().cross(toCamera.clone().negate());
    return { toCamera, right, up };
  };

  const load = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

  w.__tip = {
    settle: (frames: number) =>
      new Promise<void>((resolve) => {
        let n = 0;
        const tick = (): void => {
          if (++n >= frames) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    setLidOffset(value: number): number {
      const input = lidInput();
      if (!input) throw new Error('no lid slider: is the lid enabled and built?');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return Number(input.value);
    },
    lidOffsetMax(): number {
      const input = lidInput();
      if (!input) throw new Error('no lid slider: is the lid enabled and built?');
      return Number(input.max);
    },
    bounds(): Bounds {
      const s = scene();
      return withHidden(s, () => {
        const points: [number, number, number][] = [];
        s.updateMatrixWorld(true);
        s.traverse((o: any) => {
          if (!o.visible || !(o.isMesh || o.isLineSegments) || !o.geometry) return;
          for (let p = o; p; p = p.parent) if (!p.visible) return;
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          if (!b || !Number.isFinite(b.min.x)) return;
          const { min, max } = b.clone().applyMatrix4(o.matrixWorld);
          for (const x of [min.x, max.x])
            for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) points.push([x, y, z]);
        });
        if (points.length === 0) throw new Error('nothing visible to frame');
        return { points };
      });
    },
    fit(cam: Camera, bounds: Bounds): View {
      if (!camera) throw new Error('camera not captured yet');
      const V = camera.position.constructor;
      const points = bounds.points.map((p) => new V(...p));
      const center = points
        .reduce((sum: any, p: any) => sum.add(p), new V())
        .multiplyScalar(1 / points.length);
      const canvas = renderer.domElement as HTMLCanvasElement;
      const vf = (cam.fov * Math.PI) / 180;
      const hf = 2 * Math.atan(Math.tan(vf / 2) * (canvas.width / canvas.height));
      const { toCamera, right, up } = axes(cam);
      // Pull back until every point projects inside the frame, then slide the
      // view so the projection is centred; repeat, since the slide moves depths.
      const tanH = Math.tan(hf / 2) * cam.fill;
      const tanV = Math.tan(vf / 2) * cam.fill;
      let dist = 0;
      for (let pass = 0; pass < 4; pass++) {
        dist = 0;
        for (const point of points) {
          const p = point.clone().sub(center);
          const depth = p.dot(toCamera);
          dist = Math.max(
            dist,
            Math.abs(p.dot(right)) / tanH + depth,
            Math.abs(p.dot(up)) / tanV + depth
          );
        }
        let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
        for (const point of points) {
          const p = point.clone().sub(center);
          const depth = dist - p.dot(toCamera);
          const x = p.dot(right) / depth;
          const y = p.dot(up) / depth;
          [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
        }
        center
          .addScaledVector(right, ((x0 + x1) / 2) * dist)
          .addScaledVector(up, ((y0 + y1) / 2) * dist);
      }
      return { camera: cam, center: center.toArray(), dist };
    },
    render(view: View, tint: string | null): Record<Theme, string> {
      if (!camera) throw new Error('camera not captured yet');
      const s = scene();
      // The preview colour drives both the colour and a faint emissive glow;
      // tinting the colour alone leaves a grey glow that washes it out.
      const tinted: [any, number, number | null][] = [];
      if (tint) {
        s.traverse((o: any) => {
          if (!o.isMesh || o.renderOrder >= 2) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (!m?.color) continue;
            const glow = m.emissive && m.emissive.getHex() !== 0 ? m.emissive.getHex() : null;
            tinted.push([m, m.color.getHex(), glow]);
            m.color.set(tint);
            if (glow !== null) m.emissive.set(tint);
          }
        });
      }
      const V = camera.position.constructor;
      const saved = {
        pos: camera.position.clone(),
        up: camera.up.clone(),
        q: camera.quaternion.clone(),
        fov: camera.fov,
        aspect: camera.aspect,
      };
      const canvas = renderer.domElement as HTMLCanvasElement;
      const center = new V(...view.center);
      camera.fov = view.camera.fov;
      camera.aspect = canvas.width / canvas.height;
      camera.position.copy(center).addScaledVector(axes(view.camera).toCamera, view.dist);
      camera.up.set(0, 0, 1);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const clearAlpha = renderer.getClearAlpha();
      const background = s.background;
      s.background = null;
      renderer.setClearAlpha(0);
      // A curved face carries a feature edge per facet seam; at card size those
      // pack into a black patch, so clips draw the edges faint.
      const edges: [any, number, boolean][] = [];
      s.traverse((o: any) => {
        if (o.isLineSegments && o.renderOrder === 1 && o.material) {
          edges.push([o.material, o.material.opacity, o.material.transparent]);
          o.material.transparent = true;
          o.material.opacity = EDGE_OPACITY;
          o.material.needsUpdate = true;
        }
      });
      const hemi = hemisphere();
      const ground = hemi.groundColor.clone();
      // Composite in the same task as the render: the drawing buffer is not preserved.
      const out = withHidden(s, () => {
        const frames: Record<string, string> = {};
        for (const [theme, color] of Object.entries(surfaces) as [Theme, string][]) {
          hemi.groundColor.set(THREE_COLORS[theme].groundBounce);
          renderer.render(s, camera);
          frames[theme] = onSurface(canvas, color);
        }
        return frames as Record<Theme, string>;
      });
      hemi.groundColor.copy(ground);
      for (const [material, hex, glow] of tinted) {
        material.color.setHex(hex);
        if (glow !== null) material.emissive.setHex(glow);
      }
      for (const [material, opacity, transparent] of edges) {
        material.opacity = opacity;
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      renderer.setClearAlpha(clearAlpha);
      s.background = background;
      camera.position.copy(saved.pos);
      camera.up.copy(saved.up);
      camera.quaternion.copy(saved.q);
      camera.fov = saved.fov;
      camera.aspect = saved.aspect;
      camera.updateProjectionMatrix();
      return out;
    },
    async blend(a: Record<Theme, string>, b: Record<Theme, string>, t: number) {
      const out: Record<string, string> = {};
      for (const theme of Object.keys(a) as Theme[]) {
        const [ia, ib] = await Promise.all([load(a[theme]), load(b[theme])]);
        const c = document.createElement('canvas');
        c.width = ia.naturalWidth;
        c.height = ia.naturalHeight;
        const g = c.getContext('2d');
        if (!g) throw new Error('no 2d context');
        g.drawImage(ia, 0, 0);
        g.globalAlpha = t;
        g.drawImage(ib, 0, 0, c.width, c.height);
        out[theme] = c.toDataURL('image/png');
      }
      return out as Record<Theme, string>;
    },
  };
}
