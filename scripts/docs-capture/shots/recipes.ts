import type { Locator, Page } from '@playwright/test';
import { layoutFile } from '../fixtures';
import type { FixtureBin, FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, pad } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import type { Params } from './apps';
import { designerReady, openBaseplate, openDesigner, partBox, waitBaseplate } from './apps';
import { grid, openLayouts } from './layoutEditor';

const WINDOW: Rect = { x: 0, y: 0, ...DESKTOP };

/**
 * Off camera: saves a bin design to the library on the open page, its params
 * merged into the defaults, and returns its id. The layout finds a design
 * through the library index, so it goes in there too, as a shared layout's
 * designs do.
 */
async function saveDesign(s: DocsSession, name: string, params: Params): Promise<string> {
  return s.page.evaluate(
    async ([n, p]) => {
      const { getDesignStorePort } = (await import(
        '/src/core/storage/designStorePort.ts' as string
      )) as {
        getDesignStorePort(): {
          saveDesign(
            input: object
          ): Promise<{ ok: boolean; value?: { id: string; name: string; updatedAt: string } }>;
          registryEdgeFields(params: unknown): Promise<object>;
          registryPlacementFields(params: unknown): Promise<object>;
          upsertRegistryEntry(entry: object): Promise<{ ok: boolean }>;
        } | null;
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
      const port = getDesignStorePort();
      if (!port) throw new Error('no design store on this page');
      const params = deepMerge(DEFAULT_BIN_PARAMS, p) as Params;
      const res = await port.saveDesign({
        name: n,
        params,
        thumbnail: null,
        exportFileNameConfig: null,
      });
      if (!res.ok || !res.value) throw new Error(`could not save design ${n}`);
      const indexed = await port.upsertRegistryEntry({
        id: res.value.id,
        name: res.value.name,
        width: params.width,
        depth: params.depth,
        height: params.height,
        ...(await port.registryEdgeFields(params)),
        ...(await port.registryPlacementFields(params)),
        updatedAt: res.value.updatedAt,
      });
      if (!indexed.ok) throw new Error(`could not index design ${n}`);
      return res.value.id;
    },
    [name, params] as const
  );
}

interface LinkedBin extends FixtureBin {
  design?: string;
}

interface LinkedLayout extends Omit<FixtureLayout, 'bins'> {
  bins: LinkedBin[];
}

/**
 * Opens the layout editor on `layout` with its bins linked to `designs`,
 * saved to the library first: an imported layout carries only each bin's
 * design id, and a linked bin draws its design only once the library holds it.
 */
async function openLinkedLayout(
  s: DocsSession,
  layout: LinkedLayout,
  designs: Record<string, { name: string; params: Params }>
): Promise<Record<string, string>> {
  await s.open('/', grid);
  const ids: Record<string, string> = {};
  for (const [key, d] of Object.entries(designs)) ids[key] = await saveDesign(s, d.name, d.params);
  const file = layoutFile(layout) as { bins: object[] };
  await s.importLayouts(
    [
      {
        ...file,
        bins: file.bins.map((b, i) => {
          const key = layout.bins[i]?.design;
          const id = key ? ids[key] : undefined;
          if (key && !id) throw new Error(`no design ${key}`);
          return id ? { ...b, linkedDesignId: id } : b;
        }),
      },
    ],
    grid
  );
  await waitThumbnails(s, Object.values(ids));
  return ids;
}

async function openDesign(s: DocsSession, id: string): Promise<void> {
  await s.page.evaluate(async (active) => {
    const storage = (await import(
      '/src/features/bin-designer/storage/DesignerStorage.ts' as string
    )) as { setActiveDesignId(id: string): void };
    storage.setActiveDesignId(active);
  }, id);
  await s.open('/designer', designerReady);
  await s.ui.waitBuilt();
  await s.dismissToasts();
}

async function scrollPanel(s: DocsSession, target: Locator, y: number): Promise<void> {
  await target.evaluate((el, top) => {
    let n = el.parentElement;
    while (
      n &&
      !(n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))
    )
      n = n.parentElement;
    if (n) n.scrollTop += el.getBoundingClientRect().top - top;
  }, y);
  await s.ui.warm(6);
}

/**
 * Waits off camera while the app draws the library thumbnails of new designs.
 * It does that once a page load, on the same worker as the layout preview,
 * and a request to that worker cancels the one before it: the preview opens
 * only after it.
 */
async function waitThumbnails(s: DocsSession, ids: readonly string[]): Promise<void> {
  for (let i = 0; ; i++) {
    const missing = await s.page.evaluate(async (want) => {
      const { listDesigns } = (await import(
        '/src/features/bin-designer/storage/DesignerStorage.ts' as string
      )) as {
        listDesigns(): Promise<{ ok: boolean; value?: { id: string; thumbnail: string | null }[] }>;
      };
      const res = await listDesigns();
      const drawn = new Set((res.value ?? []).filter((d) => d.thumbnail).map((d) => d.id));
      return want.filter((id) => !drawn.has(id)).length;
    }, ids);
    if (missing === 0) break;
    if (i >= 600) throw new Error(`${missing} design thumbnails not drawn within 120 s`);
    await s.ui.warm(4);
    await s.page.waitForTimeout(200);
  }
  await s.ui.warm(10);
}

/**
 * The scene's built bin meshes: how many distinct geometries of more than
 * `minTriangles` triangles it draws. A linked bin draws its design's real
 * mesh, thousands of triangles, and a labeled one gets its own; a bin still
 * waiting for it is one of the merged boxes, 36 triangles each.
 */
async function builtMeshes(s: DocsSession, minTriangles: number): Promise<number> {
  return s.page.evaluate((min) => {
    type Obj = {
      visible: boolean;
      parent: Obj | null;
      isMesh?: boolean;
      isScene?: boolean;
      geometry?: {
        uuid: string;
        index: { count: number } | null;
        attributes: { position?: { count: number } };
      };
      traverse(fn: (o: Obj) => void): void;
    };
    const w = window as unknown as { __observed: unknown[] };
    const seen = new Set<string>();
    for (const scene of w.__observed as Obj[]) {
      if (!scene.isScene) continue;
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        for (let p: Obj | null = o; p; p = p.parent) if (!p.visible) return;
        const g = o.geometry;
        if ((g.index?.count ?? g.attributes.position?.count ?? 0) / 3 >= min) seen.add(g.uuid);
      });
    }
    return seen.size;
  }, minTriangles);
}

async function waitLinkedMeshes(s: DocsSession, count: number): Promise<void> {
  for (let i = 0; ; i++) {
    const built = await builtMeshes(s, 1000);
    if (built >= count) break;
    if (i >= 900) throw new Error(`only ${built} of ${count} design meshes built within 180 s`);
    await s.ui.warm(2);
    await s.page.waitForTimeout(200);
  }
  await s.page.waitForTimeout(1000);
  await s.ui.warm(30);
}

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

async function fitBins(s: DocsSession, area: Rect): Promise<Rect> {
  const fill = (b: Rect): number => Math.max(b.width / area.width, b.height / area.height);
  const [cx, cy] = [area.x + area.width / 2, area.y + area.height / 2];
  await s.page.mouse.move(cx, cy);
  let box = await binsBox(s);
  for (let i = 0; i < 60 && (fill(box) > 1 || fill(box) < 0.95); i++) {
    await s.page.mouse.wheel(0, fill(box) > 1 ? 100 : -100);
    await s.ui.warm(8);
    const next = await binsBox(s);
    // One notch is about 5%: past the band in one step, settle on the side that fits.
    if (fill(box) < 0.95 && fill(next) > 1) {
      await s.page.mouse.wheel(0, 100);
      await s.ui.warm(8);
      box = await binsBox(s);
      break;
    }
    box = next;
  }
  for (let pass = 0; pass < 3; pass++) {
    const dx = cx - (box.x + box.width / 2);
    const dy = cy - (box.y + box.height / 2);
    if (Math.abs(dx) + Math.abs(dy) < 2) break;
    await s.page.mouse.move(cx, cy);
    await s.page.mouse.down({ button: 'right' });
    await s.page.mouse.move(cx + dx, cy + dy, { steps: 8 });
    await s.page.mouse.up({ button: 'right' });
    // The controls damp a pan, so the camera glides on after the drag.
    for (let i = 0; i < 60; i++) {
      await s.ui.warm(10);
      const next = await binsBox(s);
      const moved = Math.abs(next.x - box.x) + Math.abs(next.y - box.y);
      box = next;
      if (moved < 0.5) break;
    }
  }
  // Parked over the empty floor, away from any bin's hover.
  await s.page.mouse.move(8, DESKTOP.height - 8);
  await s.ui.warm(10);
  return binsBox(s);
}

/** Positive `notches` zoom out. */
async function wheelView(
  s: DocsSession,
  at: readonly [number, number],
  notches: number
): Promise<void> {
  await s.page.mouse.move(...at);
  for (let i = 0; i < Math.abs(notches); i++) {
    await s.page.mouse.wheel(0, Math.sign(notches) * 100);
    await s.ui.warm(4);
  }
  await s.ui.warm(10);
}

/** The left button turns the view (drag up to look from lower); the right button pans it. */
async function dragView(
  s: DocsSession,
  at: readonly [number, number],
  dx: number,
  dy: number,
  button: 'left' | 'right' = 'left'
): Promise<void> {
  const [x, y] = at;
  await s.page.mouse.move(x, y);
  await s.page.mouse.down({ button });
  for (let i = 1; i <= 10; i++) {
    await s.page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
    await s.ui.warm(2);
  }
  await s.page.mouse.up({ button });
  // The controls damp the motion: it drifts on for many frames after the release.
  await s.ui.warm(150);
}

const SCREW_CAT = [
  { name: 'Screws', color: '#38bdf8' },
  { name: 'Bolts', color: '#fbbf24' },
  { name: 'Nuts and washers', color: '#4ade80' },
];

const M3 = ['M3x6', 'M3x8', 'M3x10', 'M3x12', 'M3x16', 'M3x20', 'M3x25', 'M3x30'];
const M4 = ['M4x8', 'M4x10', 'M4x12', 'M4x16', 'M4x20', 'M4x25', 'M4x30', 'M4x40'];
const LONG = ['M5x20', 'M5x30', 'M6x20', 'M6x30', 'M8x30', 'M8x40', 'Inserts', 'Springs'];
const SIZES = ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10'];

/** The recipe's 345 x 260 x 40 mm drawer: an 8 x 6 grid of 26 bins, all 3u. */
const SCREW_DRAWER: LinkedLayout = {
  name: 'Screw drawer',
  width: 8,
  depth: 6,
  height: 5.71,
  measuredMm: { width: 345, depth: 260, height: 40 },
  categories: SCREW_CAT,
  layers: [{ name: 'Layer 1', height: 3 }],
  bins: [
    ...M3.map((l, x) => ({ x, y: 0, w: 1, d: 1, h: 3, label: l, cat: 'Screws', design: 'screw' })),
    ...M4.map((l, x) => ({ x, y: 1, w: 1, d: 1, h: 3, label: l, cat: 'Screws', design: 'screw' })),
    ...LONG.map((l, x) => ({ x, y: 2, w: 1, d: 2, h: 3, label: l, cat: 'Bolts', design: 'bolt' })),
    { x: 0, y: 4, w: 4, d: 2, h: 3, label: 'Nuts', cat: 'Nuts and washers', design: 'nut' },
    { x: 4, y: 4, w: 4, d: 2, h: 3, label: 'Washers', cat: 'Nuts and washers', design: 'washer' },
  ],
};

const SCREW_BIN: Params = {
  width: 1,
  depth: 1,
  height: 3,
  label: { enabled: true },
  scoop: { enabled: true },
};

const divided = (kind: string): Params => ({
  width: 4,
  depth: 2,
  height: 3,
  compartments: {
    cols: 4,
    rows: 2,
    cells: [0, 1, 2, 3, 4, 5, 6, 7],
    compartmentTexts: SIZES.map((m) => `${m} ${kind}`),
  },
  label: { enabled: true },
});

const SCREW_DESIGNS = {
  screw: { name: 'Screw bin', params: SCREW_BIN },
  bolt: { name: 'Bolt bin', params: { ...SCREW_BIN, depth: 2 } },
  nut: { name: 'Nut bin', params: divided('nut') },
  washer: { name: 'Washer bin', params: divided('washer') },
};

/** Tall enough for the drawer's floor labels between the preview's button bars. */
const HERO_VIEW = { width: 1440, height: 1000 };

/**
 * The hero crop: a 4:3 frame below the preview's camera buttons, and where in
 * it the bins go, leaving room for the drawer's size and name on the floor.
 */
const HERO_CROP: Rect = { x: 186, y: 60, width: 1067, height: 800 };
const HERO_BINS: Rect = { x: 336, y: 160, width: 887, height: 550 };
/** The expanded preview between its camera buttons and its shortcut bar. */
const HERO_STAGE: Rect = { x: 0, y: 52, width: HERO_VIEW.width, height: HERO_VIEW.height - 160 };

const screwDrawerHero: Shot = {
  id: 'recipes-screw-drawer-hero',
  kind: 'still',
  viewport: HERO_VIEW,
  async take(s) {
    await openLinkedLayout(s, SCREW_DRAWER, SCREW_DESIGNS);
    await expandPreview(s);
    await waitLinkedMeshes(s, 26);
    await s.dismissToasts();
    // Higher and more from the front than the default view, so the tabs read.
    await dragView(s, [720, 420], 90, 35);
    await fitBins(s, HERO_BINS);
    await s.still(HERO_CROP);
  },
};

/** The drawer after step 2: one bin of each kind, the 1 x 1 linked to its new design. */
const SCREW_STEP_2: LinkedLayout = {
  ...SCREW_DRAWER,
  bins: [
    { x: 0, y: 0, w: 1, d: 1, h: 3, cat: 'Screws', design: 'screw' },
    { x: 0, y: 2, w: 1, d: 2, h: 3, cat: 'Bolts' },
    { x: 0, y: 4, w: 4, d: 2, h: 3, cat: 'Nuts and washers' },
    { x: 4, y: 4, w: 4, d: 2, h: 3, cat: 'Nuts and washers' },
  ],
};

/** The first of `candidates` below `anchor`, for a control whose name repeats down the panel. */
async function below(s: DocsSession, candidates: Locator, anchor: Locator): Promise<Locator> {
  const y = (await s.box(anchor)).y;
  for (let i = 0; i < (await candidates.count()); i++) {
    const b = await candidates.nth(i).boundingBox();
    if (b && b.y > y) return candidates.nth(i);
  }
  throw new Error(`nothing like ${String(candidates)} below ${String(anchor)}`);
}

/** A point in the designer's 3D preview clear of the part, to grab the view by. */
async function grip(s: DocsSession): Promise<[number, number]> {
  const c = await s.box(s.page.locator('canvas').first());
  return [c.x + c.width * 0.85, c.y + c.height * 0.5];
}

async function placePart(s: DocsSession, area: Rect): Promise<Rect> {
  const at = await grip(s);
  const fill = (b: Rect): number => Math.max(b.width / area.width, b.height / area.height);
  let part = await partBox(s);
  for (let i = 0; i < 30 && fill(part) > 1; i++) {
    await wheelView(s, at, 1);
    part = await partBox(s);
  }
  // One notch is about 5%: in while the next one still fits.
  for (let i = 0; i < 30 && fill(part) < 0.94; i++) {
    await wheelView(s, at, -1);
    part = await partBox(s);
  }
  const dx = area.x + area.width / 2 - (part.x + part.width / 2);
  const dy = area.y + area.height / 2 - (part.y + part.height / 2);
  await dragView(s, at, dx, dy, 'right');
  return partBox(s);
}

const PANEL_EDGE = 320;

const screwBlankCaption: Shot = {
  id: 'recipes-screw-drawer-blank-caption',
  kind: 'still',
  async take(s) {
    const ids = await openLinkedLayout(s, SCREW_STEP_2, { screw: SCREW_DESIGNS.screw });
    await openDesign(s, ids.screw ?? '');
    const tabs = s.page.getByText(label('binDesigner.labelTabs'), { exact: true }).first();
    // Below the Interior group's sticky header.
    await scrollPanel(s, tabs, 150);
    const scoop = s.page
      .getByRole('switch', { name: label('binDesigner.fingerScoop'), exact: true })
      .first();
    const customize = await below(
      s,
      s.page.getByRole('button', { name: label('common.customize'), exact: true }),
      scoop
    );
    const top = (await s.box(tabs)).y - 14;
    const bottom = (await s.box(customize)).y + (await s.box(customize)).height + 14;
    // Higher than the default view, so the scoop on the front wall shows inside the bin.
    await dragView(s, await grip(s), 0, 60);
    const height = bottom - top;
    await placePart(s, { x: PANEL_EDGE + 70, y: top + 70, width: 400, height: height - 140 });
    await s.ui.hideCursor();
    await s.still({ x: 0, y: top, width: PANEL_EDGE + 540, height });
  },
};

const TOOL_CAT = [
  { name: 'Power tools', color: '#fbbf24' },
  { name: 'Hand tools', color: '#38bdf8' },
];

const BOTTOM = ['Drill', 'Batteries', 'Jigsaw', 'Chargers'];
const TOP = ['Screwdrivers', 'Pliers', 'Bits', 'Tape and pencils'];
const QUARTERS = [
  [0, 0],
  [5, 0],
  [0, 4],
  [5, 4],
] as const;

/** The recipe's 440 x 345 x 150 mm drawer: 14u bins under 6u trays on a 10 x 8 grid. */
const DEEP_DRAWER: LinkedLayout = {
  name: 'Tool drawer',
  width: 10,
  depth: 8,
  height: 21.42,
  measuredMm: { width: 440, depth: 345, height: 150 },
  categories: TOOL_CAT,
  layers: [
    { name: 'Layer 1', height: 14 },
    { name: 'Layer 2', height: 6 },
  ],
  bins: [
    ...QUARTERS.map(([x, y], i) => ({
      x,
      y,
      w: 5,
      d: 4,
      h: 14,
      label: BOTTOM[i],
      cat: 'Power tools',
      design: 'bin',
    })),
    ...QUARTERS.map(([x, y], i) => ({
      x,
      y,
      w: 5,
      d: 4,
      h: 6,
      label: TOP[i],
      cat: 'Hand tools',
      layer: 1,
      design: 'tray',
    })),
  ],
};

const TRAY: Params = {
  width: 5,
  depth: 4,
  height: 6,
  compartments: { cols: 3, rows: 2, cells: [0, 1, 2, 3, 4, 5] },
  handles: { enabled: true, front: { enabled: false } },
};

const DEEP_DESIGNS = {
  bin: { name: 'Tool bin', params: { width: 5, depth: 4, height: 14 } },
  tray: { name: 'Tool tray', params: TRAY },
};

const deepDrawerHero: Shot = {
  id: 'recipes-deep-tool-drawer-hero',
  kind: 'still',
  viewport: HERO_VIEW,
  async take(s) {
    await openLinkedLayout(s, DEEP_DRAWER, DEEP_DESIGNS);
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('layers.selectLayer', { name: 'Layer 2' }) })
    );
    await expandPreview(s);
    await s.page
      .getByRole('button', { name: label('grid.all'), exact: true })
      .click({ force: true });
    await s.ui.warm(20);
    await waitLinkedMeshes(s, 2);
    await s.page.keyboard.press('e');
    await s.ui.warm(150);
    await s.dismissToasts();
    const bins = await fitBins(s, { x: 200, y: 100, width: 1040, height: 720 });
    // The drawer's size and name lie on the floor inside the stack's box.
    await s.still(frameAround(bins, 24, 4 / 3, HERO_STAGE));
  },
};

const deepFitBins: Shot = {
  id: 'recipes-deep-tool-drawer-fit-bins',
  kind: 'still',
  async take(s) {
    await openLayouts(s, { ...DEEP_DRAWER, bins: [] });
    const head = s.page.getByRole('button', { name: label('common.physicalUnits') }).first();
    await s.ui.preReveal(head);
    const solver = s.page.getByRole('button', { name: label('stackSolver.title') }).first();
    await s.ui.preClick(solver);
    await s.ui.warm(20);
    const rows = s.page
      .getByText(new RegExp(`^${label('stackSolver.rowStacked', { count: 3 })}$`))
      .first();
    await s.ui.preReveal(solver);
    const top = await s.box(solver);
    const last = await s.box(rows);
    const panel = await s.box(s.page.locator('aside').first());
    await s.still(
      {
        x: panel.x,
        y: top.y - 10,
        width: panel.width,
        height: last.y + last.height + 14 - (top.y - 10),
      },
      1.5
    );
  },
};

const deepHandles: Shot = {
  id: 'recipes-deep-tool-drawer-handles',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Tool tray', TRAY);
    const title = s.page.getByText(label('binDesigner.handles'), { exact: true }).first();
    await scrollPanel(s, title, 150);
    const readout = s.page.getByText(/^\d+(\.\d+)? × 15 mm$/).first();
    const top = (await s.box(title)).y - 14;
    const bottom = (await s.box(readout)).y + (await s.box(readout)).height + 8;
    // Swung round to the left of the tray, so its left wall and hand hole face the camera.
    await dragView(s, await grip(s), 320, 20);
    const height = bottom - top;
    await placePart(s, { x: PANEL_EDGE + 40, y: top + 30, width: 460, height: height - 60 });
    await s.ui.hideCursor();
    await s.still({ x: 0, y: top, width: PANEL_EDGE + 540, height });
  },
};

/** Half-grid mode, as the drawer-fit card leaves it, for the recipe's 9.5 unit grid. */
const HALF_GRID = { 'gridfinity-half-bin-mode': 'true' };

const KITCHEN_CAT = [
  { name: 'Utensils', color: '#f87171' },
  { name: 'Prep', color: '#4ade80' },
  { name: 'Gadgets', color: '#38bdf8' },
];

/** The recipe's 405 x 480 x 75 mm drawer: a 9.5 x 11 grid, all bins 6u, for a 220 mm bed. */
const KITCHEN_DRAWER: LinkedLayout = {
  name: 'Kitchen drawer',
  width: 9.5,
  depth: 11,
  height: 10.71,
  measuredMm: { width: 405, depth: 480, height: 75 },
  printBedSize: 220,
  categories: KITCHEN_CAT,
  layers: [{ name: 'Layer 1', height: 6 }],
  bins: [
    ...['Spatulas', 'Ladles', 'Spoons', 'Whisks'].map((l, i) => ({
      x: i * 2,
      y: 0,
      w: 2,
      d: 8,
      h: 6,
      label: l,
      cat: 'Utensils',
      design: 'long',
    })),
    { x: 8, y: 0, w: 1.5, d: 4, h: 6, label: 'Peelers', cat: 'Prep', design: 'thin' },
    { x: 8, y: 4, w: 1.5, d: 4, h: 6, label: 'Scissors', cat: 'Prep', design: 'thin' },
    { x: 0, y: 8, w: 3, d: 3, h: 6, label: 'Measuring', cat: 'Gadgets', design: 'square' },
    { x: 3, y: 8, w: 3, d: 3, h: 6, label: 'Gadgets', cat: 'Gadgets', design: 'square' },
    { x: 6, y: 8, w: 3.5, d: 3, h: 6, label: 'Clips', cat: 'Gadgets', design: 'clips' },
  ],
};

const KITCHEN_DESIGNS = {
  long: { name: 'Utensil bin', params: { width: 2, depth: 8, height: 6 } },
  thin: { name: 'Peeler bin', params: { width: 1.5, depth: 4, height: 6 } },
  square: { name: 'Gadget bin', params: { width: 3, depth: 3, height: 6 } },
  clips: { name: 'Clip bin', params: { width: 3.5, depth: 3, height: 6 } },
};

const kitchenHero: Shot = {
  id: 'recipes-kitchen-utensil-drawer-hero',
  kind: 'still',
  viewport: HERO_VIEW,
  storage: HALF_GRID,
  async take(s) {
    await openLinkedLayout(s, KITCHEN_DRAWER, KITCHEN_DESIGNS);
    await expandPreview(s);
    await waitLinkedMeshes(s, 4);
    await s.dismissToasts();
    // Higher than the default view, so the split lines on the long bins show.
    await dragView(s, [720, 420], 40, 40);
    await fitBins(s, HERO_BINS);
    await s.still(HERO_CROP);
  },
};

const kitchenFitCard: Shot = {
  id: 'recipes-kitchen-utensil-drawer-fit-card',
  kind: 'still',
  async take(s) {
    await openLayouts(s, { name: 'Kitchen drawer', width: 10, depth: 8, height: 12 });
    const head = s.page
      .getByRole('button', { name: new RegExp(`^${label('sidebar.gridSize')}`) })
      .first();
    await s.ui.preReveal(head);
    await s.ui.preClick(s.page.getByRole('button', { name: label('drawerDims.addMeasured') }));
    await s.page.keyboard.type('405');
    await s.page.keyboard.press('Tab');
    await s.page.keyboard.type('480');
    await s.page.keyboard.press('Tab');
    await s.page.keyboard.type('75');
    await s.page.keyboard.press('Enter');
    await s.ui.warm(20);
    const use = s.page
      .getByRole('button', { name: label('drawerDims.suggestionUse'), exact: true })
      .first();
    await s.until(use);
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.dismissToasts();
    const top = await s.box(head);
    const card = await s.box(use);
    const panel = await s.box(s.page.locator('aside').first());
    await s.still(
      {
        x: panel.x,
        y: top.y - 4,
        width: panel.width,
        height: card.y + card.height + 16 - (top.y - 4),
      },
      1.5
    );
  },
};

const kitchenPlateSplit: Shot = {
  id: 'recipes-kitchen-utensil-drawer-plate-split',
  kind: 'still',
  storage: HALF_GRID,
  async take(s) {
    await openBaseplate(s, KITCHEN_DRAWER);
    // Step 4 of the recipe: the drawer's millimetres typed under the steppers.
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('baseplate.editDimensions'), exact: true }).first()
    );
    await s.page.getByLabel(label('baseplate.editDimensionsWidth'), { exact: true }).fill('405');
    await s.page.getByLabel(label('baseplate.editDimensionsDepth'), { exact: true }).fill('480');
    await s.page.keyboard.press('Enter');
    await s.ui.warm(10);
    await waitBaseplate(s);
    const padding = await s.page.evaluate(async () => {
      const { useLayoutStore } = (await import('/src/core/store/layout/index.ts' as string)) as {
        useLayoutStore: { getState(): { layout: { baseplateParams?: Record<string, unknown> } } };
      };
      const p = useLayoutStore.getState().layout.baseplateParams ?? {};
      return [p.paddingLeft, p.paddingRight, p.paddingFront, p.paddingBack].join(' ');
    });
    if (padding !== '3 3 9 9') throw new Error(`the plate took padding ${padding}, not 3 3 9 9`);
    const units = s.page
      .getByRole('button', { name: new RegExp(`^${label('common.physicalUnits')}`) })
      .first();
    await scrollPanel(s, units, 60);
    const hint = s.page.getByText(label('baseplate.splitEditHint')).first();
    const panel = await s.box(s.page.locator('aside').first());
    const top = (await s.box(units)).y - 8;
    const bottom = (await s.box(hint)).y + (await s.box(hint)).height + 14;
    await placePart(s, {
      x: panel.x + panel.width + 30,
      y: top + 20,
      width: 400,
      height: bottom - top - 40,
    });
    await s.ui.hideCursor();
    await s.still({ x: 0, y: top, width: panel.x + panel.width + 460, height: bottom - top });
  },
};

/** The app's five default categories, two renamed as step 2 of the recipe does. */
const CRAFT_CAT = [
  { name: 'Craft', color: '#f87171' },
  { name: 'Electronics', color: '#38bdf8' },
  { name: 'Green', color: '#4ade80' },
  { name: 'Cloud', color: '#e2e8f0' },
  { name: 'Charcoal', color: '#334155' },
];

const cellIds = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

function plateTray(w: number, d: number, cols: number, rows: number, texts: string[]): Params {
  return {
    width: w,
    depth: d,
    height: 3,
    compartments: { cols, rows, cells: cellIds(cols * rows), compartmentTexts: texts },
    // Picking Swappable label deepens the tab to 14 mm: a shallower one holds no socket.
    label: { enabled: true, mode: 'socket', depth: 14, removalHole: true },
    featureColors: { enabled: true, labelTab: '#ffffff', text: '#000000' },
  };
}

function rowTray(rowTexts: string[]): Params {
  const tray = plateTray(3, 2, 4, 2, []);
  return { ...tray, label: { ...(tray.label as Params), rowTexts } };
}

/** Compartments count from the front row; the label list shows the back row first. */
const PARTS_TRAY = plateTray(3, 2, 3, 2, [
  '1k',
  '10k',
  '100k',
  'LED 5mm red',
  'LED 5mm green',
  '220R',
]);

const CRAFT_DESIGNS = {
  leds: { name: 'Parts tray: LEDs', params: PARTS_TRAY },
  resistors: {
    name: 'Parts tray: resistors',
    params: plateTray(3, 2, 3, 2, ['470R', '2k2', '4k7', '22k', '47k', '1M']),
  },
  caps: {
    name: 'Parts tray: capacitors',
    params: plateTray(3, 2, 3, 2, ['100nF', '1uF', '10uF', '100uF', '470uF', '1000uF']),
  },
  headers: {
    name: 'Parts tray: headers',
    params: plateTray(3, 2, 3, 2, [
      'Male header',
      'Female header',
      'JST 2 pin',
      'JST 3 pin',
      'Dupont',
      'Terminals',
    ]),
  },
  smdR: {
    name: 'Fine parts: resistors',
    params: rowTray(['SMD 0805: 1k 10k 100k', 'SMD 0603: 1k 10k 100k']),
  },
  smdC: {
    name: 'Fine parts: capacitors',
    params: rowTray(['SMD 0805: 100n 1u 10u', 'SOT-23: transistors']),
  },
  wire: { name: 'Wire bin', params: plateTray(1, 2, 1, 1, []) },
  beads: {
    name: 'Bead box: beads',
    params: plateTray(2, 2, 2, 2, ['Seed beads', 'Glass beads', 'Wood beads', 'Spacers']),
  },
  buttons: {
    name: 'Bead box: buttons',
    params: plateTray(2, 2, 2, 2, ['Small buttons', 'Big buttons', 'Snaps', 'Toggles']),
  },
  findings: {
    name: 'Bead box: findings',
    params: plateTray(2, 2, 2, 2, ['Jump rings', 'Clasps', 'Crimp beads', 'Ear hooks']),
  },
  tape: { name: 'Tape bin', params: plateTray(3, 4, 1, 1, []) },
  pens: { name: 'Pen bin', params: plateTray(1, 6, 1, 1, []) },
};

/** The recipe's IKEA Alex drawer, 295 x 522 mm: a 7 x 12 grid, electronics at the front. */
const CRAFT_DRAWER: LinkedLayout = {
  name: 'Alex drawer',
  width: 7,
  depth: 12,
  height: 4,
  measuredMm: { width: 295, depth: 522 },
  categories: CRAFT_CAT,
  layers: [{ name: 'Layer 1', height: 3 }],
  bins: [
    { x: 0, y: 0, w: 3, d: 2, h: 3, label: 'LEDs', cat: 'Electronics', design: 'leds' },
    { x: 3, y: 0, w: 3, d: 2, h: 3, label: 'Resistors', cat: 'Electronics', design: 'resistors' },
    { x: 0, y: 2, w: 3, d: 2, h: 3, label: 'Capacitors', cat: 'Electronics', design: 'caps' },
    { x: 3, y: 2, w: 3, d: 2, h: 3, label: 'Headers', cat: 'Electronics', design: 'headers' },
    { x: 0, y: 4, w: 3, d: 2, h: 3, label: 'SMD resistors', cat: 'Electronics', design: 'smdR' },
    { x: 3, y: 4, w: 3, d: 2, h: 3, label: 'SMD parts', cat: 'Electronics', design: 'smdC' },
    { x: 6, y: 0, w: 1, d: 2, h: 3, label: 'Wire', cat: 'Electronics', design: 'wire' },
    { x: 6, y: 2, w: 1, d: 2, h: 3, label: 'Jumpers', cat: 'Electronics', design: 'wire' },
    { x: 6, y: 4, w: 1, d: 2, h: 3, label: 'Batteries', cat: 'Electronics', design: 'wire' },
    { x: 0, y: 6, w: 2, d: 2, h: 3, label: 'Beads', cat: 'Craft', design: 'beads' },
    { x: 2, y: 6, w: 2, d: 2, h: 3, label: 'Buttons', cat: 'Craft', design: 'buttons' },
    { x: 4, y: 6, w: 2, d: 2, h: 3, label: 'Findings', cat: 'Craft', design: 'findings' },
    { x: 0, y: 8, w: 3, d: 4, h: 3, label: 'Washi tape', cat: 'Craft', design: 'tape' },
    { x: 3, y: 8, w: 3, d: 4, h: 3, label: 'Glue sticks', cat: 'Craft', design: 'tape' },
    { x: 6, y: 6, w: 1, d: 6, h: 3, label: 'Pens', cat: 'Craft', design: 'pens' },
  ],
};

const craftHero: Shot = {
  id: 'recipes-electronics-craft-organizer-hero',
  kind: 'still',
  viewport: HERO_VIEW,
  async take(s) {
    await openLinkedLayout(s, CRAFT_DRAWER, CRAFT_DESIGNS);
    await expandPreview(s);
    // One mesh for each of the 12 designs: the bins that share a design with a
    // blank caption share its mesh as well.
    await waitLinkedMeshes(s, 12);
    await s.dismissToasts();
    await dragView(s, [720, 420], 40, 40);
    await fitBins(s, HERO_BINS);
    await s.still(HERO_CROP);
  },
};

/** Tall enough for the whole label section, six captions and the removal hole. */
const PLATES_VIEW = { width: 1440, height: 1200 };

const craftPlates: Shot = {
  id: 'recipes-electronics-craft-organizer-plates',
  kind: 'still',
  viewport: PLATES_VIEW,
  async take(s) {
    await openDesigner(s, 'Parts tray: LEDs', PARTS_TRAY);
    const tabs = s.page.getByText(label('binDesigner.labelTabs'), { exact: true }).first();
    await scrollPanel(s, tabs, 150);
    const hole = s.page
      .getByRole('switch', { name: label('binDesigner.socketRemovalHole'), exact: true })
      .first();
    const top = (await s.box(tabs)).y - 14;
    const bottom = (await s.box(hole)).y + (await s.box(hole)).height + 14;
    // From higher than the default view, so the captions on the plates read.
    await dragView(s, await grip(s), 0, 80);
    // A row of loose plates lies beside the tray, and the area keeps it in the crop.
    await placePart(s, { x: PANEL_EDGE + 10, y: top + 10, width: 620, height: bottom - top - 20 });
    await s.ui.hideCursor();
    await s.still({ x: 0, y: top, width: PANEL_EDGE + 640, height: bottom - top });
  },
};

type Pt = [number, number];

/** A tool's outline from its upper half, tip to end, mirrored about its centre line. */
function mirrored(upper: readonly Pt[]): Pt[] {
  return [...upper, ...[...upper].reverse().map(([x, y]): Pt => [x, -y])];
}

const PLIERS: Pt[] = mirrored([
  [0, 2.5],
  [6, 4],
  [20, 6.5],
  [36, 10],
  [42, 12],
  [46, 13],
  [50, 13.5],
  [54, 13],
  [58, 12],
  [64, 11],
  [80, 12],
  [100, 14.5],
  [120, 17],
  [138, 19],
  [144, 19],
  [148, 18],
  [150, 15.5],
  [150, 12],
  [148, 10],
  [144, 9.5],
  [120, 6.5],
  [100, 4.5],
  [85, 2.5],
  [76, 0.8],
]);

const WRENCH: Pt[] = [
  [0, 9],
  [16, 9],
  [16, -4],
  [3, -4],
  [3, -12],
  [8, -17],
  [18, -20],
  [30, -19],
  [40, -14],
  [48, -9],
  [60, -7],
  [140, -6],
  [146, -5],
  [149.5, -3],
  [150, 0],
  [149.5, 3],
  [146, 5],
  [140, 6],
  [60, 7],
  [48, 10],
  [40, 17],
  [30, 21],
  [18, 22],
  [8, 20],
  [2, 17],
  [0, 15],
];

const SCREWDRIVER: Pt[] = mirrored([
  [0, 2],
  [2, 3],
  [68, 3],
  [70, 4.5],
  [78, 4.5],
  [80, 8],
  [84, 10],
  [95, 10.5],
  [110, 11],
  [128, 11],
  [140, 10.5],
  [146, 9],
  [149, 6.5],
  [150, 3],
]);

/**
 * Where each tool lies on the bin's floor (mm, front-left inside corner),
 * by its centre line: pliers at the front, the screwdriver at the back. Each
 * finger cut reaches 20 mm in front of its tool, so the gaps leave room for it.
 */
const TOOL_ROWS: readonly { outline: Pt[]; y: number }[] = [
  { outline: PLIERS, y: 33.6 },
  { outline: WRENCH, y: 75 },
  { outline: SCREWDRIVER, y: 108.6 },
];

/**
 * The three tools as the phone uploads a scan: one path a tool, in true
 * millimetres, in an SVG frame whose y runs from the back of the bin forward.
 */
function toolScanSvg(): string {
  const points = TOOL_ROWS.flatMap(({ outline, y }) => outline.map(([px, py]): Pt => [px, y + py]));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  const n = (v: number): string => String(Math.round(v * 1000) / 1000);
  const paths = TOOL_ROWS.map(({ outline, y }) => {
    const d = outline.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${n(px)} ${n(maxY - (y + py))}`);
    return `<path d="${d.join(' ')} Z"/>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 ${n(maxY - minY)}" data-scan-units="mm">` +
    `${paths.join('')}</svg>`
  );
}

/**
 * The phone side of a scan needs Redis and a phone. The session answers as a
 * finished scan of the three tools, so the app takes it in through its own
 * phone path.
 */
async function scannedTools(page: Page): Promise<void> {
  const token = 'docs-tool-scan';
  await page.route('**/api/scan-session', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        token,
        url: `https://gridfinitylayouttool.com/scan/${token}`,
        expiresInSeconds: 600,
      }),
    })
  );
  await page.route('**/api/scan-session/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        svg: toolScanSvg(),
        createdAt: '2026-11-02T16:31:00.000Z',
      }),
    })
  );
}

/** First-run cards off and the inspector open, as a maker who has used the editor sees it. */
const CUT_EDITOR_STORAGE = {
  'gridfinity-cutout-quickstart-seen': 'true',
  'gridfinity-cutout-inspector-collapsed': '0',
  'gridfinity-cutout-split': '0.62',
};

const TOOL_BIN: Params = { width: 4, depth: 3, height: 3 };

const thicknessPrompt = (s: DocsSession): Locator =>
  s.page
    .getByRole('region', {
      name: label('binDesigner.cutouts.depthPrompt.titleMany_other', { count: 3 }),
    })
    .first();

/**
 * The bin's floor on the cutout board, in screen px, read off the rulers'
 * tick labels so it follows the editor's own zoom and pan.
 */
async function boardBox(s: DocsSession): Promise<Rect> {
  return s.page.evaluate(async () => {
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as { useDesignerStore: { getState(): { params: object } } };
    const { cutoutInterior } = (await import(
      '/src/features/bin-designer/utils/binDimensions.ts' as string
    )) as { cutoutInterior(p: object): { innerW: number; innerD: number } };
    const { innerW, innerD } = cutoutInterior(useDesignerStore.getState().params);
    const rulers = [...document.querySelectorAll('svg')].filter((svg) => {
      const r = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll('text')].filter((t) =>
        /^\d+$/.test(t.textContent ?? '')
      );
      return Math.min(r.width, r.height) === 24 && labels.length >= 2;
    });
    const wide = (svg: SVGSVGElement): boolean =>
      svg.getBoundingClientRect().width > svg.getBoundingClientRect().height;
    const across = rulers.find(wide);
    const down = rulers.find((svg) => !wide(svg));
    if (!across || !down) throw new Error('no rulers');
    // Labels sit 2 px past their tick, along the ruler.
    const span = (svg: SVGSVGElement, axis: 'x' | 'y'): ((mm: number) => number) => {
      const r = svg.getBoundingClientRect();
      const ticks = [...svg.querySelectorAll('text')]
        .map((t): [number, number] => [
          Number(t.textContent),
          axis === 'x'
            ? r.left + Number(t.getAttribute('x')) - 2
            : r.top + Number(t.getAttribute('y')) + 2,
        ])
        .sort((a, b) => a[0] - b[0]);
      const first = ticks[0];
      const last = ticks[ticks.length - 1];
      if (!first || !last || first[0] === last[0]) throw new Error('a ruler shows one label');
      const perMm = (last[1] - first[1]) / (last[0] - first[0]);
      return (mm) => first[1] + (mm - first[0]) * perMm;
    };
    const x = span(across, 'x');
    const y = span(down, 'y');
    return { x: x(0), y: y(innerD), width: x(innerW) - x(0), height: y(0) - y(innerD) };
  });
}

/**
 * Steps 1 and 2 of the recipe: a solid 4 x 3 x 3u bin, then a phone scan of
 * the three tools, which leaves the thickness prompt open over the board.
 */
async function scanTools(s: DocsSession): Promise<void> {
  await scannedTools(s.page);
  await openDesigner(s, 'Hand tools', TOOL_BIN);
  await s.ui.preClick(
    s.page
      .getByRole('radio', { name: new RegExp(`^${label('binDesigner.interior.solid.title')}`) })
      .first()
  );
  await s.ui.waitBuilt();
  const done = s.page
    .getByRole('button', { name: label('binDesigner.cutoutEditor.done'), exact: true })
    .first();
  if (!(await done.isVisible())) {
    await s.page.evaluate(async () => {
      const { useDesignerStore } = (await import(
        '/src/features/bin-designer/store/designer.ts' as string
      )) as { useDesignerStore: { getState(): { setCutoutEditorOpen(open: boolean): void } } };
      useDesignerStore.getState().setCutoutEditorOpen(true);
    });
  }
  await s.until(done, 60000);
  await s.ui.preClick(
    s.page
      .getByRole('button', { name: label('binDesigner.cutouts.scanImport.title'), exact: true })
      .first()
  );
  const dialog = s.page.getByRole('dialog').first();
  await s.ui.preClick(
    dialog.getByRole('button', {
      name: new RegExp(`^${label('binDesigner.cutouts.scanImport.routePhone')}`),
    })
  );
  await s.until(thicknessPrompt(s), 60000);
  await s.ui.preClick(
    dialog
      .getByRole('button', { name: label('binDesigner.cutouts.scanImport.done'), exact: true })
      .first()
  );
  await s.ui.warm(20);
  await s.ui.waitBuilt();
  await s.dismissToasts();
}

const toolsThickness: Shot = {
  id: 'recipes-hand-tool-pockets-thickness',
  kind: 'still',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await scanTools(s);
    const prompt = thicknessPrompt(s);
    await prompt.getByLabel(label('binDesigner.cutouts.depthPrompt.thickness')).fill('18');
    await prompt.getByLabel(label('binDesigner.cutouts.depthPrompt.proud')).fill('3');
    await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(10);
    const board = await boardBox(s);
    const chip = await s.box(prompt);
    // From just under the board's ruler, which runs above the prompt.
    const top = chip.y - 10;
    await s.still(
      {
        x: board.x - 18,
        y: top,
        width: board.width + 36,
        height: board.y + board.height + 18 - top,
      },
      1.4
    );
  },
};

/**
 * Steps 3 and 4 of the recipe, off camera: 18 mm tools that stand 3 mm proud,
 * the group dragged to where each tool's finger cut fits in front of it, and
 * Add finger access on each tool, placed by the app's own planner.
 */
async function pocketTools(s: DocsSession): Promise<void> {
  const prompt = thicknessPrompt(s);
  await prompt.getByLabel(label('binDesigner.cutouts.depthPrompt.thickness')).fill('18');
  await prompt.getByLabel(label('binDesigner.cutouts.depthPrompt.proud')).fill('3');
  await s.ui.preClick(
    prompt.getByRole('button', {
      name: label('binDesigner.cutouts.depthPrompt.apply'),
      exact: true,
    })
  );
  await s.ui.waitBuilt();
  const frontEdge = Math.min(...PLIERS.map(([, y]) => (TOOL_ROWS[0]?.y ?? 0) + y));
  await s.page.evaluate(async (front) => {
    type Cut = { id: string; x: number; y: number; width: number; depth: number; finger?: unknown };
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as {
      useDesignerStore: {
        getState(): {
          params: { cutouts: Cut[]; cutoutConfig: { topOffset: number } };
          updateCutoutsBatch(updates: Map<string, Partial<Cut>>): void;
          addFingerAccess(pocketId: string, finger: object): boolean;
        };
      };
    };
    const { translateCutout } = (await import(
      '/src/features/bin-designer/components/panel/CutoutsSection/cutoutHelpers.ts' as string
    )) as { translateCutout(c: Cut, dx: number, dy: number): Cut };
    const { binBoard } = (await import(
      '/src/features/bin-designer/components/panel/CutoutsSection/packIntoBin.ts' as string
    )) as { binBoard(params: unknown): { width: number; depth: number } };
    const { planFingerAccess } = (await import(
      '/src/features/bin-designer/components/panel/CutoutsSection/fingerAccessPlan.ts' as string
    )) as { planFingerAccess(pocket: Cut, board: unknown, maxCutDepth: number): object | null };
    const { binDimensions } = (await import(
      '/src/features/bin-designer/utils/binDimensions.ts' as string
    )) as { binDimensions(params: unknown): { wallHeight: number } };
    const store = useDesignerStore;
    const tools = store.getState().params.cutouts;
    const board = binBoard(store.getState().params);
    const minX = Math.min(...tools.map((c) => c.x));
    const maxX = Math.max(...tools.map((c) => c.x + c.width));
    const minY = Math.min(...tools.map((c) => c.y));
    const dx = (board.width - (maxX - minX)) / 2 - minX;
    const dy = front - minY;
    store
      .getState()
      .updateCutoutsBatch(new Map(tools.map((c) => [c.id, translateCutout(c, dx, dy)])));
    const { params } = store.getState();
    const maxCutDepth = Math.max(
      0,
      binDimensions(params).wallHeight - params.cutoutConfig.topOffset
    );
    for (const pocket of params.cutouts) {
      const plan = planFingerAccess(pocket, binBoard(params), maxCutDepth);
      if (!plan) throw new Error('a tool took no finger access');
      if (!store.getState().addFingerAccess(pocket.id, { ...plan, id: crypto.randomUUID() }))
        throw new Error('finger access was refused');
    }
  }, frontEdge);
  await s.ui.warm(10);
  await s.ui.waitBuilt();
  await s.dismissToasts();
}

const toolsFitTest: Shot = {
  id: 'recipes-hand-tool-pockets-fit-test',
  kind: 'still',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await scanTools(s);
    await pocketTools(s);
    await s.ui.preClick(
      s.page.getByRole('tab', { name: label('binDesigner.shapeList.tabProperties') }).first()
    );
    await s.ui.preClick(
      s.page
        .getByRole('button', { name: label('binDesigner.cutouts.fitTest.button'), exact: true })
        .first()
    );
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.ui.preClick(
      dialog
        .getByRole('radio', { name: label('binDesigner.cutouts.fitTest.modeOutline'), exact: true })
        .first()
    );
    await s.page.waitForTimeout(1500);
    await s.ui.warm(30);
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(10);
    await s.still(pad(await s.box(dialog), 12, DESKTOP));
  },
};

const toolsHero: Shot = {
  id: 'recipes-hand-tool-pockets-hero',
  kind: 'still',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await scanTools(s);
    await pocketTools(s);
    await s.ui.preClick(
      s.page
        .getByRole('button', { name: label('binDesigner.cutoutEditor.done'), exact: true })
        .first()
    );
    await s.ui.waitBuilt();
    await s.ui.warm(60);
    // Higher than the default view, so the pockets show their depth and floors.
    await dragView(s, await grip(s), 0, 50);
    const canvas = await s.box(s.page.locator('canvas').first());
    await placePart(s, {
      x: canvas.x + 60,
      y: canvas.y + 90,
      width: canvas.width - 120,
      height: canvas.height - 150,
    });
    await s.ui.hideCursor();
    await s.still(WINDOW);
  },
};

export const RECIPES: readonly Shot[] = [
  screwDrawerHero,
  screwBlankCaption,
  deepDrawerHero,
  deepFitBins,
  deepHandles,
  kitchenHero,
  kitchenFitCard,
  kitchenPlateSplit,
  craftHero,
  craftPlates,
  toolsThickness,
  toolsFitTest,
  toolsHero,
];
