/**
 * A designer session on a virtual clock, for clips of a workspace in use.
 *
 * The page only advances when a frame is recorded (performance.now, Date.now,
 * requestAnimationFrame and CSS animations are all stepped by hand), so
 * geometry builds land between frames and the footage stays smooth however
 * slow the build. Headless Chromium draws no cursor, so one is drawn into the
 * page, with a ring that pulses on each click.
 */

import { chromium } from '@playwright/test';
import type { Browser, CDPSession, Locator, Page } from '@playwright/test';
import type { DesignerStoreModule } from './appModules';
import { FPS, FRAME_PX } from './encode';
import type { Theme } from './stage';

const STEP_MS = 1000 / FPS;
const GPU_ARGS = [
  '--use-angle=vulkan',
  '--enable-features=Vulkan',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function clockInit(): void {
  const w = window as unknown as Record<string, unknown>;
  w.__name = (f: unknown) => f;
  let now = 0;
  let seed = 4242;
  const epoch = Date.now();
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  performance.now = () => now;
  Date.now = () => epoch + now;
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    queue.delete(id);
  };
  const started = new WeakMap<Animation, number>();
  w.__vt = {
    step(ms: number) {
      now += ms;
      const due = queue;
      queue = new Map();
      for (const cb of due.values()) {
        try {
          cb(now);
        } catch (e) {
          console.error(e);
        }
      }
      for (const a of document.getAnimations()) {
        if (!started.has(a)) {
          started.set(a, now - Number(a.currentTime ?? 0));
          a.pause();
        }
        a.currentTime = now - (started.get(a) ?? now);
      }
    },
  };

  const cursor = document.createElement('div');
  const SVG = 'http://www.w3.org/2000/svg';
  const arrow = document.createElementNS(SVG, 'svg');
  for (const [k, v] of Object.entries({ width: '26', height: '32', viewBox: '0 0 26 32' }))
    arrow.setAttribute(k, v);
  const outline = document.createElementNS(SVG, 'path');
  for (const [k, v] of Object.entries({
    d: 'M2 2 L2 25 L8 19.5 L12.2 29 L16.4 27.2 L12.3 18 L20 18 Z',
    fill: '#fff',
    stroke: '#111',
    'stroke-width': '2',
    'stroke-linejoin': 'round',
  }))
    outline.setAttribute(k, v);
  arrow.appendChild(outline);
  cursor.appendChild(arrow);
  cursor.style.cssText =
    'position:fixed;left:-100px;top:-100px;width:26px;height:32px;margin:-2px 0 0 -2px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));transition:transform 90ms ease-out;';
  const ring = document.createElement('div');
  ring.style.cssText =
    'position:fixed;left:-100px;top:-100px;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid rgba(245,158,11,.95);pointer-events:none;z-index:2147483646;opacity:0;transform:scale(.4);';
  const mount = (): void => {
    if (document.body && !cursor.isConnected) {
      document.body.appendChild(ring);
      document.body.appendChild(cursor);
    }
  };
  document.addEventListener('DOMContentLoaded', mount);
  w.__cursor = {
    at(x: number, y: number) {
      mount();
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    },
    press() {
      cursor.style.transform = 'scale(.86)';
    },
    release(x: number, y: number) {
      cursor.style.transform = 'scale(1)';
      ring.style.transition = 'none';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      ring.style.opacity = '1';
      ring.style.transform = 'scale(.4)';
      void ring.offsetWidth;
      ring.style.transition = 'opacity 260ms ease-out, transform 260ms ease-out';
      ring.style.opacity = '0';
      ring.style.transform = 'scale(1.6)';
    },
  };
}

interface PageHooks {
  __vt: { step(ms: number): void };
  __cursor: {
    at(x: number, y: number): void;
    press(): void;
    release(x: number, y: number): void;
  };
}

export interface UiSession {
  page: Page;
  /** Starts recording frames of `crop` (CSS px of the viewport). */
  /** Starts recording `crop` (CSS px, 4:3), re-rasterised to fill the frame. */
  record(crop: Rect): Promise<void>;
  /** Stops recording and returns the frames since `record`. */
  stop(): Buffer[];
  warm(frames: number): Promise<void>;
  hold(seconds: number): Promise<void>;
  park(x: number, y: number): Promise<void>;
  moveTo(x: number, y: number): Promise<void>;
  click(target: Locator): Promise<void>;
  clickAt(x: number, y: number): Promise<void>;
  drag(from: [number, number], to: [number, number], frames: number): Promise<void>;
  /** Eases the target's scroller so it sits in view, on camera, as a person would scroll. */
  reveal(target: Locator): Promise<void>;
  /** Off camera: puts the target in view and clicks it. */
  preClick(target: Locator): Promise<void>;
  /** Off camera: centres the target in its scroller. */
  preReveal(target: Locator): Promise<void>;
  /** Waits off camera for the designer's exact build, then lets the page catch up. */
  waitBuilt(): Promise<void>;
  designerParams(): Promise<unknown>;
  hideCursor(): Promise<void>;
  close(): Promise<void>;
}

export async function openUi(
  viewport: { width: number; height: number },
  theme: Theme,
  storage: Record<string, string>
): Promise<UiSession> {
  const browser: Browser = await chromium.launch({ args: GPU_ARGS });
  const ctx = await browser.newContext({
    viewport,
    // Close-ups magnify 3 to 4x; canvases keep the backing store they were
    // given, so they need the density up front to stay sharp.
    deviceScaleFactor: 4,
    colorScheme: theme,
    serviceWorkers: 'block',
  });
  await ctx.addInitScript((entries) => {
    try {
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
    } catch {
      // A storage-less page still renders; it just starts from defaults.
    }
  }, storage);
  await ctx.addInitScript(clockInit);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  const cdp: CDPSession = await ctx.newCDPSession(page);

  let crop: Rect | null = null;
  let frames: Buffer[] = [];
  let cx = viewport.width / 2;
  let cy = viewport.height / 2;
  let buttons = 0;

  const step = (ms = STEP_MS) =>
    page.evaluate((v) => (window as unknown as PageHooks).__vt.step(v), ms);
  const frame = async (): Promise<void> => {
    await step();
    if (!crop) return;
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { ...crop, scale: FRAME_PX.width / crop.width },
    });
    frames.push(Buffer.from(data, 'base64'));
  };
  const mouse = (type: string): Promise<unknown> =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x: cx,
      y: cy,
      button: type === 'mouseMoved' && !buttons ? 'none' : 'left',
      buttons,
      clickCount: 1,
    } as never);
  const drawCursor = () =>
    page.evaluate(([x, y]) => (window as unknown as PageHooks).__cursor.at(x, y), [
      cx,
      cy,
    ] as const);

  const session: UiSession = {
    page,
    async record(rect) {
      crop = rect;
      frames = [];
      // A scaled capture re-rasterises the page, and a WebGL canvas that has not
      // redrawn since comes back blank; one discarded capture and a step let it.
      await frame();
      frames = [];
      await session.warm(2);
    },
    stop() {
      crop = null;
      return frames;
    },
    async warm(n) {
      for (let i = 0; i < n; i++) await step();
    },
    async hold(seconds) {
      for (let i = 0; i < Math.round(seconds * FPS); i++) await frame();
    },
    async park(x, y) {
      cx = x;
      cy = y;
      await mouse('mouseMoved');
      await drawCursor();
    },
    async moveTo(x, y) {
      const n = Math.max(6, Math.min(16, Math.round(Math.hypot(x - cx, y - cy) / 60)));
      const [x0, y0] = [cx, cy];
      for (let i = 1; i <= n; i++) {
        const e = easeInOut(i / n);
        cx = x0 + (x - x0) * e;
        cy = y0 + (y - y0) * e;
        await mouse('mouseMoved');
        await drawCursor();
        await frame();
      }
    },
    async click(target) {
      await session.reveal(target);
      const b = await target.boundingBox({ timeout: 8000 });
      if (!b) throw new Error(`no box for ${String(target)}`);
      await session.clickAt(b.x + b.width / 2, b.y + b.height / 2);
    },
    async clickAt(x, y) {
      await session.moveTo(x, y);
      await session.hold(0.06);
      await page.evaluate(() => (window as unknown as PageHooks).__cursor.press());
      buttons = 1;
      await mouse('mousePressed');
      await frame();
      buttons = 0;
      await mouse('mouseReleased');
      await page.evaluate(([x, y]) => (window as unknown as PageHooks).__cursor.release(x, y), [
        cx,
        cy,
      ] as const);
      await session.hold(0.12);
    },
    async drag(from, to, n) {
      await session.moveTo(...from);
      await page.evaluate(() => (window as unknown as PageHooks).__cursor.press());
      buttons = 1;
      await mouse('mousePressed');
      await frame();
      for (let i = 1; i <= n; i++) {
        const e = easeInOut(i / n);
        cx = from[0] + (to[0] - from[0]) * e;
        cy = from[1] + (to[1] - from[1]) * e;
        await mouse('mouseMoved');
        await drawCursor();
        await frame();
      }
      buttons = 0;
      await mouse('mouseReleased');
      await page.evaluate(([x, y]) => (window as unknown as PageHooks).__cursor.release(x, y), [
        cx,
        cy,
      ] as const);
      await session.hold(0.06);
    },
    async reveal(target) {
      const b = await target.boundingBox({ timeout: 8000 });
      if (!b) return;
      const scroller = await target.evaluateHandle((el) => {
        let n = el.parentElement;
        while (
          n &&
          !(
            n.scrollHeight > n.clientHeight + 4 &&
            /(auto|scroll)/.test(getComputedStyle(n).overflowY)
          )
        )
          n = n.parentElement;
        return n ?? document.scrollingElement ?? document.body;
      });
      const box = await scroller.asElement()?.boundingBox();
      if (!box) return;
      const top = Math.max(box.y + 30, 0);
      const bottom = Math.min(box.y + box.height - 20, viewport.height - 20);
      if (b.y > top && b.y + b.height < bottom) return;
      const dy = b.y - (box.y + box.height * 0.5);
      await session.moveTo(box.x + box.width * 0.5, box.y + box.height * 0.5);
      const start = await scroller.evaluate((el) => (el as Element).scrollTop);
      const n = Math.min(18, Math.max(8, Math.round(Math.abs(dy) / 30)));
      for (let i = 1; i <= n; i++) {
        await scroller.evaluate(
          (el, v) => {
            (el as Element).scrollTop = v;
          },
          start + dy * easeInOut(i / n)
        );
        await frame();
      }
    },
    async preReveal(target) {
      await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await session.warm(6);
    },
    async preClick(target) {
      await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await session.warm(6);
      // Actionability waits never settle on a frozen clock.
      await target.click({ force: true });
      await session.warm(6);
    },
    async waitBuilt() {
      await page.waitForTimeout(300);
      for (let i = 0; ; i++) {
        const status = await page.evaluate(async () => {
          const { useDesignerStore } = (await import(
            '/src/features/bin-designer/store/designer.ts' as string
          )) as DesignerStoreModule;
          const g = useDesignerStore.getState().generation;
          return g.status === 'complete' && !g.isDraft ? 'built' : g.status;
        });
        if (status === 'built') break;
        if (status === 'error') throw new Error('generation failed');
        if (i >= 400) throw new Error('generation did not finish within 60 s');
        await session.warm(2);
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(600);
      await session.warm(12);
    },
    designerParams: () =>
      page.evaluate(async () => {
        const { useDesignerStore } = (await import(
          '/src/features/bin-designer/store/designer.ts' as string
        )) as DesignerStoreModule;
        // Playwright serialises the returned object, which also detaches it from the store.
        return useDesignerStore.getState().params as unknown;
      }),
    hideCursor: () => page.evaluate(() => (window as unknown as PageHooks).__cursor.at(-100, -100)),
    close: () => browser.close(),
  };
  return session;
}
