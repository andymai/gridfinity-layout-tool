import type { Locator } from '@playwright/test';
import { layoutFile, WORKBENCH } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import type { DesignerStoreModule } from '../../feature-tips/appModules';
import { FPS } from '../../feature-tips/encode';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { openBaseplate, openDesigner, partBox } from './apps';
import type { Params } from './apps';
import { grid, gridArea, openLayouts } from './layoutEditor';

const WINDOW: Rect = { x: 0, y: 0, ...DESKTOP };

const preview = (s: DocsSession): Promise<Rect> => s.box(s.page.locator('canvas').first());

/**
 * Off camera: drags `dx`, `dy` CSS px across a 3D preview from `at`, with the
 * left button to turn the view (up to look from lower) or the right button
 * to pan it, then lets the camera settle.
 */
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

/** Off camera: turns the wheel over a 3D preview at `at`, zooming out when `notches` is positive. */
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

/** A point in the 3D preview clear of the part, to grab the view by. */
async function grip(s: DocsSession): Promise<[number, number]> {
  const c = await preview(s);
  return [c.x + c.width * 0.75, c.y + c.height * 0.5];
}

/** A 4 x 3 drawer on a 100 mm bed, so its baseplate prints in pieces. */
const SMALL_BED_DRAWER: FixtureLayout = {
  name: 'Workbench',
  width: 4,
  depth: 3,
  height: 6,
  printBedSize: 100,
};

/** The plate in the baseplate generator, then a cut to a bin with its feet and lip. */
const basicsParts: Shot = {
  id: 'introduction-gridfinity-basics-parts',
  kind: 'clip',
  async take(s) {
    await openBaseplate(s, SMALL_BED_DRAWER);
    await dragView(s, await grip(s), 0, -70);
    await s.ui.hideCursor();
    await s.take(frameAround(await partBox(s), 40, 4 / 3, await preview(s)), async () => {
      await s.ui.hold(2.2);
    });
    await openDesigner(s, 'Parts bin', { width: 2, depth: 1, height: 4 });
    await dragView(s, await grip(s), 0, -40);
    await s.ui.hideCursor();
    await s.take(frameAround(await partBox(s), 40, 4 / 3, await preview(s)), async () => {
      s.poster();
      await s.ui.hold(2.6);
    });
  },
};

const binAnatomy: Shot = {
  id: 'concepts-bin-anatomy-overview',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screws and nuts', {
      width: 2,
      depth: 2,
      height: 4,
      base: { style: 'magnet' },
      compartments: { cols: 2, rows: 1, cells: [0, 1], compartmentTexts: ['Screws', 'Nuts'] },
      label: { enabled: true },
      scoop: { enabled: true },
    });
    // From higher than the default angle, so the front wall does not hide the scoop.
    await dragView(s, await grip(s), 0, 70);
    const bin = await partBox(s);
    // Room above the back corner for the preview's height label.
    const labelled = { ...bin, y: bin.y - 50, height: bin.height + 50 };
    await s.still(frameAround(labelled, 30, 4 / 3, await preview(s)));
  },
};

/** Off camera: scrolls the panel that holds `target` so its top sits at `top` (CSS px). */
async function scrollTo(s: DocsSession, target: Locator, top: number): Promise<void> {
  await target.evaluate((el, y) => {
    let n = el.parentElement;
    while (
      n &&
      !(n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))
    )
      n = n.parentElement;
    if (n) n.scrollTop += el.getBoundingClientRect().top - y;
  }, top);
  await s.ui.warm(10);
}

const ORANGE = '#f97316';

const multiColorZones: Shot = {
  id: 'concepts-multi-color-zones',
  kind: 'still',
  // Tall enough for the whole zone list with its Color heading.
  viewport: { width: DESKTOP.width, height: 1000 },
  async take(s) {
    await openDesigner(s, 'Bolts', {
      width: 2,
      depth: 2,
      height: 4,
      compartments: { compartmentTexts: ['Bolts'] },
      label: { enabled: true },
      scoop: { enabled: true },
      featureColors: {
        enabled: true,
        labelTab: '#ffffff',
        text: '#1f2937',
        lip: { corners: 1, bands: 2, cells: { 'lip:frontLeft:1': ORANGE } },
      },
    });
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('binDesigner.colors.firstTimeHint.dismiss') })
    );
    const toggle = s.page.getByRole('switch', { name: label('binDesigner.group.colors') });
    // The Color heading above the switch clears the panel's sticky group header.
    await scrollTo(s, toggle, 195);
    const zones = union(
      await s.box(toggle),
      await s.box(
        s.page.getByRole('button', {
          name: new RegExp(`^${label('binDesigner.colors.text')}: #`),
        })
      )
    );
    const at = await grip(s);
    await wheelView(s, at, 3);
    const bin = await partBox(s);
    // Beside the zone list, so one crop holds both.
    await dragView(s, at, zones.x + zones.width + 70 - bin.x, 0, 'right');
    const placed = await partBox(s);
    const top = zones.y - 50;
    await s.still({
      x: 0,
      y: top,
      width: placed.x + placed.width + 40,
      height: zones.y + zones.height + 14 - top,
    });
  },
};

const exactShown = (s: DocsSession): Promise<boolean> =>
  s.page.evaluate(async () => {
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as DesignerStoreModule;
    const g = useDesignerStore.getState().generation;
    return g.status === 'complete' && !g.isDraft;
  });

/**
 * Holds each message to a worker for `window.__docsWorkerDelay` ms once a shot
 * sets it, in send order, as on a slower device.
 */
function slowWorkers(): void {
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]): void {
    const delay = (window as unknown as { __docsWorkerDelay?: number }).__docsWorkerDelay ?? 0;
    const send = (): void => (post as (...a: unknown[]) => void).apply(this, args);
    if (delay > 0) setTimeout(send, delay);
    else send();
  } as typeof post;
}

/** A height step in close-up, then the one-color draft that the exact model with its orange lip replaces. */
const previewDraftExact: Shot = {
  id: 'concepts-preview-draft-exact',
  kind: 'clip',
  async take(s) {
    await s.page.context().addInitScript(slowWorkers);
    await openDesigner(s, 'Screw bin', {
      width: 2,
      depth: 2,
      height: 3,
      featureColors: { enabled: true, lip: { cells: { 'lip:frontLeft:0': ORANGE } } },
    });
    const step = (dir: 'increaseAria' | 'decreaseAria'): Locator =>
      s.page
        .getByRole('button', { name: label(`common.${dir}`, { what: label('common.height') }) })
        .first();
    const taller = step('increaseAria');
    const stepper = union(await s.box(step('decreaseAria')), await s.box(taller));
    const closeUp = frameAround(stepper, 48, 4 / 3, WINDOW);
    const bin = await partBox(s);
    // Room above for the height unit the bin gains.
    const grown = { ...bin, y: bin.y - bin.height * 0.3, height: bin.height * 1.3 };
    const result = frameAround(grown, 40, 4 / 3, await preview(s));
    // On a fast machine the exact build lands within a frame or two of the edit;
    // held worker messages keep the draft on screen long enough to read.
    await s.page.evaluate(() => {
      (window as unknown as { __docsWorkerDelay: number }).__docsWorkerDelay = 2800;
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.8, closeUp.y + closeUp.height * 0.9);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        const b = await s.box(taller);
        await s.ui.clickAt(b.x + b.width / 2, b.y + b.height / 2);
        await s.ui.hold(0.3);
      },
      640 / closeUp.width
    );
    await s.ui.hideCursor();
    // Both themes must record as many frames, however long the build takes.
    const frames = 120;
    let shown = 0;
    await s.take(result, async () => {
      while (shown < frames - 30 && !(await exactShown(s))) {
        await s.ui.hold(1 / FPS);
        shown++;
      }
      if (!(await exactShown(s))) {
        throw new Error(
          'the exact model did not arrive within the clip; the poster would show the draft'
        );
      }
      // Past the fade-in of the exact model's edges.
      await s.ui.hold(10 / FPS);
      shown += 10;
    });
    await s.take(result, async () => {
      s.poster();
      await s.ui.hold((frames - shown) / FPS);
    });
  },
};

/**
 * Waits off camera for the split pieces, which build after the bin itself:
 * a quick draft first, then the exact pieces in their place.
 */
async function waitPieces(s: DocsSession): Promise<void> {
  for (let i = 0; ; i++) {
    const pieces = await s.page.evaluate(async () => {
      const { useDesignerStore } = (await import(
        '/src/features/bin-designer/store/designer.ts' as string
      )) as { useDesignerStore: { getState(): { ui: { splitPieceMeshes: unknown[] } } } };
      return useDesignerStore.getState().ui.splitPieceMeshes.length;
    });
    if (pieces > 0) break;
    if (i >= 300) throw new Error('the split pieces did not build within 45 s');
    await s.ui.warm(2);
    await s.page.waitForTimeout(150);
  }
  await s.page.waitForTimeout(3000);
  await s.ui.warm(30);
}

/** A drawer whose layout prints on a 180 mm bed, too small for a 6-unit bin. */
const SMALL_PRINTER: FixtureLayout = {
  name: 'Garage shelf',
  width: 8,
  depth: 4,
  height: 12,
  printBedSize: 180,
};

const printBedSplitBin: Shot = {
  id: 'concepts-print-bed-split-bin',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, SMALL_PRINTER);
    await openDesigner(s, 'Long tool tray', { width: 6, depth: 2, height: 3 });
    const assembled = s.page.getByRole('button', {
      name: label('binDesigner.splitAssembled'),
      exact: true,
    });
    const exploded = s.page.getByRole('button', {
      name: label('binDesigner.splitExploded'),
      exact: true,
    });
    await waitPieces(s);
    const apart = await partBox(s);
    await s.ui.preClick(assembled);
    await waitPieces(s);
    const bin = frameAround(union(apart, await partBox(s)), 40, 4 / 3, await preview(s));
    const toggle = union(await s.box(assembled), await s.box(exploded));
    const closeUp = frameAround(toggle, 40, 4 / 3, await preview(s));
    const b = await s.box(exploded);
    await s.ui.park(closeUp.x + closeUp.width * 0.7, closeUp.y + closeUp.height * 0.8);
    await s.take(bin, async () => {
      await s.ui.hold(0.8);
    });
    await s.take(closeUp, async () => {
      await s.ui.hold(0.3);
      await s.ui.clickAt(b.x + b.width / 2, b.y + b.height / 2);
      await s.ui.hold(0.2);
    });
    await s.ui.hideCursor();
    await s.take(bin, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

/** A desk drawer with one small bin on Layer 2 that rests on a bin of Layer 1. */
const RESTING: FixtureLayout = {
  name: 'Desk drawer',
  width: 6,
  depth: 4,
  height: 12,
  layers: [
    { name: 'Layer 1', height: 4 },
    { name: 'Layer 2', height: 3 },
  ],
  bins: [
    { x: 0, y: 0, w: 3, d: 2, h: 4, label: 'Chargers', cat: 'Sky' },
    { x: 3, y: 0, w: 3, d: 4, h: 4, label: 'Cables', cat: 'Green' },
    { x: 0, y: 0, w: 2, d: 2, h: 3, label: 'Batteries', cat: 'Coral', layer: 1 },
  ],
};

/** Three layers of desk supplies, each resting on the one below. */
const THREE_LAYERS: FixtureLayout = {
  name: 'Desk drawer',
  width: 6,
  depth: 4,
  height: 12,
  layers: [
    { name: 'Layer 1', height: 3 },
    { name: 'Layer 2', height: 2 },
    { name: 'Layer 3', height: 2 },
  ],
  bins: [
    { x: 0, y: 0, w: 3, d: 2, h: 3, label: 'Chargers', cat: 'Sky' },
    { x: 3, y: 0, w: 3, d: 2, h: 3, label: 'Cables', cat: 'Green' },
    { x: 0, y: 2, w: 6, d: 2, h: 3, label: 'Notebooks', cat: 'Cloud' },
    { x: 0, y: 0, w: 2, d: 2, h: 2, label: 'Pens', cat: 'Coral', layer: 1 },
    { x: 3, y: 0, w: 2, d: 1, h: 2, label: 'USB sticks', cat: 'Charcoal', layer: 1 },
    { x: 2, y: 2, w: 3, d: 2, h: 2, label: 'Sticky notes', cat: 'Green', layer: 1 },
    { x: 0, y: 0, w: 1, d: 1, h: 2, label: 'SD cards', cat: 'Coral', layer: 2 },
    { x: 3, y: 2, w: 2, d: 1, h: 2, label: 'Batteries', cat: 'Sky', layer: 2 },
  ],
};

/** A button of the layout 3D preview, which names its buttons by title only. */
const previewButton = (s: DocsSession, title: string): Locator =>
  s.page.locator(`button[title="${title}"]:visible`).first();

/** Off camera: makes `layer` active and opens the layout 3D preview with all layers. */
async function openLayerPreview(s: DocsSession, layer: string): Promise<void> {
  await s.ui.preClick(
    s.page.getByRole('button', { name: label('layers.selectLayer', { name: layer }) })
  );
  await s.ui.preClick(s.page.getByRole('button', { name: label('toolbar.show3dPreview') }).first());
  await s.until(s.page.locator('canvas').first());
  await s.page.waitForTimeout(1500);
  await s.ui.warm(30);
  await s.ui.preClick(previewButton(s, label('grid.allShowAllLayers')));
  await s.page.waitForTimeout(600);
  await s.ui.warm(30);
}

const layerStack: Shot = {
  id: 'concepts-layouts-layer-stack',
  kind: 'still',
  async take(s) {
    await openLayouts(s, RESTING);
    await openLayerPreview(s, 'Layer 2');
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('toolbar.fitGridToScreen') }).first()
    );
    await s.page.waitForTimeout(800);
    await s.ui.warm(30);
    const canvas = await preview(s);
    const at: [number, number] = [canvas.x + canvas.width / 2, canvas.y + canvas.height / 3];
    await wheelView(s, at, -4);
    await dragView(s, at, 0, -200, 'right');
    await s.dismissToasts();
    const chip = await s.box(s.page.getByRole('button', { name: /^Layer 2/ }).last());
    const cells = await gridArea(s, RESTING.width, RESTING.depth);
    await s.still(pad(union(chip, cells, { ...canvas, height: 390 }), 0, DESKTOP));
  },
};

/** Where the three layers sit once apart, after the camera moves in the clip below. */
const EXPLODED_SCENE = frameAround({ x: 360, y: 118, width: 585, height: 622 }, 30, 4 / 3, WINDOW);

const layersExploded: Shot = {
  id: 'concepts-layouts-exploded',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, THREE_LAYERS);
    await openLayerPreview(s, 'Layer 2');
    await s.ui.preClick(previewButton(s, label('grid.preview.expand')));
    await s.page.waitForTimeout(1500);
    await s.ui.warm(40);
    // The camera aims at the closed drawer; the exploded layers rise above it.
    await wheelView(s, [720, 300], 10);
    await dragView(s, [720, 300], 0, 100, 'right');
    await s.dismissToasts();
    const explode = await s.box(previewButton(s, label('grid.explodedView.toggle')));
    const focus = await s.box(previewButton(s, label('grid.focusShowOnlyActiveLayer')));
    // Clear of the window's bottom edge by the rounding of the take to the clip's aspect.
    const closeUp = frameAround(union(focus, explode), 24, 4 / 3, { ...WINDOW, height: 897 });
    await s.ui.park(closeUp.x + closeUp.width * 0.3, closeUp.y + closeUp.height * 0.3);
    await s.take(EXPLODED_SCENE, async () => {
      await s.ui.hold(0.8);
    });
    await s.take(closeUp, async () => {
      await s.ui.hold(0.3);
      await s.ui.clickAt(explode.x + explode.width / 2, explode.y + explode.height / 2);
    });
    await s.ui.hideCursor();
    await s.take(EXPLODED_SCENE, async () => {
      await s.ui.hold(0.6);
    });
    // A poster marks the start of the take it is called in, so the payoff gets its own take.
    await s.take(EXPLODED_SCENE, async () => {
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

/**
 * Off camera: saves a bin design to the library on the open page, its params
 * merged into the defaults, and returns its id.
 */
async function saveDesign(s: DocsSession, name: string, params: Params): Promise<string> {
  return s.page.evaluate(
    async ([n, p]) => {
      const { getDesignStorePort } = (await import(
        '/src/core/storage/designStorePort.ts' as string
      )) as {
        getDesignStorePort(): {
          saveDesign(input: object): Promise<{ ok: boolean; value?: { id: string } }>;
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
      const res = await port.saveDesign({
        name: n,
        params: deepMerge(DEFAULT_BIN_PARAMS, p),
        thumbnail: null,
        exportFileNameConfig: null,
      });
      if (!res.ok || !res.value) throw new Error(`could not save design ${n}`);
      return res.value.id;
    },
    [name, params] as const
  );
}

/** Three bins of one saved design, each printing its own Bin label on the shared tab. */
const LINKED_LABELS: FixtureLayout = {
  name: 'Fastener drawer',
  width: 6,
  depth: 2,
  height: 6,
  categories: [{ name: 'Fasteners', color: '#38bdf8' }],
  bins: [
    { x: 0, y: 0, w: 2, d: 1, h: 3, label: 'Screws' },
    { x: 2, y: 0, w: 2, d: 1, h: 3, label: 'Nuts' },
    { x: 4, y: 0, w: 2, d: 1, h: 3, label: 'Washers' },
  ],
};

const savedDesignsLayoutLabels: Shot = {
  id: 'concepts-saved-designs-layout-labels',
  kind: 'still',
  async take(s) {
    await s.open('/', grid);
    const design = await saveDesign(s, 'Small parts bin', {
      width: 2,
      depth: 1,
      height: 3,
      label: { enabled: true },
      // Raised letters cast a shadow, so the labels read at the layout preview's scale.
      textDefaults: { mode: 'emboss', depth: 0.8 },
    });
    const file = layoutFile(LINKED_LABELS) as { bins: object[] };
    await s.importLayouts(
      [{ ...file, bins: file.bins.map((b) => ({ ...b, linkedDesignId: design })) }],
      grid
    );
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('toolbar.show3dPreview') }).first()
    );
    await s.until(s.page.locator('canvas').first());
    await s.page.waitForTimeout(3000);
    await s.ui.warm(60);
    await s.ui.preClick(previewButton(s, label('grid.preview.expand')));
    await s.page.waitForTimeout(1500);
    await s.ui.warm(60);
    await s.dismissToasts();
    // From higher than the default angle, to read the labels on the flat tabs.
    await dragView(s, [1200, 300], 0, 50);
    // Between the preview's view buttons and its shortcut strip, which sit over the scene.
    const views = await s.box(previewButton(s, label('grid.frontView')));
    const strip = s.page
      .locator('span', { hasText: label('grid.toggle') })
      .filter({ has: s.page.locator('kbd') })
      .first();
    const band = { top: views.y + views.height + 12, bottom: (await s.box(strip)).y - 12 };
    const bins = await partBox(s);
    const dy = (band.top + band.bottom) / 2 - (bins.y + bins.height / 2);
    await dragView(s, [1200, 300], 0, dy, 'right');
    const placed = await partBox(s);
    await s.still({
      x: placed.x - 16,
      y: band.top,
      width: placed.width + 32,
      height: band.bottom - band.top,
    });
  },
};

const unitsPhysicalUnits: Shot = {
  id: 'concepts-units-physical-units',
  kind: 'still',
  async take(s) {
    await openLayouts(s, WORKBENCH);
    const head = s.page.getByRole('button', { name: label('common.physicalUnits') }).first();
    await s.ui.preReveal(head);
    const top = await s.box(head);
    const solver = await s.box(
      s.page.getByRole('button', { name: label('stackSolver.title') }).first()
    );
    await s.still(
      {
        x: top.x,
        y: top.y,
        width: top.width,
        height: solver.y + solver.height + 14 - top.y,
      },
      1.5
    );
  },
};

export const CONCEPTS: readonly Shot[] = [
  basicsParts,
  binAnatomy,
  multiColorZones,
  previewDraftExact,
  printBedSplitBin,
  layerStack,
  layersExploded,
  savedDesignsLayoutLabels,
  unitsPhysicalUnits,
];
