/**
 * Openers for the bin designer and the baseplate generator. Each loads the
 * route, sets the state a shot needs through the app's own stores, and waits
 * for the exact build, so the first recorded frame shows the finished part.
 */

import type { Locator, Page } from '@playwright/test';
import { layoutFile } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import type { DocsSession, Rect } from '../session';

export type Params = Record<string, unknown>;

export const designerReady = (page: Page): Locator =>
  page.getByRole('button', {
    name: label('common.increaseAria', { what: label('common.height') }),
  });

/**
 * The bin designer on a new design named `name`, with `params` merged into
 * the defaults all the way down, so a shot names only what it changes.
 */
export async function openDesigner(s: DocsSession, name: string, params: Params): Promise<void> {
  await s.open('/designer', designerReady);
  await setDesign(s, name, params);
}

export async function setDesign(s: DocsSession, name: string, params: Params): Promise<void> {
  await s.page.evaluate(
    async ([n, p]) => {
      const { useDesignerStore } = (await import(
        '/src/features/bin-designer/store/designer.ts' as string
      )) as {
        useDesignerStore: {
          getState(): {
            newDesign(kind: 'bin'): void;
            setParams(params: Params): void;
            setDesignName(name: string): void;
          };
        };
      };
      const { DEFAULT_BIN_PARAMS } = (await import(
        '/src/features/bin-designer/constants/defaults.ts' as string
      )) as { DEFAULT_BIN_PARAMS: Params };
      const isRecord = (x: unknown): x is Params =>
        typeof x === 'object' && x !== null && !Array.isArray(x);
      const deepMerge = (d: unknown, v: unknown): unknown => {
        if (!isRecord(d) || !isRecord(v)) return v;
        const out: Params = { ...d };
        for (const [k, x] of Object.entries(v)) out[k] = deepMerge(d[k], x);
        return out;
      };
      const store = useDesignerStore.getState();
      store.newDesign('bin');
      // The store freezes what it holds, and some setters write into their input.
      store.setParams(structuredClone(deepMerge(DEFAULT_BIN_PARAMS, p)) as Params);
      store.setDesignName(n);
    },
    [name, params] as const
  );
  await s.ui.waitBuilt();
  await s.dismissToasts();
}

export const baseplateReady = (page: Page): Locator =>
  page.getByRole('tab', { name: label('toolSwitcher.baseplateGenerator'), selected: true });

/** The baseplate generator on `layout`, the drawer it follows, once its plate is built. */
export async function openBaseplate(s: DocsSession, layout: FixtureLayout): Promise<void> {
  await s.open('/baseplate', baseplateReady);
  await s.importLayouts([layoutFile(layout)], baseplateReady);
  await waitBaseplate(s);
}

/** Waits off camera for the plate (every piece, when it splits), then lets the page paint. */
export async function waitBaseplate(s: DocsSession): Promise<void> {
  await s.page.waitForTimeout(300);
  for (let i = 0; ; i++) {
    const status = await s.page.evaluate(async () => {
      const { useBaseplatePageStore } = (await import(
        '/src/features/baseplate/store/baseplatePageStore.ts' as string
      )) as {
        useBaseplatePageStore: {
          getState(): { generation: { status: string }; splitProgress: unknown };
        };
      };
      const st = useBaseplatePageStore.getState();
      return st.splitProgress ? 'generating' : st.generation.status;
    });
    if (status === 'complete') break;
    if (status === 'error') throw new Error('baseplate generation failed');
    if (i >= 600) throw new Error('baseplate did not finish within 90 s');
    await s.ui.warm(2);
    await s.page.waitForTimeout(150);
  }
  await s.page.waitForTimeout(600);
  await s.ui.warm(12);
  await s.dismissToasts();
}

/**
 * The screen box (CSS px) of the generated part in the 3D preview: the
 * corners of each built mesh's bounds, projected through the camera the
 * preview last rendered with. Text, floor and overlays have too few
 * triangles to count, so labels on the floor do not widen the box.
 */
export async function partBox(s: DocsSession): Promise<Rect> {
  return s.page.evaluate(() => {
    type V = {
      x: number;
      y: number;
      z: number;
      set(x: number, y: number, z: number): V;
      applyMatrix4(m: unknown): V;
      project(c: unknown): V;
      clone(): V;
    };
    type Obj = {
      visible: boolean;
      parent: Obj | null;
      isMesh?: boolean;
      isScene?: boolean;
      matrixWorld: unknown;
      geometry?: {
        index: { count: number } | null;
        attributes: { position?: { count: number } };
        computeBoundingBox(): void;
        boundingBox: { min: V; max: V } | null;
      };
      traverse(fn: (o: Obj) => void): void;
      updateMatrixWorld(force: boolean): void;
    };
    const w = window as unknown as { __observed: unknown[]; __docsCamera?: { position: V } };
    const camera = w.__docsCamera;
    if (!camera) throw new Error('the preview never rendered');
    let scene: Obj | null = null;
    let most = -1;
    for (const o of w.__observed as Obj[]) {
      if (!o.isScene) continue;
      let n = 0;
      o.traverse((x) => {
        if (x.isMesh) n++;
      });
      if (n > most) {
        most = n;
        scene = o;
      }
    }
    if (!scene) throw new Error('no scene reported by the devtools hook');
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('no canvas');
    const r = canvas.getBoundingClientRect();
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      for (let p: Obj | null = o; p; p = p.parent) if (!p.visible) return;
      const triangles = (o.geometry.index?.count ?? o.geometry.attributes.position?.count ?? 0) / 3;
      if (triangles < 200) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      if (!b || !Number.isFinite(b.min.x)) return;
      for (const x of [b.min.x, b.max.x])
        for (const y of [b.min.y, b.max.y])
          for (const z of [b.min.z, b.max.z]) {
            const v = camera.position
              .clone()
              .set(x, y, z)
              .applyMatrix4(o.matrixWorld)
              .project(camera);
            const sx = r.left + ((v.x + 1) / 2) * r.width;
            const sy = r.top + ((1 - v.y) / 2) * r.height;
            [x0, y0, x1, y1] = [
              Math.min(x0, sx),
              Math.min(y0, sy),
              Math.max(x1, sx),
              Math.max(y1, sy),
            ];
          }
    });
    if (!Number.isFinite(x0)) throw new Error('no built part in the preview');
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  });
}
