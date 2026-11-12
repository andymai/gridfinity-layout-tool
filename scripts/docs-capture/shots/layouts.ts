import type { Locator } from '@playwright/test';
import { DEFAULT_CATEGORIES, WORKBENCH, WORKSHOP_CATEGORIES, layoutFile } from '../fixtures';
import type { FixtureBin, FixtureLayout } from '../fixtures';
import { FPS } from '../../feature-tips/encode';
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
 * Frames join the clip only when a take ends, so `s.poster()` inside a take
 * marks its first frame.
 */
async function payoff(s: DocsSession, area: Rect, seconds: number): Promise<void> {
  await s.take(area, async () => {
    s.poster();
    await s.ui.hold(seconds);
  });
}

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

/** Designs the gap filter hides need no picture. */
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
 * The selection toolbar's left edge sits at the selection's centre, so a
 * selection on the left keeps the toolbar over the grid.
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

/** A click near a bin's bottom edge selected its neighbour instead, so clicks go to the middle. */
async function middle(s: DocsSession, target: Locator): Promise<[number, number]> {
  const b = await s.box(target);
  return [b.x + b.width / 2, b.y + b.height / 2];
}

/**
 * The kit clicks through raw input events, which carry no modifier keys, so the
 * press goes through Playwright's mouse once the drawn cursor is there.
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
 * Each layer's bins are one merged mesh of 36 triangles a bin; floor planes,
 * text and markers have far fewer, so they do not widen the box.
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

/** The 50 mm measured height makes the stack too tall. */
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

/** Each drawer only has to read as a drawer, so a plain row packing is enough. */
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

interface AppImport {
  __appImport(path: string): Promise<unknown>;
}

/**
 * After a hot update the dev server serves the app's copy of a changed module
 * as `<path>?t=<stamp>`, and a bare `import(path)` loads a second copy with its
 * own empty store. This imports the newest copy the page loaded, found by its URL.
 */
async function installAppImport(s: DocsSession): Promise<void> {
  const install = (): void => {
    // The buffer keeps 250 entries by default and drops the rest, which loses
    // the URL of a later hot update.
    performance.setResourceTimingBufferSize(100_000);
    (window as unknown as AppImport).__appImport = (path: string) => {
      const loaded = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .findLast((name) => new URL(name).pathname === path);
      return import(/* @vite-ignore */ loaded ?? path) as Promise<unknown>;
    };
  };
  await s.page.context().addInitScript(install);
  await s.page.evaluate(install);
}

async function fileLibrary(s: DocsSession): Promise<void> {
  await s.page.evaluate(
    async (placements) => {
      type Library = { entries: { id: string; name: string }[] };
      type Res<T> = { ok: boolean; value?: T; error?: unknown };
      const storage = (await (window as unknown as AppImport).__appImport(
        '/src/core/storage/index.ts'
      )) as {
        createFolder(
          library: Library,
          name: string,
          parentId: string | null
        ): Res<{ library: Library; folder: { id: string } }>;
        setEntryFolder(library: Library, layoutId: string, folderId: string | null): Res<Library>;
        saveLibrary(library: Library): Promise<Res<unknown>>;
      };
      const { useLibraryStore } = (await (window as unknown as AppImport).__appImport(
        '/src/core/store/library.ts'
      )) as {
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
    await installAppImport(s);
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

interface CursorHooks {
  __cursor: { at(x: number, y: number): void; press(): void; release(x: number, y: number): void };
}

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const binNamed = (s: DocsSession, name: string): Locator =>
  s.page.locator('[data-bin-id]', { hasText: name }).first();

/**
 * The first click on a bin and the first load each show a one-time tip; marked
 * as seen, so no take catches one.
 */
async function quietHints(s: DocsSession): Promise<void> {
  await s.page.evaluate(async () => {
    const { useSettingsStore } = (await (window as unknown as AppImport).__appImport(
      '/src/core/store/settings.ts'
    )) as {
      useSettingsStore: {
        getState(): {
          settings: { dismissedHints: string[] };
          updateSetting(key: string, value: unknown): void;
        };
      };
    };
    const st = useSettingsStore.getState();
    const seen = new Set([...st.settings.dismissedHints, 'bin-resize', 'grid-resize']);
    st.updateSetting('dismissedHints', [...seen]);
  });
}

async function openQuiet(s: DocsSession, ...fixtures: FixtureLayout[]): Promise<void> {
  await installAppImport(s);
  await openLayouts(s, ...fixtures);
  await quietHints(s);
}

/**
 * The press and the move of a drag, through Playwright's mouse, which carries
 * the keys held on its keyboard (the kit's drag carries none). `drop` ends it,
 * so a take can hold on a tag that shows only while the bin is held.
 */
async function heldMove(
  s: DocsSession,
  from: [number, number],
  to: [number, number],
  frames: number,
  key?: string
): Promise<void> {
  await s.ui.moveTo(...from);
  await s.ui.hold(0.06);
  await s.page.mouse.move(...from);
  if (key) await s.page.keyboard.down(key);
  await s.page.evaluate(() => (window as unknown as CursorHooks).__cursor.press());
  await s.page.mouse.down();
  for (let i = 1; i <= frames; i++) {
    const e = easeInOut(i / frames);
    const x = from[0] + (to[0] - from[0]) * e;
    const y = from[1] + (to[1] - from[1]) * e;
    await s.page.mouse.move(x, y);
    await s.page.evaluate(([px, py]) => (window as unknown as CursorHooks).__cursor.at(px, py), [
      x,
      y,
    ] as const);
    await s.ui.hold(1 / FPS);
  }
}

async function drop(s: DocsSession, at: [number, number], key?: string): Promise<void> {
  await s.page.mouse.up();
  await s.page.evaluate(([px, py]) => (window as unknown as CursorHooks).__cursor.release(px, py), [
    at[0],
    at[1],
  ] as const);
  if (key) await s.page.keyboard.up(key);
  // The kit's own cursor position, for its next move.
  await s.ui.park(...at);
  await s.ui.hold(0.06);
}

/** A few frames of motion while a drag is held, so the app reads a key pressed mid-drag. */
async function heldNudge(
  s: DocsSession,
  from: [number, number],
  to: [number, number]
): Promise<void> {
  await heldNudgeFrames(s, from, to, 4);
}

async function heldNudgeFrames(
  s: DocsSession,
  from: [number, number],
  to: [number, number],
  frames: number
): Promise<void> {
  for (let i = 1; i <= frames; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / frames;
    const y = from[1] + ((to[1] - from[1]) * i) / frames;
    await s.page.mouse.move(x, y);
    await s.page.evaluate(([px, py]) => (window as unknown as CursorHooks).__cursor.at(px, py), [
      x,
      y,
    ] as const);
    await s.ui.hold(1 / FPS);
  }
}

async function pathDrag(s: DocsSession, points: [number, number][], frames: number): Promise<void> {
  const [start, ...rest] = points;
  if (!start) return;
  let from = start;
  await heldMove(s, from, from, 1);
  for (const to of rest) {
    await heldNudgeFrames(s, from, to, frames);
    from = to;
  }
  await drop(s, from);
}

async function heldDrag(
  s: DocsSession,
  from: [number, number],
  to: [number, number],
  frames: number,
  key?: string
): Promise<void> {
  await heldMove(s, from, to, frames, key);
  await drop(s, to, key);
}

/** A click with `key` held, through Playwright's mouse for the same reason. */
async function heldClickAt(s: DocsSession, x: number, y: number, key: string): Promise<void> {
  await s.ui.moveTo(x, y);
  await s.ui.hold(0.06);
  await s.page.mouse.move(x, y);
  await s.page.keyboard.down(key);
  await s.page.evaluate(() => (window as unknown as CursorHooks).__cursor.press());
  await s.page.mouse.down();
  await s.page.mouse.up();
  await s.ui.warm(2);
  await s.page.evaluate(([px, py]) => (window as unknown as CursorHooks).__cursor.release(px, py), [
    x,
    y,
  ] as const);
  await s.page.keyboard.up(key);
  await s.ui.hold(0.3);
}

async function rightClickAt(s: DocsSession, x: number, y: number): Promise<void> {
  await s.ui.moveTo(x, y);
  await s.ui.hold(0.06);
  await s.page.mouse.move(x, y);
  await s.page.evaluate(() => (window as unknown as CursorHooks).__cursor.press());
  await s.page.mouse.down({ button: 'right' });
  await s.page.mouse.up({ button: 'right' });
  await s.page.evaluate(([px, py]) => (window as unknown as CursorHooks).__cursor.release(px, py), [
    x,
    y,
  ] as const);
  await s.ui.hold(0.2);
}

/** The grid with its numbers, grown to 4:3 so a close-up cut can share the clip. */
async function gridFrame(s: DocsSession, f: FixtureLayout, margin = 28): Promise<Rect> {
  return frameAround(
    await gridArea(s, f.width, f.depth),
    margin,
    4 / 3,
    await canvasBetweenPanels(s)
  );
}

/**
 * Panel crops take in a strip of the empty canvas to their right, where the
 * cursor rests: anywhere on the panel, it lights up a row or a button.
 */
const STRIP = 28;

function withStrip(panel: Rect): Rect {
  return { ...panel, width: panel.width + STRIP };
}

function stripRest(panel: Rect, y: number): [number, number] {
  return [panel.x + panel.width + 8, y];
}

async function canvasBetweenPanels(s: DocsSession): Promise<Rect> {
  const left = await s.box(s.page.locator('aside').first());
  const right = await s.box(s.page.locator('aside').last());
  const x = left.x + left.width;
  return { x, y: 48, width: right.x - x, height: DESKTOP.height - 48 };
}

/** Below the column numbers, on the empty canvas: nothing there lights up under the cursor. */
async function parkBelow(s: DocsSession, f: FixtureLayout, at = 0.5): Promise<void> {
  const g = await gridArea(s, f.width, f.depth);
  await s.ui.park(g.x + g.width * at, g.y + g.height + 24);
}

const SHOP: Pick<FixtureLayout, 'height' | 'categories' | 'layers'> = {
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 6 }],
};

const DRAW_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 0, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 0, y: 2, w: 2, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

/**
 * A drag over empty cells, then one whose area takes in a corner of the new
 * bin and snaps to the free part. A drag released over a bin draws nothing.
 */
const placingDraw: Shot = {
  id: 'layouts-placing-bins-draw',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, DRAW_DRAWER);
    const area = await gridFrame(s, DRAW_DRAWER);
    await parkBelow(s, DRAW_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.drag(await cellCenter(s, 5, 1), await cellCenter(s, 6, 2), 18);
      await s.ui.moveTo(...(await cellCenter(s, 4, 2)));
      await s.ui.hold(0.8);
      await s.ui.drag(await cellCenter(s, 5, 4), await cellCenter(s, 3, 2), 22);
      // Off every bin, so no hover shows on the result.
      await parkAway(s, DRAW_DRAWER);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

async function parkAway(s: DocsSession, f: FixtureLayout, at = 0.5): Promise<void> {
  const g = await gridArea(s, f.width, f.depth);
  await s.ui.moveTo(g.x + g.width * at, g.y + g.height + 24);
}

const BRUSH_DRAWER: FixtureLayout = {
  ...DRAW_DRAWER,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 2, d: 2, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 4, y: 0, w: 2, d: 2, h: 6, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 0, y: 2, w: 2, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

const placingBrush: Shot = {
  id: 'layouts-placing-bins-size-brush',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, BRUSH_DRAWER);
    const brush = s.page.getByRole('button', { name: label('layers.sizeSelector'), exact: true });
    const size = s.page.getByRole('button', {
      name: label('layers.paintSizeAriaLabel', {
        action: label('layers.select'),
        width: 1,
        depth: 1,
      }),
    });
    await brush.first().click({ force: true });
    await s.until(size);
    const squares = union(await s.box(brush.first()), await s.box(size));
    await s.page.keyboard.press('Escape');
    // Escape leaves the focus ring on the button.
    await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await s.ui.warm(20);
    const panel = await s.box(s.page.locator('aside').first());
    const closeUp = frameAround(squares, 12, 4 / 3, withStrip(panel));
    const area = await gridFrame(s, BRUSH_DRAWER);
    const brushBox = await s.box(brush.first());
    const rest = stripRest(panel, brushBox.y + brushBox.height / 2);
    await s.ui.park(...rest);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(brush.first());
        await s.ui.hold(0.5);
        await s.ui.click(size);
        await s.ui.moveTo(...rest);
        await s.ui.hold(0.3);
      },
      640 / closeUp.width
    );
    await parkBelow(s, BRUSH_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.3);
      await s.ui.clickAt(...(await cellCenter(s, 3, 3)));
      await s.ui.hold(0.4);
      await s.ui.drag(await cellCenter(s, 4, 3), await cellCenter(s, 6, 4), 20);
      await s.ui.hold(0.3);
      await s.keys('Escape', 'Esc');
      await parkAway(s, BRUSH_DRAWER, 0.75);
      s.poster();
      await s.ui.hold(1.6);
    });
  },
};

const MOVE_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 0, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 2, y: 1, w: 2, d: 1, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 4, y: 0, w: 2, d: 2, h: 6, label: 'Driver bits', cat: 'Bits' },
    { x: 0, y: 2, w: 2, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

const placingMoveCopy: Shot = {
  id: 'layouts-placing-bins-move-copy',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, MOVE_DRAWER);
    const area = await gridFrame(s, MOVE_DRAWER);
    await parkBelow(s, MOVE_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.drag(await middle(s, binNamed(s, 'M4')), await cellCenter(s, 5, 3), 20);
      await s.ui.hold(0.6);
      await showKeycap(s, 'Alt', area);
      await heldDrag(s, await middle(s, binNamed(s, 'M3')), await cellCenter(s, 6, 3), 22, 'Alt');
      await clearKeycaps(s);
      await parkAway(s, MOVE_DRAWER, 0.75);
      s.poster();
      await s.ui.hold(1.6);
    });
  },
};

const RESIZE_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 6,
  depth: 3,
  bins: [
    { x: 0, y: 0, w: 2, d: 1, h: 6, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 4, y: 0, w: 2, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
    { x: 0, y: 2, w: 3, d: 1, h: 6, label: 'Tape measure', cat: 'Hand tools' },
    { x: 3, y: 2, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 4, y: 2, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 5, y: 2, w: 1, d: 1, h: 6, label: 'M5', cat: 'Fasteners' },
  ],
};

const placingResize: Shot = {
  id: 'layouts-placing-bins-resize',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, RESIZE_DRAWER);
    const area = await gridFrame(s, RESIZE_DRAWER);
    const handle = (key: Parameters<typeof label>[0]): Locator =>
      s.page.getByRole('slider', { name: label(key), exact: true }).first();
    const [x1] = await cellCenter(s, 1, 1);
    const [x2, y2] = await cellCenter(s, 2, 2);
    const cell = { w: x2 - x1, h: (await cellCenter(s, 1, 1))[1] - y2 };
    await parkBelow(s, RESIZE_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(...(await middle(s, binNamed(s, 'Screwdrivers'))));
      await s.ui.hold(0.6);
      const east = await middle(s, handle('gridEditor.resize.eastAria'));
      // Half a cell: the edge snaps to the far side of the cell under the cursor.
      await s.ui.drag(east, [east[0] + cell.w * 0.5, east[1]], 16);
      await s.ui.hold(0.6);
      const corner = await middle(s, handle('gridEditor.resize.northeastAria'));
      await s.ui.drag(corner, [corner[0] + cell.w * 0.5, corner[1] - cell.h * 0.5], 18);
      await parkAway(s, RESIZE_DRAWER, 0.75);
      s.poster();
      await s.ui.hold(1.6);
    });
  },
};

const ROTATE_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 1, d: 3, h: 6, label: 'Pliers', cat: 'Hand tools' },
    { x: 0, y: 2, w: 2, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
    { x: 3, y: 2, w: 3, d: 2, h: 6, label: 'Washers', cat: 'Fasteners' },
  ],
};

const placingRotate: Shot = {
  id: 'layouts-placing-bins-rotate',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, ROTATE_DRAWER);
    const area = await gridFrame(s, ROTATE_DRAWER);
    await parkBelow(s, ROTATE_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(...(await middle(s, binNamed(s, 'Pliers'))));
      await parkAway(s, ROTATE_DRAWER, 0.75);
      await s.ui.hold(0.3);
      await s.keys('r', 'R');
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const EXPAND_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 7,
  depth: 3,
  bins: [
    { x: 0, y: 0, w: 2, d: 3, h: 6, label: 'Pliers', cat: 'Hand tools' },
    { x: 3, y: 0, w: 2, d: 3, h: 6, label: 'Sockets', cat: 'Hand tools' },
    { x: 5, y: 0, w: 2, d: 3, h: 6, label: 'Wrenches', cat: 'Hand tools' },
  ],
};

const placingExpand: Shot = {
  id: 'layouts-placing-bins-expand-to-fit',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, EXPAND_DRAWER);
    const pliers = await middle(s, binNamed(s, 'Pliers'));
    await s.page.mouse.click(...pliers, { button: 'right' });
    const item = s.page.getByRole('menuitem', { name: label('mobile.binMenu.expandToFit') });
    await s.until(item);
    // The design actions load lazily and lengthen the menu; measured once they show.
    await s.until(s.page.getByRole('menuitem', { name: label('designLinking.menu.linkExisting') }));
    await s.ui.warm(30);
    const menu = await s.box(s.page.getByRole('menu').first());
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    const grid = await gridArea(s, EXPAND_DRAWER.width, EXPAND_DRAWER.depth);
    // The tall menu does not fit a 4:3 frame inside the canvas, and this clip has no cuts.
    const area = pad(union(grid, menu), 16, DESKTOP);
    await parkBelow(s, EXPAND_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await rightClickAt(s, ...pliers);
      await s.ui.hold(0.5);
      await s.ui.click(item);
      await parkAway(s, EXPAND_DRAWER, 0.75);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const placingBlocked: Shot = {
  id: 'layouts-placing-bins-blocked',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, MOVE_DRAWER);
    const area = await gridFrame(s, MOVE_DRAWER);
    await parkBelow(s, MOVE_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      const from = await middle(s, binNamed(s, 'M4'));
      // A bin on the left, so the tag that opens to the right of the bin stays in frame.
      const onto = await middle(s, binNamed(s, 'Hex keys'));
      await heldMove(s, from, onto, 22);
      // The drag first snaps to the closest free spot; Ctrl stops the snap, so the tag shows.
      await s.ui.hold(0.6);
      await showKeycap(s, 'Ctrl', area);
      await s.page.keyboard.down('Control');
      const held: [number, number] = [onto[0] + 6, onto[1] + 4];
      await heldNudge(s, onto, held);
      s.poster();
      await s.ui.hold(1.4);
      await drop(s, held, 'Control');
      await clearKeycaps(s);
      await parkAway(s, MOVE_DRAWER, 0.75);
      await s.ui.hold(1.4);
    });
  },
};

const FASTENER_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Fastener drawer',
  width: 6,
  depth: 4,
  bins: [
    { x: 0, y: 0, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 1, y: 0, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 2, y: 0, w: 1, d: 1, h: 6, label: 'M5', cat: 'Fasteners' },
    { x: 3, y: 0, w: 1, d: 1, h: 6, label: 'M6', cat: 'Fasteners' },
    { x: 4, y: 0, w: 2, d: 1, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 0, y: 1, w: 2, d: 1, h: 6, label: 'Nuts', cat: 'Fasteners' },
    { x: 2, y: 1, w: 2, d: 1, h: 6, label: 'Anchors', cat: 'Spares' },
    { x: 4, y: 1, w: 2, d: 1, h: 6, label: 'Rivets', cat: 'Spares' },
    { x: 0, y: 2, w: 3, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 3, y: 2, w: 3, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

const rowHeader = (s: DocsSession, row: number): Locator =>
  s.page.getByRole('button', { name: label('grid.selectRowAria', { row }), exact: true });

/**
 * Left of the number's middle: at this zoom a click on the middle of a row
 * number selected only the first bin of the row.
 */
async function rowNumberAt(s: DocsSession, row: number): Promise<[number, number]> {
  const b = await s.box(rowHeader(s, row));
  return [b.x + b.width * 0.25, b.y + b.height / 2];
}

const multiSelectRows: Shot = {
  id: 'layouts-multi-select-rows',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, FASTENER_DRAWER);
    await s.page.mouse.click(...(await rowNumberAt(s, 1)));
    await s.page.keyboard.down('Shift');
    await s.page.mouse.click(...(await rowNumberAt(s, 2)));
    await s.page.keyboard.up('Shift');
    const toolbar = selectionToolbar(s);
    await s.until(toolbar);
    const bar = await s.box(toolbar);
    await s.page.keyboard.press('Escape');
    // The clicked row number keeps a focus ring.
    await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await s.ui.warm(10);
    await s.dismissToasts();
    const area = frameAround(
      union(await gridArea(s, FASTENER_DRAWER.width, FASTENER_DRAWER.depth), bar),
      16,
      4 / 3,
      WORKSPACE
    );
    await parkBelow(s, FASTENER_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(...(await rowNumberAt(s, 1)));
      await s.ui.hold(0.7);
      await showKeycap(s, 'Shift', area);
      await heldClickAt(s, ...(await rowNumberAt(s, 2)), 'Shift');
      await clearKeycaps(s);
      await parkAway(s, FASTENER_DRAWER, 0.75);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const ALIGN_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Fastener drawer',
  width: 6,
  depth: 4,
  bins: [
    { x: 1, y: 3, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 2, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 2, y: 1, w: 1, d: 1, h: 6, label: 'M5', cat: 'Fasteners' },
    { x: 0, y: 0, w: 3, d: 1, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 4, y: 0, w: 2, d: 4, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

async function selectBins(s: DocsSession, names: readonly string[]): Promise<void> {
  const [first, ...rest] = names;
  if (!first) return;
  await s.ui.clickAt(...(await middle(s, binNamed(s, first))));
  for (const name of rest) await ctrlClick(s, binNamed(s, name));
}

const selectionToolbar = (s: DocsSession): Locator =>
  s.page.getByRole('toolbar', { name: label('selectionToolbar.ariaLabel') });

const multiSelectAlign: Shot = {
  id: 'layouts-multi-select-align',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, ALIGN_DRAWER);
    await selectBins(s, ['M3', 'M4', 'M5']);
    const toolbar = selectionToolbar(s);
    await s.until(toolbar);
    const align = toolbar.getByRole('button', { name: label('commandPalette.alignLeft') });
    const area = frameAround(
      union(await s.box(toolbar), await gridArea(s, ALIGN_DRAWER.width, ALIGN_DRAWER.depth)),
      16,
      4 / 3,
      WORKSPACE
    );
    await parkBelow(s, ALIGN_DRAWER, 0.75);
    await s.ui.hideCursor();
    await s.dismissToasts();
    await s.take(area, async () => {
      await s.ui.park(area.x + area.width * 0.75, area.y + area.height - 20);
      await s.ui.hold(0.5);
      await s.ui.click(align);
      await parkAway(s, ALIGN_DRAWER, 0.75);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const multiSelectInspector: Shot = {
  id: 'layouts-multi-select-inspector',
  kind: 'still',
  async take(s) {
    await openQuiet(s, FASTENER_DRAWER);
    await selectBins(s, ['M3', 'M4', 'M5']);
    await s.ui.hideCursor();
    await s.page.mouse.move(DESKTOP.width / 2, DESKTOP.height - 20);
    await s.ui.warm(10);
    await s.dismissToasts();
    const head = await s.box(
      s.page.getByRole('button', { name: label('rightPanel.multiSelection') }).first()
    );
    const last = await s.box(
      s.page.getByRole('button', { name: label('inspector.multi.delete'), exact: true }).first()
    );
    const panel = await s.box(s.page.locator('aside').last());
    await s.still(
      {
        x: panel.x,
        y: head.y,
        width: panel.width,
        height: last.y + last.height + 14 - head.y,
      },
      1.5
    );
  },
};

const multiSelectMerge: Shot = {
  id: 'layouts-multi-select-merge-dialog',
  kind: 'still',
  async take(s) {
    await openQuiet(s, FASTENER_DRAWER);
    await selectBins(s, ['M3', 'M4', 'Nuts']);
    await s.ui.hideCursor();
    await s.page
      .getByRole('button', { name: label('mobile.binMenu.mergeIntoOne'), exact: true })
      .first()
      .click({ force: true });
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    const name = dialog.getByLabel(label('designLinking.bento.nameLabel'), { exact: true });
    await name.fill('Screw tray');
    await dialog
      .getByRole('button', { name: label('designLinking.bento.confirm') })
      .first()
      .evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
    await s.page.mouse.move(DESKTOP.width - 10, DESKTOP.height - 10);
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.still(pad(await s.box(dialog), 3, DESKTOP));
  },
};

const multiSelectBinMenu: Shot = {
  id: 'layouts-multi-select-bin-menu',
  kind: 'still',
  async take(s) {
    await openQuiet(s, FASTENER_DRAWER);
    const [x, y] = await middle(s, binNamed(s, 'Anchors'));
    await s.page.mouse.click(x, y, { button: 'right' });
    const menu = s.page.getByRole('menu').first();
    await s.until(menu);
    // The design actions load lazily and lengthen the menu; measured once they show.
    await s.until(s.page.getByRole('menuitem', { name: label('designLinking.menu.linkExisting') }));
    await s.ui.warm(30);
    // Off the menu, so no item shows a hover.
    await s.page.mouse.move(DESKTOP.width / 2, DESKTOP.height - 20);
    await s.ui.warm(20);
    await s.dismissToasts();
    const grid = await gridArea(s, FASTENER_DRAWER.width, FASTENER_DRAWER.depth);
    await s.still(pad(union(grid, await s.box(menu)), 16, DESKTOP));
  },
};

const STACK_DRAWER: FixtureLayout = {
  name: 'Deep drawer',
  width: 5,
  depth: 4,
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [
    { name: 'Layer 1', height: 4 },
    { name: 'Layer 2', height: 2 },
  ],
  bins: [
    { x: 0, y: 0, w: 3, d: 2, h: 4, label: 'Drill bits', cat: 'Bits' },
    { x: 3, y: 0, w: 2, d: 2, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 0, y: 2, w: 2, d: 2, h: 2, label: 'Blades', cat: 'Spares' },
    { x: 2, y: 2, w: 3, d: 2, h: 4, label: 'Glue sticks', cat: 'Spares' },
    { x: 3, y: 2, w: 2, d: 2, h: 2, label: 'Washers', cat: 'Fasteners', layer: 1 },
  ],
};

const layersStack: Shot = {
  id: 'layouts-layers-stack',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, STACK_DRAWER);
    const grid = await gridArea(s, STACK_DRAWER.width, STACK_DRAWER.depth);
    const toolbar = await s.box(
      s.page.getByRole('button', { name: label('toolbar.findBins') }).first()
    );
    const canvas = await canvasBetweenPanels(s);
    const area = frameAround(union(grid, toolbar), 12, 4 / 3, canvas);
    const [x1, y1] = await cellCenter(s, 1, 1);
    const [x2, y2] = await cellCenter(s, 2, 2);
    const half = { w: (x2 - x1) / 2, h: (y1 - y2) / 2 };
    const drawn: Rect = { x: x1 - half.w, y: y2 - half.h, width: 4 * half.w, height: 4 * half.h };
    await parkBelow(s, STACK_DRAWER, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.keys('w', 'W');
      await s.ui.hold(0.8);
      await s.ui.drag([x1, y1], [x2, y2], 18);
      await parkAway(s, STACK_DRAWER, 0.75);
      await s.ui.hold(0.6);
    });
    // Close on the new bin, for its small "on 4u" tag.
    await payoff(s, frameAround(drawn, 60, 4 / 3, canvas), 2);
  },
};

const layersAddRename: Shot = {
  id: 'layouts-layers-add-rename',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, DEEP_DRAWER);
    const head = await s.box(
      s.page.getByRole('button', { name: label('common.layers'), exact: true }).first()
    );
    const add = s.page.getByRole('button', { name: label('layers.addNewLayer') }).first();
    const panel = await s.box(s.page.locator('aside').first());
    // Room for the fourth row the take adds.
    const area: Rect = { x: panel.x, y: head.y - 4, width: panel.width, height: 260 };
    await s.ui.park(area.x + area.width * 0.6, area.y + area.height - 12);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(add);
        await s.ui.hold(0.7);
        const name = s.page
          .getByTitle(label('layers.clickToRename'))
          .filter({ hasText: 'Layer 4' })
          .first();
        await s.ui.click(name);
        await s.ui.hold(0.2);
        await s.page.keyboard.press('ControlOrMeta+a');
        await s.type('Lid tray');
        await s.keys('Enter');
        await s.ui.moveTo(area.x + area.width * 0.6, area.y + area.height - 12);
        s.poster();
        await s.ui.hold(1.6);
      },
      1.6
    );
  },
};

const SCISSOR_DRAWER: FixtureLayout = {
  name: 'Craft drawer',
  width: 5,
  depth: 3,
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [
    { name: 'Layer 1', height: 3 },
    { name: 'Layer 2', height: 3 },
  ],
  bins: [
    { x: 0, y: 0, w: 2, d: 3, h: 3, label: 'Scissors', cat: 'Hand tools' },
    { x: 2, y: 0, w: 3, d: 2, h: 3, label: 'Tape', cat: 'Spares' },
    { x: 2, y: 2, w: 3, d: 1, h: 3, label: 'Pencils', cat: 'Bits' },
    { x: 2, y: 0, w: 3, d: 2, h: 3, label: 'Glue sticks', cat: 'Spares', layer: 1 },
  ],
};

/** Scissors keeps 4u free above it for the handles, which the fixture format has no field for. */
function scissorFile(): object {
  const file = layoutFile(SCISSOR_DRAWER) as {
    bins: { label: string; clearanceHeight?: number }[];
  };
  const scissors = file.bins.find((b) => b.label === 'Scissors');
  if (!scissors) throw new Error('no Scissors bin');
  scissors.clearanceHeight = 4;
  return file;
}

const layersClearance: Shot = {
  id: 'layouts-layers-clearance',
  kind: 'still',
  async take(s) {
    await installAppImport(s);
    await s.open('/', grid);
    await s.importLayouts([scissorFile()], grid);
    await quietHints(s);
    // W makes Layer 2 active, where the reserved space shows.
    await s.page.keyboard.press('w');
    await s.page.mouse.move(DESKTOP.width / 2, DESKTOP.height - 20);
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.still(pad(await gridArea(s, SCISSOR_DRAWER.width, SCISSOR_DRAWER.depth), 16, DESKTOP));
  },
};

const KITCHEN_ASSIGN: FixtureLayout = {
  ...KITCHEN_DRAWER,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 4, label: 'Spatulas', cat: 'Coral' },
    { x: 2, y: 0, w: 2, d: 1, h: 4, label: 'Whisks', cat: 'Coral' },
    { x: 4, y: 0, w: 2, d: 2, h: 4, label: 'Measuring cups', cat: 'Coral' },
    { x: 0, y: 2, w: 3, d: 2, h: 4, label: 'Tongs', cat: 'Coral' },
    { x: 3, y: 2, w: 2, d: 1, h: 4, label: 'Peelers', cat: 'Coral' },
  ],
};

const categoriesAssign: Shot = {
  id: 'layouts-categories-assign',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, KITCHEN_ASSIGN);
    const sky = s.page
      .getByRole('button', {
        name: label('categories.applyToSelectedBins_other', { name: 'Sky', count: 2 }),
      })
      .first();
    const first = await s.box(
      s.page
        .getByRole('button', { name: label('categories.selectedForNewBins', { name: 'Coral' }) })
        .first()
    );
    const last = await s.box(
      s.page
        .getByRole('button', { name: label('categories.selectForNewBins', { name: 'Charcoal' }) })
        .first()
    );
    const panel = await s.box(s.page.locator('aside').first());
    const rows: Rect = {
      x: panel.x,
      y: first.y - 14,
      width: panel.width,
      height: last.y + last.height + 14 - (first.y - 14),
    };
    const closeUp = frameAround(rows, 0, 4 / 3, withStrip(panel));
    const area = await gridFrame(s, KITCHEN_ASSIGN);
    await parkBelow(s, KITCHEN_ASSIGN, 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(...(await middle(s, binNamed(s, 'Measuring cups'))));
      await s.ui.hold(0.2);
      await ctrlClick(s, binNamed(s, 'Peelers'));
      await s.ui.hold(0.3);
    });
    // Over a row, the cursor would also dim the bins of every other category.
    const skyBox = await s.box(sky);
    const rest = stripRest(panel, skyBox.y + skyBox.height / 2);
    await s.ui.park(...rest);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(sky);
      await s.ui.hold(0.3);
      await s.ui.moveTo(...rest);
      await s.ui.hold(0.2);
    });
    await s.ui.hideCursor();
    await payoff(s, area, 1.8);
  },
};

const categoriesAdd: Shot = {
  id: 'layouts-categories-add',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, KITCHEN_DRAWER);
    const head = await s.box(
      s.page.getByRole('button', { name: label('common.categories'), exact: true }).first()
    );
    const add = s.page.getByRole('button', { name: label('categories.addCategory') }).first();
    const panel = await s.box(s.page.locator('aside').first());
    // Room for the new row with its name field and the two rows of colors.
    const area: Rect = { x: panel.x, y: head.y - 4, width: panel.width + STRIP, height: 430 };
    const rest = stripRest(panel, area.y + area.height * 0.45);
    await s.ui.park(...rest);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(add);
        await s.ui.hold(0.5);
        await s.page.keyboard.press('ControlOrMeta+a');
        await s.type('Baking');
        await s.ui.hold(0.3);
        await s.ui.click(
          s.page.getByRole('button', { name: label('categories.setColorTo', { name: 'Amber' }) })
        );
        await s.ui.hold(0.4);
        // The gap above the gallery card: outside the row, and on no control.
        const gallery = await s.box(
          s.page
            .getByRole('button', { name: new RegExp(`^${label('sidebar.inspirationGallery')}`) })
            .first()
        );
        await s.ui.clickAt(area.x + area.width * 0.6, gallery.y - 9);
        // The rows close up under the cursor, so it moves back to the strip.
        await s.ui.moveTo(...rest);
        s.poster();
        await s.ui.hold(1.6);
      },
      1.5
    );
  },
};

const categoriesPatterns: Shot = {
  id: 'layouts-categories-patterns',
  kind: 'still',
  async take(s) {
    // A pattern comes from a hash of the category id, and an import makes new
    // random ids, so two categories can share one. Imported again until all differ.
    for (let i = 0; ; i++) {
      await openQuiet(s, WORKBENCH);
      const distinct = await s.page.evaluate(async () => {
        const { useLayoutStore } = (await (window as unknown as AppImport).__appImport(
          '/src/core/store/layout/index.ts'
        )) as {
          useLayoutStore: { getState(): { layout: { categories: { id: string }[] } } };
        };
        const { getCategoryPatternIndex } = (await import(
          '/src/features/grid-editor/components/Grid/Bin/categoryPatterns.ts' as string
        )) as { getCategoryPatternIndex(id: string): number };
        const ids = useLayoutStore.getState().layout.categories.map((c) => c.id);
        return new Set(ids.map(getCategoryPatternIndex)).size === ids.length;
      });
      if (distinct) break;
      if (i >= 15) throw new Error('every import gave two categories the same pattern');
    }
    await s.page.evaluate(async () => {
      const { useSettingsStore } = (await (window as unknown as AppImport).__appImport(
        '/src/core/store/settings.ts'
      )) as {
        useSettingsStore: { getState(): { updateSetting(key: string, value: unknown): void } };
      };
      useSettingsStore.getState().updateSetting('distinguishCategoriesByPattern', true);
    });
    await s.page.mouse.move(DESKTOP.width / 2, DESKTOP.height - 20);
    await s.ui.warm(20);
    await s.still(pad(await gridArea(s, WORKBENCH.width, WORKBENCH.depth), 16, DESKTOP));
  },
};

async function openLibrary(s: DocsSession): Promise<void> {
  await installAppImport(s);
  await openLayouts(s, ...LIBRARY.map(({ layout }) => layout));
  // The library loads from storage after the grid shows.
  const names = LIBRARY.map(({ layout }) => layout.name);
  for (let i = 0; ; i++) {
    const have = await s.page.evaluate(async () => {
      const { useLibraryStore } = (await (window as unknown as AppImport).__appImport(
        '/src/core/store/library.ts'
      )) as {
        useLibraryStore: { getState(): { library: { entries: { name: string }[] } } };
      };
      return useLibraryStore.getState().library.entries.map((e) => e.name);
    });
    if (names.every((n) => have.includes(n))) break;
    if (i > 100) throw new Error(`the library holds only ${have.join(', ')}`);
    await s.ui.warm(2);
    await s.page.waitForTimeout(100);
  }
  await fileLibrary(s);
  await s.open('/', grid);
  await quietHints(s);
}

const organizingSwitchMenu: Shot = {
  id: 'layouts-organizing-switch-menu',
  kind: 'still',
  async take(s) {
    await openLibrary(s);
    // The last layout of the library is the open one.
    const open = LIBRARY[LIBRARY.length - 1]?.layout.name ?? '';
    const trigger = s.page
      .getByRole('button', { name: label('header.switchLayout', { name: open }), exact: true })
      .first();
    await trigger.click({ force: true });
    const menu = s.page.getByRole('menu').first();
    await s.until(menu);
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(20);
    await s.dismissToasts();
    const name = await s.box(
      s.page.getByRole('button', { name: label('header.editLayoutName') }).first()
    );
    await s.still(pad(union(name, await s.box(menu)), 12, DESKTOP), 1.25);
  },
};

const organizingNewFolder: Shot = {
  id: 'layouts-organizing-new-folder',
  kind: 'clip',
  async take(s) {
    await openLibrary(s);
    await s.page.keyboard.press('ControlOrMeta+o');
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.page
      .getByRole('button', { name: new RegExp(`^${label('layouts.folders.all')}`) })
      .first()
      .click();
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(20);
    await s.dismissToasts();
    const tree = await s.box(s.page.getByRole('tree', { name: label('layouts.folders.tree') }));
    const newFolder = s.page
      .getByRole('button', { name: label('layouts.folders.newFolder'), exact: true })
      .first();
    const box = await s.box(dialog);
    // The folder rows sit at the top of a tall column and New folder at its foot,
    // so a close-up on the button cuts to the rows.
    const column: Rect = {
      x: box.x,
      y: tree.y,
      width: tree.x + tree.width + 20 - box.x,
      height: box.y + box.height - tree.y,
    };
    const button = await s.box(newFolder);
    const foot = frameAround({ ...button, width: column.width - 40 }, 24, 4 / 3, column);
    const rows: Rect = { ...foot, y: column.y };
    await s.ui.park(foot.x + foot.width - 16, foot.y + 20);
    await s.take(
      foot,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(newFolder);
        await s.ui.hold(0.4);
        await s.type('Basement');
        await s.ui.hold(0.3);
        await s.ui.click(
          s.page.getByRole('button', { name: label('layouts.folders.create'), exact: true })
        );
        await s.ui.hold(0.2);
      },
      640 / foot.width
    );
    await s.ui.hideCursor();
    await payoff(s, rows, 1.8);
  },
};

interface ClockHooks {
  __vt: { step(ms: number): void };
}

async function seedSnapshots(s: DocsSession): Promise<void> {
  const minute = 60_000;
  const steps: { bins: number; label?: string; after: number }[] = [
    { bins: 7, after: 52 * minute },
    { bins: 9, label: 'Before the bit drawer', after: 31 * minute },
    { bins: 11, after: 6 * minute },
  ];
  for (const step of steps) {
    await s.page.evaluate(async ({ bins, label: name }) => {
      const { useLayoutStore } = (await (window as unknown as AppImport).__appImport(
        '/src/core/store/layout/index.ts'
      )) as {
        useLayoutStore: {
          getState(): { layout: { bins: unknown[] }; activeLayoutId: string };
        };
      };
      const { useSnapshotStore } = (await (window as unknown as AppImport).__appImport(
        '/src/core/store/snapshots.ts'
      )) as {
        useSnapshotStore: {
          getState(): {
            snapshots: { id: string }[];
            loadForLayout(id: string): Promise<void>;
            removeSnapshot(id: string): Promise<void>;
            addSnapshot(id: string, layout: unknown, label?: string): Promise<void>;
          };
        };
      };
      const { layout, activeLayoutId } = useLayoutStore.getState();
      const snaps = useSnapshotStore.getState();
      await snaps.loadForLayout(activeLayoutId);
      // The one the app saves on load would read as the oldest.
      if (bins === 7)
        for (const old of useSnapshotStore.getState().snapshots)
          await useSnapshotStore.getState().removeSnapshot(old.id);
      await snaps.addSnapshot(
        activeLayoutId,
        { ...layout, bins: layout.bins.slice(0, bins) },
        name
      );
    }, step);
    await s.page.evaluate((ms) => (window as unknown as ClockHooks).__vt.step(ms), step.after);
  }
  await s.ui.warm(10);
}

const organizingHistory: Shot = {
  id: 'layouts-organizing-history',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, WORKBENCH);
    await seedSnapshots(s);
    await s.page
      .getByRole('tab', { name: label('rightPanel.historyTab'), exact: true })
      .first()
      .click({ force: true });
    await s.ui.warm(20);
    await s.page.waitForTimeout(800);
    await s.ui.warm(20);
    const panel = await s.box(s.page.locator('aside').last());
    const restore = s.page
      .getByRole('button', { name: label('snapshots.restore'), exact: true })
      .nth(1);
    const entries = s.page.getByTestId('snapshot-entry');
    const last = await s.box(entries.nth(2));
    const list: Rect = {
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: last.y + last.height + 12 - panel.y,
    };
    // Grown to 4:3 to the left, over the open layout, so the dialog take can share the aspect.
    const area = frameAround(list, 0, 4 / 3, WINDOW);
    // Left of Save checkpoint, on no row: a row shows its buttons under the cursor.
    const checkpoint = await s.box(
      s.page.getByRole('button', { name: label('snapshots.saveCheckpoint') }).first()
    );
    await s.ui.park(panel.x + 40, checkpoint.y + checkpoint.height / 2);
    await s.take(area, async () => {
      await s.ui.hold(0.6);
      await s.ui.click(restore);
      await s.ui.hold(0.3);
    });
    await s.ui.hideCursor();
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.take(frameAround(await s.box(dialog), 16, 4 / 3, WINDOW), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const SUGGEST_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  bins: [
    { x: 0, y: 0, w: 1, d: 1, h: 6, label: '', cat: 'Fasteners' },
    { x: 4, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 4, y: 2, w: 2, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

const findSizeSuggestion: Shot = {
  id: 'layouts-find-bins-size-suggestion',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, SUGGEST_DRAWER);
    const target = s.page.locator('[data-bin-id]').first();
    const grid = await gridFrame(s, SUGGEST_DRAWER);
    await parkBelow(s, SUGGEST_DRAWER, 0.75);
    await s.take(grid, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(...(await middle(s, target)));
      await parkAway(s, SUGGEST_DRAWER, 0.75);
      await s.ui.hold(0.3);
    });
    const field = s.page.getByLabel(label('inspector.binLabel'), { exact: true }).first();
    const panel = await s.box(s.page.locator('aside').last());
    const fieldBox = await s.box(field);
    const closeUp = frameAround(
      { x: panel.x, y: fieldBox.y - 40, width: panel.width, height: 150 },
      12,
      4 / 3,
      WINDOW
    );
    await s.ui.park(closeUp.x + closeUp.width * 0.6, closeUp.y + closeUp.height * 0.92);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(field);
      await s.type('screws');
      // Escape closes the label list, which covers the suggestion line.
      await s.keys('Escape', 'Esc');
      const apply = s.page
        .getByRole('button', { name: label('inspector.sizeSuggestionApply'), exact: true })
        .first();
      await s.until(apply);
      await s.ui.hold(0.6);
      await s.ui.click(apply);
      await s.ui.hold(0.3);
    });
    await s.ui.park(grid.x + grid.width * 0.75, grid.y + grid.height - 20);
    await s.take(grid, async () => {
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const EDGE_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 5,
  depth: 3,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 0, w: 2, d: 1, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 0, y: 2, w: 3, d: 1, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

const drawerDragEdge: Shot = {
  id: 'layouts-drawer-setup-drag-edge',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, EDGE_DRAWER);
    const canvas = await canvasBetweenPanels(s);
    // The grid zooms to fill the canvas width after each change, so the crop is that width.
    const area: Rect = { x: canvas.x, y: 92, width: canvas.width, height: canvas.width * 0.75 };
    const [x1, y1] = await cellCenter(s, 1, 1);
    const [x2, y2] = await cellCenter(s, 2, 2);
    const cell = { w: x2 - x1, h: y1 - y2 };
    const edge = s.page.getByTitle(label('grid.dragToAddRemoveColumns'), { exact: true }).first();
    const corner = s.page
      .getByTitle(label('grid.dragToAddRemoveRowsAndColumns'), { exact: true })
      .first();
    await s.ui.park(area.x + area.width * 0.5, area.y + area.height - 16);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      const e = await middle(s, edge);
      await s.ui.drag(e, [e[0] + cell.w * 2, e[1]], 22);
      await s.ui.hold(0.8);
      const c = await middle(s, corner);
      await s.ui.drag(c, [c[0] + cell.w, c[1] + cell.h], 20);
      await s.ui.moveTo(area.x + area.width * 0.5, area.y + area.height - 16);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const OVERSIZE_DRAWER: FixtureLayout = {
  ...SHOP,
  name: 'Tool drawer',
  width: 11,
  depth: 8,
  bins: [
    { x: 0, y: 0, w: 2, d: 3, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 3, d: 2, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 5, y: 0, w: 4, d: 2, h: 6, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 0, y: 3, w: 3, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
  ],
};

const drawerMeasured: Shot = {
  id: 'layouts-drawer-setup-measured',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, OVERSIZE_DRAWER);
    const head = s.page
      .getByRole('button', { name: new RegExp(`^${label('sidebar.gridSize')}`) })
      .first();
    await s.ui.preReveal(head);
    const top = await s.box(head);
    const add = s.page.getByRole('button', { name: label('drawerDims.addMeasured') });
    const panel = await s.box(s.page.locator('aside').first());
    const area: Rect = { x: 0, y: top.y - 4, width: panel.width + STRIP, height: 300 };
    const rest = stripRest(panel, area.y + area.height * 0.45);
    await s.ui.park(...rest);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(add);
        await s.ui.moveTo(...rest);
        await s.ui.hold(0.3);
        await s.type('430');
        await s.keys('Tab');
        await s.type('310');
        await s.keys('Tab');
        await s.type('80');
        await s.keys('Enter');
        await s.ui.hold(1.6);
        await s.ui.click(
          s.page.getByRole('button', { name: label('drawerDims.suggestionUse'), exact: true })
        );
        await s.ui.moveTo(...rest);
        s.poster();
        await s.ui.hold(1.8);
      },
      1.6
    );
  },
};

const drawerShape: Shot = {
  id: 'layouts-drawer-setup-shape',
  kind: 'clip',
  async take(s) {
    await openQuiet(s, WORKBENCH);
    const toggle = s.page.getByRole('switch', { name: label('drawerShape.toggle') }).first();
    await s.ui.preReveal(toggle);
    const head = await s.box(
      s.page.getByRole('button', { name: new RegExp(`^${label('sidebar.gridSize')}`) }).first()
    );
    const closeUp = frameAround(union(head, await s.box(toggle)), 12, 4 / 3, {
      x: 0,
      y: 48,
      width: head.width + 40,
      height: DESKTOP.height - 48,
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.4, closeUp.y + closeUp.height * 0.92);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(toggle);
      await s.ui.hold(0.3);
    });
    const dialog = s.page.getByRole('dialog', { name: label('drawerShape.editor.title') });
    await s.until(dialog);
    // Row 0 is the front, so the back-right corner WORKBENCH leaves empty is rows 5
    // and 6, columns 6 to 8. A drag paints only the cells it passes over, so it
    // runs along the back row and returns along the row in front of it.
    const cell = (row: number, col: number): Promise<[number, number]> =>
      middle(s, dialog.locator(`[data-cell-index="${row * WORKBENCH.width + col}"]`));
    const path = [await cell(6, 8), await cell(6, 6), await cell(5, 6), await cell(5, 8)];
    const apply = dialog.getByRole('button', {
      name: label('drawerShape.editor.apply'),
      exact: true,
    });
    await s.take(frameAround(await s.box(dialog), 12, 4 / 3, WINDOW), async () => {
      await s.ui.hold(0.4);
      await pathDrag(s, path, 12);
      await s.ui.hold(0.6);
      // The take ends on the press: once the dialog closes, this crop shows only canvas.
      await s.ui.moveTo(...(await middle(s, apply)));
      await s.ui.hold(0.1);
    });
    await s.page.evaluate(() => (window as unknown as CursorHooks).__cursor.press());
    await s.page.mouse.click(...(await middle(s, apply)));
    // Once the dialog closes, the pointer would rest on a bin and show its hover handles.
    await s.page.mouse.move(DESKTOP.width / 2, DESKTOP.height - 20);
    await s.ui.hideCursor();
    await s.ui.warm(60);
    await payoff(s, await gridFrame(s, WORKBENCH), 1.8);
  },
};

const drawerHeightCheck: Shot = {
  id: 'layouts-drawer-setup-height-check',
  kind: 'still',
  async take(s) {
    await openQuiet(s, DESK_DRAWER);
    const head = s.page
      .getByRole('button', { name: new RegExp(`^${label('sidebar.gridSize')}`) })
      .first();
    await s.ui.preReveal(head);
    const top = await s.box(head);
    const half = await s.box(
      s.page.getByRole('switch', { name: label('sidebar.toggleHalfBinMode') }).first()
    );
    await s.still(await panelCrop(s, top.y, half.y - 6), 1.5);
  },
};

export const LAYOUTS: readonly Shot[] = [
  placingStash,
  placingDraw,
  placingBrush,
  placingMoveCopy,
  placingResize,
  placingRotate,
  placingExpand,
  placingBlocked,
  multiSelectRows,
  multiSelectAlign,
  multiSelectInspector,
  multiSelectMerge,
  multiSelectBinMenu,
  layersAddRename,
  layersStack,
  layersClearance,
  categoriesAssign,
  categoriesAdd,
  categoriesPatterns,
  organizingSwitchMenu,
  organizingNewFolder,
  organizingHistory,
  findSizeSuggestion,
  drawerDragEdge,
  drawerMeasured,
  drawerShape,
  drawerHeightCheck,
  findBinsToolbar,
  multiSelectToolbar,
  layersPanel,
  layersExploded,
  drawerGridSize,
  drawerCeiling,
  categoriesPanel,
  organizingManager,
];
