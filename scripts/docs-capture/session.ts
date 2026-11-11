/**
 * One take of a docs shot: a fresh browser on the dev app, on the tips kit's
 * virtual clock, in one theme. A shot sets the app up off camera, then either
 * grabs one still or records takes, which `capture.ts` joins into a clip.
 */

import type { Locator, Page } from '@playwright/test';
import { FPS } from '../feature-tips/encode';
import type { Theme } from '../feature-tips/stage';
import { openUi } from '../feature-tips/ui';
import type { Rect, UiSession } from '../feature-tips/ui';

export type { Rect } from '../feature-tips/ui';

/** Image px per CSS px: crisp on a 2x screen at the docs column width. */
export const SCALE = 2;
/** Dates on screen read as this day in every take. */
const EPOCH = Date.UTC(2026, 10, 2, 16, 30);
export const DESKTOP = { width: 1440, height: 900 };

export interface Viewport {
  width: number;
  height: number;
}

export interface Shot {
  /** The `<Screenshot id>` it fills. */
  id: string;
  kind: 'still' | 'clip';
  viewport?: Viewport;
  /** localStorage entries written before the first load, beside the theme. */
  storage?: Record<string, string>;
  take(s: DocsSession): Promise<void>;
}

export interface TakeResult {
  frames: Buffer[];
  poster: number;
  /** CSS px of the first frame's crop: the size the docs show it at. */
  size: Viewport;
}

export interface DocsSession {
  readonly ui: UiSession;
  readonly page: Page;
  readonly theme: Theme;
  /** Loads an app route and waits until `ready` shows and the page settles. */
  open(path: string, ready: (page: Page) => Locator): Promise<void>;
  /** Imports layout files through the app's own import path; the last one opens. */
  importLayouts(layouts: readonly object[], ready: (page: Page) => Locator): Promise<void>;
  box(target: Locator): Promise<Rect>;
  /**
   * Waits off camera for `target`, stepping the clock: a lazy panel or an
   * animation does not finish while the clock stands still.
   */
  until(target: Locator, timeoutMs?: number): Promise<void>;
  /** Off camera: closes toasts left by the setup. */
  dismissToasts(): Promise<void>;
  /** `zoom` enlarges a small crop, for a panel that would show too small. */
  still(crop: Rect, zoom?: number): Promise<void>;
  /** Records `crop` while `act` runs; consecutive takes join with hard cuts. */
  take(crop: Rect, act: () => Promise<void>, zoom?: number): Promise<void>;
  /** Marks the frame recorded next as the clip's poster. */
  poster(): void;
  /** Presses a shortcut on camera, with a keycap overlay that names it. */
  keys(combo: string, label?: string): Promise<void>;
  /** Types text on camera, one key per frame pair. */
  type(text: string): Promise<void>;
  /** Draws numbered markers (CSS px), for a tour of the window. */
  markers(points: readonly { n: number; x: number; y: number }[]): Promise<void>;
  result(): TakeResult;
  close(): Promise<void>;
}

/** Grows `box` by `margin` and clamps it to `within`. */
export function pad(box: Rect, margin: number, within: Viewport): Rect {
  const x = Math.max(0, box.x - margin);
  const y = Math.max(0, box.y - margin);
  return {
    x,
    y,
    width: Math.min(within.width, box.x + box.width + margin) - x,
    height: Math.min(within.height, box.y + box.height + margin) - y,
  };
}

/**
 * A crop around `box` plus `margin`, grown to `aspect` (width / height) and
 * kept inside `within`, shrinking only if it cannot fit.
 */
export function frameAround(box: Rect, margin: number, aspect: number, within: Rect): Rect {
  let width = box.width + margin * 2;
  let height = box.height + margin * 2;
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;
  const fit = Math.min(1, within.width / width, within.height / height);
  width *= fit;
  height *= fit;
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
  return {
    x: clamp(box.x + box.width / 2 - width / 2, within.x, within.x + within.width - width),
    y: clamp(box.y + box.height / 2 - height / 2, within.y, within.y + within.height - height),
    width,
    height,
  };
}

export function union(...boxes: Rect[]): Rect {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

/** Whole CSS px, so every take of a clip has the same frame size. */
function snap(r: Rect): Rect {
  const x = Math.round(r.x);
  const y = Math.round(r.y);
  return { x, y, width: Math.round(r.width), height: Math.round(r.height) };
}

function overlays(): void {
  const w = window as unknown as Record<string, unknown>;
  const layer = (): HTMLElement => {
    let el = document.getElementById('docs-capture-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'docs-capture-overlay';
      el.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:2147483645;font-family:Inter,system-ui,sans-serif;';
      document.body.appendChild(el);
    }
    return el;
  };
  w.__docs = {
    keycap(label: string, x: number, y: number) {
      const cap = document.createElement('div');
      cap.className = 'docs-capture-keycap';
      cap.textContent = label;
      cap.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,0);padding:6px 12px;border-radius:8px;background:rgba(17,17,17,.88);color:#fff;font-size:15px;font-weight:600;letter-spacing:.02em;box-shadow:0 4px 14px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.18);`;
      layer().appendChild(cap);
    },
    clearKeycaps() {
      for (const el of document.querySelectorAll('.docs-capture-keycap')) el.remove();
    },
    markers(points: { n: number; x: number; y: number }[]) {
      for (const p of points) {
        const m = document.createElement('div');
        m.textContent = String(p.n);
        m.style.cssText = `position:fixed;left:${p.x}px;top:${p.y}px;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#f59e0b;color:#000;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(0,0,0,.55),0 4px 10px rgba(0,0,0,.4);`;
        layer().appendChild(m);
      }
    },
  };
}

interface OverlayHooks {
  __docs: {
    keycap(label: string, x: number, y: number): void;
    clearKeycaps(): void;
    markers(points: { n: number; x: number; y: number }[]): void;
  };
}

export async function openDocsSession(
  base: string,
  theme: Theme,
  shot: Shot
): Promise<DocsSession> {
  const viewport = shot.viewport ?? DESKTOP;
  const storage = {
    'gridfinity-settings-v1': JSON.stringify({ theme }),
    ...shot.storage,
  };
  const ui = await openUi(viewport, theme, storage, {
    deviceScaleFactor: SCALE,
    outputScale: SCALE,
    epoch: EPOCH,
  });
  const { page } = ui;
  await page.context().addInitScript(overlays);
  await page.context().addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const observed: unknown[] = [];
    w.__observed = observed;
    type Renderer = { isWebGLRenderer?: boolean; render(scene: unknown, camera: unknown): void };
    // Three reports each renderer and scene it makes here. The preview renders
    // on demand, so each render records its camera for partBox to project with.
    w.__THREE_DEVTOOLS__ = {
      dispatchEvent: (e: { detail: unknown }) => {
        observed.push(e.detail);
        const r = e.detail as Renderer;
        if (!r.isWebGLRenderer) return;
        const render = r.render.bind(r);
        r.render = (scene, camera) => {
          w.__docsCamera = camera;
          render(scene, camera);
        };
      },
    };
  });
  const frames: Buffer[] = [];
  let poster = -1;
  let size: Viewport | null = null;
  let framed: Rect | null = null;

  const settle = async (ready: (page: Page) => Locator): Promise<void> => {
    await ready(page).first().waitFor({ timeout: 90000 });
    // Lazy panels and fonts land in real time; the clock steps let them paint.
    await page.waitForTimeout(1500);
    await ui.warm(30);
  };

  /**
   * The first take sets the clip's size: its crop times `zoom`. A later take
   * may frame a different area; it keeps the clip's aspect, centred on the
   * crop, and is scaled to the same size, as a close-up cut.
   */
  const record = async (crop: Rect, zoom: number): Promise<void> => {
    const r = snap(crop);
    framed = r;
    if (!size) size = { width: Math.round(r.width * zoom), height: Math.round(r.height * zoom) };
    const scale = (SCALE * size.width) / r.width;
    const height = (SCALE * size.height) / scale;
    await ui.record({ x: r.x, y: r.y + (r.height - height) / 2, width: r.width, height }, scale);
  };

  const session: DocsSession = {
    ui,
    page,
    theme,
    async open(path, ready) {
      await page.goto(`${base}${path}`, { waitUntil: 'load' });
      await settle(ready);
      await session.dismissToasts();
    },
    async importLayouts(layouts, ready) {
      await page.evaluate(async (files) => {
        type Res = { ok: boolean; value?: { library: unknown }; error?: unknown };
        const storage = (await import('/src/core/storage/index.ts' as string)) as {
          importLayoutJSON(json: string): { layout: unknown; errors: string[] };
          createLayoutEntry(layout: unknown, library: unknown, o: object): Promise<Res>;
          deleteLayoutWithEntry(id: string, library: unknown): Promise<Res>;
        };
        const { useLibraryStore } = (await import('/src/core/store/library.ts' as string)) as {
          useLibraryStore: {
            getState(): {
              library: { entries: { id: string }[] };
              setLibrary(l: unknown): void;
            };
          };
        };
        const before = useLibraryStore.getState().library.entries.map((e) => e.id);
        for (const file of files) {
          const { layout, errors } = storage.importLayoutJSON(JSON.stringify(file));
          if (!layout) throw new Error(`fixture does not import: ${errors.join('; ')}`);
          const res = await storage.createLayoutEntry(layout, useLibraryStore.getState().library, {
            activate: true,
          });
          if (!res.ok || !res.value)
            throw new Error(`could not save fixture: ${String(res.error)}`);
          useLibraryStore.getState().setLibrary(res.value.library);
        }
        // The empty layout a first visit makes would sit in every library shot.
        for (const id of before) {
          const res = await storage.deleteLayoutWithEntry(id, useLibraryStore.getState().library);
          if (res.ok && res.value) useLibraryStore.getState().setLibrary(res.value.library);
        }
      }, layouts);
      await page.waitForTimeout(500);
      await page.reload({ waitUntil: 'load' });
      await settle(ready);
      await session.dismissToasts();
    },
    async box(target) {
      const b = await target.boundingBox({ timeout: 8000 });
      if (!b) throw new Error(`no box for ${String(target)}`);
      return b;
    },
    async until(target, timeoutMs = 30000) {
      const end = Date.now() + timeoutMs;
      while (!(await target.isVisible())) {
        if (Date.now() > end) throw new Error(`timed out waiting for ${String(target)}`);
        await ui.warm(2);
        await page.waitForTimeout(100);
      }
      await ui.warm(10);
    },
    async dismissToasts() {
      await page
        .getByRole('button', { name: 'Dismiss notification' })
        .evaluateAll((els) => els.forEach((el) => (el as HTMLElement).click()));
      await ui.warm(20);
    },
    async still(crop, zoom = 1) {
      await ui.hideCursor();
      await record(crop, zoom);
      await ui.hold(1 / FPS);
      frames.push(...ui.stop());
      poster = 0;
    },
    async take(crop, act, zoom = 1) {
      await record(crop, zoom);
      await act();
      frames.push(...ui.stop());
    },
    poster() {
      poster = frames.length;
    },
    async keys(combo, label) {
      // Inside the take's frame, so the keycap is on camera.
      const r = framed ?? { x: 0, y: 0, ...viewport };
      await page.evaluate(
        ([text, x, y]) => (window as unknown as OverlayHooks).__docs.keycap(text, x, y),
        [
          label ?? combo.replace('ControlOrMeta', 'Ctrl'),
          r.x + r.width / 2,
          r.y + r.height - 56,
        ] as const
      );
      await ui.hold(0.25);
      await page.keyboard.press(combo);
      await ui.hold(0.45);
      await page.evaluate(() => (window as unknown as OverlayHooks).__docs.clearKeycaps());
    },
    async type(text) {
      for (const ch of text) {
        await page.keyboard.type(ch);
        await ui.hold(2 / FPS);
      }
    },
    async markers(points) {
      await page.evaluate(
        (p) =>
          (window as unknown as OverlayHooks).__docs.markers(
            p as { n: number; x: number; y: number }[]
          ),
        points
      );
      await ui.warm(2);
    },
    result() {
      if (!size || frames.length === 0) throw new Error(`${shot.id}: nothing recorded`);
      return { frames, poster: poster < 0 ? frames.length - 1 : poster, size };
    },
    close: () => ui.close(),
  };
  return session;
}
