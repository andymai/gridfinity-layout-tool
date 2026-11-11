import type { Locator } from '@playwright/test';
import { DEFAULT_CATEGORIES, WORKSHOP_CATEGORIES } from '../fixtures';
import type { FixtureBin, FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { designerReady, setDesign } from './apps';
import type { Params } from './apps';
import { cellCenter, grid, gridArea, openLayouts } from './layoutEditor';

const WINDOW: Rect = { x: 0, y: 0, ...DESKTOP };
/** Below the app header. */
const WORKSPACE: Rect = { x: 0, y: 48, width: DESKTOP.width, height: DESKTOP.height - 48 };

/**
 * The payoff hold as a take of its own on the same crop: frames join the clip
 * only when a take ends, so `s.poster()` inside a take marks its first frame.
 */
async function payoff(s: DocsSession, area: Rect, seconds: number): Promise<void> {
  await s.take(area, async () => {
    s.poster();
    await s.ui.hold(seconds);
  });
}

/** Four bins on the grid, three waiting in the stash, a 2 x 2 gap at the back right. */
const TOOL_DRAWER: FixtureLayout = {
  name: 'Tool drawer',
  width: 5,
  depth: 4,
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 6 }],
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 0, w: 2, d: 2, h: 6, label: 'Wire nuts', cat: 'Electrical' },
    { x: 0, y: 2, w: 3, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
  stash: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Zip ties', cat: 'Electrical' },
    { x: 0, y: 0, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 0, y: 0, w: 2, d: 1, h: 6, label: 'Fuses', cat: 'Spares' },
  ],
};

const placingStash: Shot = {
  id: 'layouts-placing-bins-stash',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, TOOL_DRAWER);
    const stash = await s.box(s.page.getByText(label('staging.stash'), { exact: true }).first());
    const zipTies = await s.box(
      s.page.locator('[data-staging-bin-id]', { hasText: 'Zip ties' }).first()
    );
    const cells = await gridArea(s, TOOL_DRAWER.width, TOOL_DRAWER.depth);
    const to = await cellCenter(s, 4, 3);
    const back = await cellCenter(s, 5, 4);
    const area = pad(union(cells, stash, zipTies), 16, DESKTOP);
    // On the empty stash cell right of the bin, at a fixed offset from it, so the
    // move to the bin takes as many frames in both themes. Over a bin, the
    // cursor would show its hover buttons.
    await s.ui.park(zipTies.x + zipTies.width + 60, zipTies.y + zipTies.height * 0.25);
    const drop: [number, number] = [(to[0] + back[0]) / 2, (to[1] + back[1]) / 2];
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.drag([zipTies.x + zipTies.width / 2, zipTies.y + zipTies.height / 2], drop, 24);
      // Off the bin's label, still inside the bin.
      await s.ui.moveTo(drop[0] + 60, drop[1] + 55);
      await s.ui.hold(0.2);
    });
    await payoff(s, area, 1.6);
  },
};

/** Bins on every cell but a 2 x 2 gap at the back right. */
const GAP_DRAWER: FixtureLayout = {
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 6 }],
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 0, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 2, y: 1, w: 2, d: 1, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 4, y: 0, w: 2, d: 2, h: 6, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 0, y: 2, w: 2, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
    { x: 2, y: 2, w: 2, d: 2, h: 6, label: 'Driver bits', cat: 'Bits' },
  ],
};

interface CommunityFixture {
  name: string;
  author: string;
  category: string;
  techniques: string[];
  likes: number;
  /** Merged into the designer defaults; `width`, `depth` and `height` in units. */
  params: Params & { width: number; depth: number; height: number };
}

/** Made-up community designs. The first six fit a 2 x 2 gap under a 12u drawer. */
const COMMUNITY: CommunityFixture[] = [
  {
    name: 'Screw sorter, nine cups',
    author: 'benchtinker',
    category: 'hardware',
    techniques: ['compartments'],
    likes: 41,
    params: {
      width: 2,
      depth: 2,
      height: 3,
      compartments: { cols: 3, rows: 3, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    },
  },
  {
    name: 'Bit tray with label',
    author: 'shopnotes',
    category: 'tools',
    techniques: ['labelTab', 'compartments'],
    likes: 26,
    params: {
      width: 2,
      depth: 2,
      height: 4,
      label: { enabled: true },
      compartments: { cols: 1, rows: 2, cells: [0, 1] },
    },
  },
  {
    name: 'Deep scoop bin',
    author: 'garage.grid',
    category: 'hardware',
    techniques: ['scoop'],
    likes: 18,
    params: { width: 2, depth: 2, height: 6, scoop: { enabled: true } },
  },
  {
    name: 'AA battery caddy',
    author: 'solderblob',
    category: 'electronics',
    techniques: ['compartments'],
    likes: 22,
    params: {
      width: 2,
      depth: 1,
      height: 4,
      compartments: { cols: 4, rows: 1, cells: [0, 1, 2, 3] },
    },
  },
  {
    name: 'Small parts scoop',
    author: 'shopnotes',
    category: 'hardware',
    techniques: ['scoop'],
    likes: 15,
    params: { width: 1, depth: 2, height: 3, scoop: { enabled: true } },
  },
  {
    name: 'Pencil cup',
    author: 'deskdrawer',
    category: 'office',
    techniques: [],
    likes: 12,
    params: { width: 1, depth: 1, height: 6 },
  },
  {
    name: 'Wrench rack',
    author: 'benchtinker',
    category: 'tools',
    techniques: ['slotted'],
    likes: 33,
    params: { width: 4, depth: 2, height: 3 },
  },
  {
    name: 'Spice jar tray',
    author: 'kitchenbins',
    category: 'kitchen',
    techniques: [],
    likes: 19,
    params: { width: 3, depth: 2, height: 5 },
  },
  {
    name: 'Tall marker caddy',
    author: 'deskdrawer',
    category: 'office',
    techniques: ['compartments'],
    likes: 9,
    params: { width: 2, depth: 2, height: 14 },
  },
];

/**
 * Builds each design in the bin designer and takes its card picture there, as
 * a publish does, then answers the gallery's list request with the cards.
 * Designs the gap filter hides need no picture.
 */
async function serveCommunity(
  s: DocsSession,
  designs: CommunityFixture[],
  shown: number
): Promise<void> {
  await s.open('/designer', designerReady);
  const thumbs: string[] = [];
  for (const d of designs.slice(0, shown)) {
    await setDesign(s, d.name, d.params);
    thumbs.push(
      await s.page.evaluate(
        async (frame) => {
          const { captureThumbnailAtPreset } = (await import(
            '/src/features/bin-designer/utils/thumbnail.ts' as string
          )) as { captureThumbnailAtPreset(frame: object): string | null };
          const url = captureThumbnailAtPreset({ ...frame, gridUnitMm: 42, heightUnitMm: 7 });
          if (!url) throw new Error('no thumbnail from the designer preview');
          return url;
        },
        { width: d.params.width, depth: d.params.depth, height: d.params.height }
      )
    );
  }
  const day = 86_400_000;
  const published = Date.UTC(2026, 8, 1);
  const items = designs.map((d, i) => ({
    id: `docs-design-${i + 1}`,
    name: d.name,
    authorName: d.author,
    authorPublicId: `docs-author-${d.author}`,
    category: d.category,
    techniques: d.techniques,
    // The server's metrics are outer millimetres, less the 0.5 mm fit tolerance.
    metrics: {
      width: d.params.width * 42 - 0.5,
      depth: d.params.depth * 42 - 0.5,
      height: d.params.height * 7,
      gridUnitMm: 42,
    },
    thumbnailUrl: thumbs[i] ?? '',
    isRemix: false,
    featured: false,
    counts: { likes: d.likes, remixes: Math.round(d.likes / 9), exports: d.likes * 3, prints: 2 },
    createdAt: published + i * day,
    updatedAt: published + i * day,
    status: 'live',
  }));
  await s.page.route(
    (url) => url.pathname === '/api/community',
    (route) => route.fulfill({ json: { items, nextCursor: null } })
  );
}

/** The button pressed and a drag across the gap, then a cut to the designs that fit it. */
const findBinsToolbar: Shot = {
  id: 'layouts-find-bins-toolbar',
  kind: 'clip',
  async take(s) {
    await serveCommunity(s, COMMUNITY, 6);
    await openLayouts(s, GAP_DRAWER);
    const button = s.page.getByRole('button', { name: label('toolbar.findBins') });
    const cells = await gridArea(s, GAP_DRAWER.width, GAP_DRAWER.depth);
    const area = frameAround(union(await s.box(button), cells), 16, 4 / 3, WORKSPACE);
    const from = await cellCenter(s, 5, 3);
    const to = await cellCenter(s, 6, 4);
    const toolbar = await s.box(button);
    // On the toolbar's empty middle: over the grid, the cursor would light up a row or column.
    await s.ui.park(area.x + area.width * 0.5, toolbar.y + toolbar.height / 2);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(button);
      await s.ui.hold(0.5);
      await s.ui.drag(from, to, 26);
    });
    await s.ui.hideCursor();
    const dialog = s.page.getByRole('dialog').first();
    await s.until(s.page.locator('[data-community-card] img').first());
    await s.page.waitForTimeout(1000);
    await s.ui.warm(30);
    await s.take(frameAround(await s.box(dialog), 6, 4 / 3, WINDOW), async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

/**
 * Four bins of different heights in a loose row at the left, on the bottom
 * layer. The selection toolbar's left edge sits at the selection's centre, so
 * a selection on the left keeps the toolbar over the grid.
 */
const BENCH_DRAWER: FixtureLayout = {
  name: 'Bench drawer',
  width: 8,
  depth: 4,
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [
    { name: 'Layer 1', height: 4 },
    { name: 'Layer 2', height: 2 },
  ],
  bins: [
    { x: 0, y: 0, w: 1, d: 2, h: 6, label: 'Pliers', cat: 'Hand tools' },
    { x: 1, y: 0, w: 1, d: 1, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 2, y: 1, w: 1, d: 1, h: 3, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 0, w: 1, d: 2, h: 5, label: 'Fuses', cat: 'Spares' },
    { x: 4, y: 0, w: 2, d: 2, h: 3, label: 'Zip ties', cat: 'Electrical' },
    { x: 6, y: 0, w: 2, d: 2, h: 3, label: 'Drill bits', cat: 'Bits' },
    { x: 6, y: 2, w: 2, d: 2, h: 3, label: 'Hex keys', cat: 'Hand tools' },
    { x: 0, y: 3, w: 4, d: 1, h: 3, label: 'Tape measure', cat: 'Hand tools' },
    { x: 4, y: 3, w: 2, d: 1, h: 3, label: 'Wire nuts', cat: 'Electrical' },
    { x: 4, y: 0, w: 2, d: 1, h: 2, label: 'Blades', cat: 'Spares', layer: 1 },
  ],
};

interface PageHooks {
  __cursor: { press(): void; release(x: number, y: number): void };
  __docs: { keycap(label: string, x: number, y: number): void; clearKeycaps(): void };
}

/**
 * A bin's centre. A click near a bin's bottom edge selected its neighbour
 * instead, so clicks go to the middle.
 */
async function middle(s: DocsSession, target: Locator): Promise<[number, number]> {
  const b = await s.box(target);
  return [b.x + b.width / 2, b.y + b.height / 2];
}

/**
 * A click with Ctrl held. The kit clicks through raw input events, which carry
 * no modifier keys, so the press goes through Playwright's mouse once the drawn
 * cursor is there.
 */
async function ctrlClick(s: DocsSession, target: Locator): Promise<void> {
  const [x, y] = await middle(s, target);
  await s.ui.moveTo(x, y);
  await s.ui.hold(0.06);
  await s.page.mouse.move(x, y);
  await s.page.keyboard.down('Control');
  await s.page.evaluate(() => (window as unknown as PageHooks).__cursor.press());
  await s.page.mouse.down();
  await s.page.mouse.up();
  // The press hides the bin as a drag would, until the next frame or two.
  await s.ui.warm(2);
  await s.page.evaluate(([px, py]) => (window as unknown as PageHooks).__cursor.release(px, py), [
    x,
    y,
  ] as const);
  await s.page.keyboard.up('Control');
  await s.ui.hold(0.3);
}

/** A keycap held on screen at the bottom of `frame`, as `s.keys` draws one. */
async function showKeycap(s: DocsSession, text: string, frame: Rect): Promise<void> {
  await s.page.evaluate(([t, x, y]) => (window as unknown as PageHooks).__docs.keycap(t, x, y), [
    text,
    frame.x + frame.width / 2,
    frame.y + frame.height - 56,
  ] as const);
}

async function clearKeycaps(s: DocsSession): Promise<void> {
  await s.page.evaluate(() => (window as unknown as PageHooks).__docs.clearKeycaps());
}

const SELECTED = ['Pliers', 'Sockets', 'M3', 'Fuses'] as const;

/** One click, then three Ctrl+clicks, and the selection toolbar appears above the bins. */
const multiSelectToolbar: Shot = {
  id: 'layouts-multi-select-toolbar',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, BENCH_DRAWER);
    const bin = (name: string): Locator =>
      s.page.locator('[data-bin-id]', { hasText: name }).first();
    const [first, ...rest] = SELECTED;
    // Off camera, once, to frame the toolbar where it appears.
    await s.ui.clickAt(...(await middle(s, bin(first))));
    for (const name of rest) await ctrlClick(s, bin(name));
    const toolbar = s.page.getByRole('toolbar', { name: label('selectionToolbar.ariaLabel') });
    await s.until(toolbar);
    const cells = await gridArea(s, BENCH_DRAWER.width, BENCH_DRAWER.depth);
    const area = pad(union(await s.box(toolbar), cells), 12, DESKTOP);
    await s.page.keyboard.press('Escape');
    await s.ui.warm(10);
    await s.dismissToasts();
    // Below the column numbers: over a bin or a row or column number, the cursor lights it up.
    await s.ui.park(area.x + area.width * 0.3, area.y + area.height + 30);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(...(await middle(s, bin(first))));
      await s.ui.hold(0.3);
      await showKeycap(s, 'Ctrl', area);
      for (const name of rest) await ctrlClick(s, bin(name));
      await clearKeycaps(s);
      // Onto the empty cell under M3, off every label.
      await s.ui.moveTo(...(await cellCenter(s, 3, 1)));
      await s.ui.hold(0.2);
    });
    await payoff(s, area, 2);
  },
};

/** Three layers, each bin resting fully on the one below; the tallest stack is 9 of 12u. */
const DEEP_DRAWER: FixtureLayout = {
  name: 'Deep drawer',
  width: 5,
  depth: 4,
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [
    { name: 'Bottom', height: 4 },
    { name: 'Middle', height: 3 },
    { name: 'Top', height: 2 },
  ],
  bins: [
    { x: 0, y: 0, w: 3, d: 2, h: 4, label: 'Drill bits', cat: 'Bits' },
    { x: 3, y: 0, w: 2, d: 2, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 0, y: 2, w: 2, d: 2, h: 4, label: 'Blades', cat: 'Spares' },
    { x: 2, y: 2, w: 3, d: 2, h: 4, label: 'Glue sticks', cat: 'Spares' },
    { x: 0, y: 0, w: 2, d: 2, h: 3, label: 'Screws', cat: 'Fasteners', layer: 1 },
    { x: 2, y: 0, w: 1, d: 1, h: 3, label: 'Nuts', cat: 'Fasteners', layer: 1 },
    { x: 3, y: 2, w: 2, d: 2, h: 3, label: 'Washers', cat: 'Fasteners', layer: 1 },
    { x: 0, y: 0, w: 2, d: 1, h: 2, label: 'Small bits', cat: 'Bits', layer: 2 },
    { x: 4, y: 3, w: 1, d: 1, h: 2, label: 'Fuses', cat: 'Electrical', layer: 2 },
  ],
};

/** The left panel's full width, from `top` to `bottom`. */
async function panelCrop(s: DocsSession, top: number, bottom: number): Promise<Rect> {
  const panel = await s.box(s.page.locator('aside').first());
  return { x: panel.x, y: top, width: panel.width, height: bottom - top };
}

const layersPanel: Shot = {
  id: 'layouts-layers-panel',
  kind: 'still',
  async take(s) {
    await openLayouts(s, DEEP_DRAWER);
    // W steps the active layer up one, from Bottom to Middle, with no hover left behind.
    await s.page.keyboard.press('w');
    await s.ui.warm(10);
    const head = await s.box(
      s.page.getByRole('button', { name: label('common.layers'), exact: true }).first()
    );
    const stats = await s.box(
      s.page
        .getByText(new RegExp(label('layers.statsTotal_other', { coverage: '\\d+', count: 9 })))
        .first()
    );
    await s.still(await panelCrop(s, head.y, stats.y + stats.height + 14), 1.5);
  },
};

/**
 * The screen box (CSS px) of the bins in the layout editor's 3D preview. Each
 * layer's bins are one merged mesh of 36 triangles a bin; floor planes, text
 * and markers have far fewer, so they do not widen the box.
 */
async function binsBox(s: DocsSession): Promise<Rect> {
  return s.page.evaluate(() => {
    type V = {
      clone(): V;
      set(x: number, y: number, z: number): V;
      applyMatrix4(m: unknown): V;
      project(c: unknown): V;
      x: number;
      y: number;
    };
    type P = { x: number; y: number; z: number };
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
        boundingBox: { min: P; max: P } | null;
      };
      traverse(fn: (o: Obj) => void): void;
      updateMatrixWorld(force: boolean): void;
    };
    const w = window as unknown as { __observed: unknown[]; __docsCamera?: { position: V } };
    const camera = w.__docsCamera;
    if (!camera) throw new Error('the preview never rendered');
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('no canvas');
    const r = canvas.getBoundingClientRect();
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const scene of w.__observed as Obj[]) {
      if (!scene.isScene) continue;
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        for (let p: Obj | null = o; p; p = p.parent) if (!p.visible) return;
        const g = o.geometry;
        if ((g.index?.count ?? g.attributes.position?.count ?? 0) / 3 < 30) return;
        g.computeBoundingBox();
        const b = g.boundingBox;
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
    }
    if (!Number.isFinite(x0)) throw new Error('no bins in the preview');
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  });
}

/** Opens the layout editor's 3D preview, expanded to the window. */
async function expandPreview(s: DocsSession): Promise<void> {
  await s.page
    .getByRole('button', { name: label('toolbar.show3dPreview') })
    .first()
    .click({ force: true });
  await s.page.waitForTimeout(2000);
  await s.ui.warm(40);
  // Space on the focused button would close the preview instead of expanding it.
  await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await s.page.keyboard.press('Space');
  await s.page.waitForTimeout(1000);
  await s.ui.warm(40);
}

/**
 * Zooms the preview out with the wheel until the bins are at most `height`
 * tall, then pans with a right drag to centre them on `at`.
 */
async function fitPreview(s: DocsSession, height: number, at: [number, number]): Promise<Rect> {
  const [cx, cy] = [DESKTOP.width / 2, DESKTOP.height / 2];
  await s.page.mouse.move(cx, cy);
  let box = await binsBox(s);
  for (let i = 0; i < 40 && box.height > height; i++) {
    await s.page.mouse.wheel(0, 100);
    await s.ui.warm(8);
    box = await binsBox(s);
  }
  const dx = at[0] - (box.x + box.width / 2);
  const dy = at[1] - (box.y + box.height / 2);
  await s.page.mouse.down({ button: 'right' });
  await s.page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await s.page.mouse.up({ button: 'right' });
  // Parked over the empty floor, away from any bin's hover.
  await s.page.mouse.move(40, DESKTOP.height - 40);
  // The controls damp a pan, so the camera keeps gliding for a while after the drag.
  for (let i = 0; i < 60; i++) {
    await s.ui.warm(10);
    const next = await binsBox(s);
    const moved = Math.abs(next.x - box.x) + Math.abs(next.y - box.y);
    box = next;
    if (moved < 0.5) break;
  }
  return box;
}

/** Above the preview's shortcut bar and below its camera buttons. */
const STAGE: Rect = { x: 0, y: 52, width: DESKTOP.width, height: 740 };

/** All three layers stacked, then E lifts them apart. */
const layersExploded: Shot = {
  id: 'layouts-layers-exploded',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, DEEP_DRAWER);
    await s.page.keyboard.press('w');
    await s.ui.warm(10);
    await expandPreview(s);
    await s.page
      .getByRole('button', { name: label('grid.all'), exact: true })
      .click({ force: true });
    await s.ui.warm(20);
    // Framed on the exploded stack, off camera, then folded back for the take.
    await s.page.keyboard.press('e');
    await s.ui.warm(150);
    const exploded = await fitPreview(s, 580, [DESKTOP.width / 2 + 40, STAGE.y + 340]);
    await s.page.keyboard.press('e');
    await s.ui.warm(150);
    await s.ui.hideCursor();
    // Wide to the lower left, for the drawer's name lying on the floor there.
    const area = frameAround(
      {
        ...exploded,
        x: exploded.x - 115,
        width: exploded.width + 115,
        height: exploded.height + 60,
      },
      30,
      4 / 3,
      STAGE
    );
    await s.take(area, async () => {
      await s.ui.hold(0.6);
      await s.keys('e', 'E');
      await s.ui.hold(1.3);
    });
    await payoff(s, area, 1.8);
  },
};

/** A 6u bin on a 3u bin under a drawer measured at 50 mm: the stack is too tall. */
const DESK_DRAWER: FixtureLayout = {
  name: 'Desk drawer',
  width: 4,
  depth: 3,
  height: 7,
  measuredMm: { width: 180, depth: 140, height: 50 },
  categories: WORKSHOP_CATEGORIES,
  layers: [
    { name: 'Layer 1', height: 3 },
    { name: 'Layer 2', height: 6 },
  ],
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 3, label: 'Batteries', cat: 'Electrical' },
    { x: 2, y: 0, w: 2, d: 1, h: 3, label: 'Fuses', cat: 'Spares' },
    { x: 2, y: 1, w: 2, d: 2, h: 3, label: 'Tape', cat: 'Hand tools' },
    { x: 0, y: 2, w: 2, d: 1, h: 3, label: 'Pencils', cat: 'Bits' },
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Chargers', cat: 'Electrical', layer: 1 },
  ],
};

const drawerCeiling: Shot = {
  id: 'layouts-drawer-setup-ceiling',
  kind: 'still',
  async take(s) {
    await openLayouts(s, DESK_DRAWER);
    // The upper layer active, so the Stack view shows both layers.
    await s.page.keyboard.press('w');
    await s.ui.warm(10);
    await expandPreview(s);
    const bins = await fitPreview(s, 360, [DESKTOP.width / 2 + 60, STAGE.y + 330]);
    // Room for the plane's label at the upper right and the drawer's name at the lower left.
    await s.still(
      frameAround(
        {
          x: bins.x - 270,
          y: bins.y - 70,
          width: bins.width + 270 + 150,
          height: bins.height + 70 + 130,
        },
        0,
        4 / 3,
        STAGE
      )
    );
  },
};

/** A 6 x 4 grid in a drawer measured at 260 x 180 x 60 mm: 8 and 12 mm to spare. */
const MEASURED_DRAWER: FixtureLayout = {
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  height: 8,
  measuredMm: { width: 260, depth: 180, height: 60 },
  categories: WORKSHOP_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 6 }],
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 2, d: 1, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 4, y: 0, w: 2, d: 2, h: 6, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 0, y: 2, w: 3, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
    { x: 3, y: 2, w: 3, d: 2, h: 6, label: 'Wire nuts', cat: 'Electrical' },
  ],
};

const drawerGridSize: Shot = {
  id: 'layouts-drawer-setup-grid-size',
  kind: 'still',
  async take(s) {
    await openLayouts(s, MEASURED_DRAWER);
    const head = s.page
      .getByRole('button', { name: new RegExp(`^${label('sidebar.gridSize')}`) })
      .first();
    await s.ui.preReveal(head);
    const top = await s.box(head);
    const shape = await s.box(
      s.page.getByRole('switch', { name: label('drawerShape.toggle') }).first()
    );
    await s.still(await panelCrop(s, top.y, shape.y + shape.height + 12), 1.5);
  },
};

/** The five default categories, with bins in the first two. */
const KITCHEN_DRAWER: FixtureLayout = {
  name: 'Kitchen drawer',
  width: 6,
  depth: 4,
  height: 8,
  categories: DEFAULT_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 4 }],
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 4, label: 'Spatulas', cat: 'Coral' },
    { x: 2, y: 0, w: 2, d: 1, h: 4, label: 'Whisks', cat: 'Coral' },
    { x: 4, y: 0, w: 2, d: 2, h: 4, label: 'Measuring cups', cat: 'Sky' },
    { x: 0, y: 2, w: 3, d: 2, h: 4, label: 'Tongs', cat: 'Coral' },
    { x: 3, y: 2, w: 2, d: 1, h: 4, label: 'Peelers', cat: 'Sky' },
  ],
};

const categoriesPanel: Shot = {
  id: 'layouts-categories-panel',
  kind: 'still',
  async take(s) {
    await openLayouts(s, KITCHEN_DRAWER);
    const head = await s.box(
      s.page.getByRole('button', { name: label('common.categories'), exact: true }).first()
    );
    await s.page
      .getByRole('button', { name: label('categories.selectForNewBins', { name: 'Sky' }) })
      .first()
      .dblclick({ force: true });
    await s.ui.warm(20);
    const last = await s.box(
      s.page
        .getByRole('button', {
          name: label('categories.selectForNewBins', { name: 'Charcoal' }),
        })
        .first()
    );
    await s.still(await panelCrop(s, head.y, last.y + last.height + 14), 1.5);
  },
};

type PackedBin = [w: number, d: number, label: string, cat: string];

/** Bins packed left to right in rows from the front: a drawer that only has to read as one. */
function packed(
  name: string,
  width: number,
  depth: number,
  categories: { name: string; color: string }[],
  items: PackedBin[]
): FixtureLayout {
  const bins: FixtureBin[] = [];
  let [x, y, row] = [0, 0, 0];
  for (const [w, d, text, cat] of items) {
    if (x + w > width) [x, y, row] = [0, y + row, 0];
    if (y + d > depth) throw new Error(`${text} does not fit in ${name}`);
    bins.push({ x, y, w, d, h: 3, label: text, cat });
    x += w;
    row = Math.max(row, d);
  }
  return {
    name,
    width,
    depth,
    height: 6,
    categories,
    layers: [{ name: 'Layer 1', height: 3 }],
    bins,
  };
}

const KITCHEN_CATEGORIES = [
  { name: 'Utensils', color: '#f87171' },
  { name: 'Cutlery', color: '#38bdf8' },
  { name: 'Spices', color: '#fbbf24' },
  { name: 'Odds and ends', color: '#94a3b8' },
];

const CRAFT_CATEGORIES = [
  { name: 'Thread', color: '#f472b6' },
  { name: 'Needles', color: '#38bdf8' },
  { name: 'Notions', color: '#4ade80' },
  { name: 'Paint', color: '#fbbf24' },
];

/** Nine drawers; `folder` is the path of folder names each one is filed under. */
const LIBRARY: { folder: string[]; layout: FixtureLayout }[] = [
  {
    folder: ['Garage'],
    layout: packed('Socket drawer', 8, 5, WORKSHOP_CATEGORIES, [
      [4, 2, '1/4 in sockets', 'Hand tools'],
      [4, 2, '3/8 in sockets', 'Hand tools'],
      [3, 1, 'Extensions', 'Hand tools'],
      [3, 1, 'Ratchets', 'Hand tools'],
      [2, 1, 'Adapters', 'Spares'],
      [4, 2, '1/2 in sockets', 'Hand tools'],
      [2, 2, 'Bits', 'Bits'],
    ]),
  },
  {
    folder: ['Garage'],
    layout: packed('Tool chest, top drawer', 10, 6, WORKSHOP_CATEGORIES, [
      [4, 2, 'Pliers', 'Hand tools'],
      [3, 2, 'Screwdrivers', 'Hand tools'],
      [3, 2, 'Hex keys', 'Hand tools'],
      [2, 2, 'Tape', 'Spares'],
      [2, 2, 'Fuses', 'Electrical'],
      [3, 2, 'Wire nuts', 'Electrical'],
      [3, 2, 'Zip ties', 'Electrical'],
      [5, 2, 'Wrenches', 'Hand tools'],
      [5, 2, 'Utility knives', 'Hand tools'],
    ]),
  },
  {
    folder: ['Garage', 'Workbench'],
    layout: packed('Bit drawer', 6, 4, WORKSHOP_CATEGORIES, [
      [3, 2, 'Drill bits', 'Bits'],
      [3, 2, 'Driver bits', 'Bits'],
      [2, 2, 'Spade bits', 'Bits'],
      [2, 2, 'Hole saws', 'Bits'],
      [2, 2, 'Countersinks', 'Bits'],
    ]),
  },
  {
    folder: ['Garage', 'Workbench'],
    layout: packed('Fastener drawer', 7, 5, WORKSHOP_CATEGORIES, [
      [1, 1, 'M3', 'Fasteners'],
      [1, 1, 'M4', 'Fasteners'],
      [1, 1, 'M5', 'Fasteners'],
      [1, 1, 'M6', 'Fasteners'],
      [3, 1, 'Washers', 'Fasteners'],
      [2, 2, 'Nuts', 'Fasteners'],
      [2, 2, 'Wood screws', 'Fasteners'],
      [3, 2, 'Anchors', 'Fasteners'],
      [4, 2, 'Nails', 'Fasteners'],
      [3, 2, 'Rivets', 'Spares'],
    ]),
  },
  {
    folder: ['Kitchen'],
    layout: packed('Cutlery drawer', 9, 7, KITCHEN_CATEGORIES, [
      [2, 4, 'Forks', 'Cutlery'],
      [2, 4, 'Knives', 'Cutlery'],
      [2, 4, 'Spoons', 'Cutlery'],
      [3, 4, 'Serving', 'Utensils'],
      [3, 3, 'Teaspoons', 'Cutlery'],
      [3, 3, 'Chopsticks', 'Utensils'],
      [3, 3, 'Straws', 'Odds and ends'],
    ]),
  },
  {
    folder: ['Kitchen'],
    layout: packed('Spice drawer', 8, 4, KITCHEN_CATEGORIES, [
      [2, 2, 'Pepper', 'Spices'],
      [2, 2, 'Paprika', 'Spices'],
      [2, 2, 'Cumin', 'Spices'],
      [2, 2, 'Oregano', 'Spices'],
      [4, 2, 'Baking', 'Odds and ends'],
      [4, 2, 'Tea', 'Odds and ends'],
    ]),
  },
  {
    folder: ['Kitchen'],
    layout: packed('Junk drawer', 7, 6, KITCHEN_CATEGORIES, [
      [3, 2, 'Batteries', 'Odds and ends'],
      [2, 2, 'Tape', 'Odds and ends'],
      [2, 2, 'Pens', 'Odds and ends'],
      [4, 2, 'Takeout menus', 'Odds and ends'],
      [3, 2, 'Bag clips', 'Utensils'],
      [7, 2, 'Foil and wrap', 'Utensils'],
    ]),
  },
  {
    folder: [],
    layout: packed('Sewing box', 5, 4, CRAFT_CATEGORIES, [
      [2, 2, 'Thread', 'Thread'],
      [1, 2, 'Needles', 'Needles'],
      [2, 2, 'Buttons', 'Notions'],
      [3, 2, 'Scissors', 'Notions'],
      [2, 2, 'Pins', 'Needles'],
    ]),
  },
  {
    folder: [],
    layout: packed('Craft room desk', 8, 5, CRAFT_CATEGORIES, [
      [4, 2, 'Paint tubes', 'Paint'],
      [2, 2, 'Brushes', 'Paint'],
      [2, 2, 'Glue', 'Notions'],
      [3, 3, 'Washi tape', 'Notions'],
      [3, 3, 'Ribbon', 'Thread'],
      [2, 3, 'Markers', 'Paint'],
    ]),
  },
];

/** Files each layout of `LIBRARY` in its folder, through the library's own folder rules. */
async function fileLibrary(s: DocsSession): Promise<void> {
  await s.page.evaluate(
    async (placements) => {
      type Library = { entries: { id: string; name: string }[] };
      type Res<T> = { ok: boolean; value?: T; error?: unknown };
      const storage = (await import('/src/core/storage/index.ts' as string)) as {
        createFolder(
          library: Library,
          name: string,
          parentId: string | null
        ): Res<{ library: Library; folder: { id: string } }>;
        setEntryFolder(library: Library, layoutId: string, folderId: string | null): Res<Library>;
        saveLibrary(library: Library): Promise<Res<unknown>>;
      };
      const { useLibraryStore } = (await import('/src/core/store/library.ts' as string)) as {
        useLibraryStore: { getState(): { library: Library; setLibrary(l: Library): void } };
      };
      const unwrap = <T>(r: Res<T>, what: string): T => {
        if (!r.ok || r.value === undefined) throw new Error(`${what}: ${String(r.error)}`);
        return r.value;
      };
      let library = useLibraryStore.getState().library;
      const ids = new Map<string, string>();
      for (const { folder, name } of placements) {
        let parent: string | null = null;
        for (let depth = 1; depth <= folder.length; depth++) {
          const key = folder.slice(0, depth).join('/');
          let id: string | undefined = ids.get(key);
          if (id === undefined) {
            const made: { library: Library; folder: { id: string } } = unwrap(
              storage.createFolder(library, folder[depth - 1] ?? '', parent),
              `folder ${key}`
            );
            library = made.library;
            id = made.folder.id;
            ids.set(key, made.folder.id);
          }
          parent = id;
        }
        const entry = library.entries.find((e) => e.name === name);
        if (!entry) throw new Error(`no layout named ${name}`);
        library = unwrap(storage.setEntryFolder(library, entry.id, parent), `file ${name}`);
      }
      const saved = await storage.saveLibrary(library);
      if (!saved.ok) throw new Error(`save library: ${String(saved.error)}`);
      useLibraryStore.getState().setLibrary(library);
    },
    LIBRARY.map(({ folder, layout }) => ({ folder, name: layout.name }))
  );
}

const organizingManager: Shot = {
  id: 'layouts-organizing-manager',
  kind: 'still',
  async take(s) {
    await openLayouts(s, ...LIBRARY.map(({ layout }) => layout));
    await fileLibrary(s);
    // Reloaded, so the manager shows the library as the app loads it from storage.
    await s.open('/', grid);
    await s.page.keyboard.press('ControlOrMeta+o');
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    // A mouse click, so the folder row takes no keyboard focus ring.
    await s.page
      .getByRole('button', { name: new RegExp(`^${label('layouts.folders.all')}`) })
      .first()
      .click();
    // Garage opened, to show its Workbench subfolder.
    await s.page
      .getByRole('button', { name: label('layouts.folders.expand') })
      .first()
      .click();
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.still(await s.box(dialog));
  },
};

/** Shots for the Planning layouts chapter. */
export const LAYOUTS: readonly Shot[] = [
  placingStash,
  findBinsToolbar,
  multiSelectToolbar,
  layersPanel,
  layersExploded,
  drawerGridSize,
  drawerCeiling,
  categoriesPanel,
  organizingManager,
];
