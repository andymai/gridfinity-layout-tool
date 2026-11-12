import type { Locator } from '@playwright/test';
import { layoutFile, WORKBENCH, WORKSHOP_CATEGORIES } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import type { DesignerStoreModule } from '../../feature-tips/appModules';
import { FPS } from '../../feature-tips/encode';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { openBaseplate, openDesigner, partBox, waitBaseplate } from './apps';
import type { Params } from './apps';
import { cellCenter, grid, gridArea, openLayouts } from './layoutEditor';

const WINDOW: Rect = { x: 0, y: 0, ...DESKTOP };

const preview = (s: DocsSession): Promise<Rect> => s.box(s.page.locator('canvas').first());

/** The left button turns the view (drag up to look from lower), and the right button pans it. */
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

/** A positive `notches` zooms out. */
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

/** A point clear of the part, to grab the view by. */
async function grip(s: DocsSession): Promise<[number, number]> {
  const c = await preview(s);
  return [c.x + c.width * 0.75, c.y + c.height * 0.5];
}

/** The 100 mm bed makes the baseplate print in pieces. */
const SMALL_BED_DRAWER: FixtureLayout = {
  name: 'Workbench',
  width: 4,
  depth: 3,
  height: 6,
  printBedSize: 100,
};

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

function slowWorkers(): void {
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]): void {
    const delay = (window as unknown as { __docsWorkerDelay?: number }).__docsWorkerDelay ?? 0;
    const send = (): void => (post as (...a: unknown[]) => void).apply(this, args);
    if (delay > 0) setTimeout(send, delay);
    else send();
  } as typeof post;
}

/** The orange lip shows when the exact model replaces the one-color draft. */
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

/** The pieces build after the bin: a quick draft first, then the exact pieces in its place. */
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

/** A 180 mm bed is too small for a 6-unit bin. */
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

/** The layout 3D preview names its buttons by title only. */
const previewButton = (s: DocsSession, title: string): Locator =>
  s.page.locator(`button[title="${title}"]:visible`).first();

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

/** Each bin prints its own Bin label on the shared tab of the design. */
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

async function editorArea(s: DocsSession): Promise<Rect> {
  const left = await s.box(s.page.locator('aside').first());
  const right = await s.box(s.page.locator('aside').last());
  const fit = await s.box(
    s.page.getByRole('button', { name: label('toolbar.fitGridToScreen') }).first()
  );
  const x = left.x + left.width;
  const y = fit.y + fit.height + 6;
  const bottom = s.page.viewportSize()?.height ?? DESKTOP.height;
  return { x, y, width: right.x - x, height: bottom - y };
}

const stepper = (s: DocsSession, dir: 'increaseAria' | 'decreaseAria', what: string): Locator =>
  s.page.getByRole('button', { name: label(`common.${dir}`, { what }) }).first();

/** Off camera, so a small drawer reads at the docs' width. */
async function zoomGrid(s: DocsSession, f: FixtureLayout, share: number): Promise<void> {
  const zoomIn = s.page.getByRole('button', { name: label('toolbar.zoomIn') }).first();
  const target = (await editorArea(s)).width * share;
  for (let i = 0; i < 20 && (await gridArea(s, f.width, f.depth)).width < target; i++) {
    await s.ui.preClick(zoomIn);
    // The zoom animates: measure only once it has settled, or a theme can take an extra step.
    await s.page.waitForTimeout(200);
    await s.ui.warm(60);
  }
  await s.page.waitForTimeout(500);
  await s.ui.warm(30);
}

const unitsUnlinkPitch: Shot = {
  id: 'concepts-units-unlink-pitch',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, WORKBENCH);
    const chain = s.page.getByRole('button', { name: label('gridUnitInput.unlinkAriaLabel') });
    await s.ui.preReveal(chain);
    const cells = await gridArea(s, WORKBENCH.width, WORKBENCH.depth);
    // A 48 mm Y pitch makes each row 48 / 42 as tall; the grid keeps its top edge.
    const grown = { ...cells, height: cells.height * (48 / 42) };
    const scene = frameAround(grown, 20, 5 / 4, await editorArea(s));
    const summary = s.page.getByText(label('drawerDims.gridSize', { width: 378, depth: 294 }), {
      exact: true,
    });
    const heightUnit = await s.box(
      s.page
        .locator('aside')
        .first()
        .getByText(label('sidebar.heightUnit'), { exact: true })
        .first()
    );
    const closeUp = frameAround(
      union(await s.box(summary), { ...heightUnit, x: 16, width: 255 }),
      14,
      5 / 4,
      WINDOW
    );
    await s.ui.hideCursor();
    await s.take(scene, async () => {
      await s.ui.hold(1);
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.15);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(chain);
      await s.ui.hold(0.4);
      await s.ui.click(s.page.getByLabel(label('gridUnitInput.yAriaLabel'), { exact: true }));
      await s.page.keyboard.press('ControlOrMeta+a');
      await s.type('48');
      await s.page.keyboard.press('Enter');
      await s.ui.hold(1.2);
    });
    await s.ui.hideCursor();
    await s.take(scene, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

/** Columns 5 and 6 stay empty, for a bin drawn on camera. */
const HALF_DRAWER: FixtureLayout = {
  name: 'Desk drawer',
  width: 6,
  depth: 4,
  height: 8,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 3, label: 'Pens', cat: 'Sky' },
    { x: 2, y: 0, w: 2, d: 2, h: 3, label: 'Sticky notes', cat: 'Green' },
    { x: 0, y: 2, w: 2, d: 2, h: 3, label: 'Erasers', cat: 'Coral' },
  ],
};

const unitsHalfGrid: Shot = {
  id: 'concepts-units-half-grid',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, HALF_DRAWER);
    const toggle = s.page.getByRole('switch', { name: label('sidebar.toggleHalfBinMode') });
    await s.ui.preReveal(toggle);
    // Down from the size fields' labels, so the group header above stays out of the frame.
    const fields = await s.box(stepper(s, 'decreaseAria', label('sidebar.drawerWidthAria')));
    const closeUp = { x: 0, y: fields.y - 36, width: 300, height: 225 };
    const result = frameAround(
      await gridArea(s, HALF_DRAWER.width, HALF_DRAWER.depth),
      24,
      4 / 3,
      await editorArea(s)
    );
    const [c5, r1] = await cellCenter(s, 5, 1);
    const [c6] = await cellCenter(s, 6, 1);
    const size = c6 - c5;
    // Grid units to screen, x from the left and y from the front. Each point sits
    // inside a half cell, clear of its edges, so the draw covers x 4 to 5.5, y 0 to 2.
    const at = (gx: number, gy: number): [number, number] => [
      c5 + (gx - 4.5) * size,
      r1 - (gy - 0.5) * size,
    ];
    await s.ui.hideCursor();
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.5);
        await s.keys('h', 'H');
        await s.ui.hold(0.8);
      },
      result.width / closeUp.width
    );
    await s.ui.park(result.x + result.width * 0.85, result.y + result.height * 0.85);
    await s.take(result, async () => {
      await s.ui.hold(0.4);
      await s.ui.drag(at(4.15, 1.65), at(5.15, 0.15), 18);
      await s.ui.hold(0.2);
      await s.ui.moveTo(result.x + result.width * 0.9, result.y + result.height * 0.9);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const MEASURED: FixtureLayout = {
  ...WORKBENCH,
  measuredMm: { width: 400, depth: 310, height: 80 },
};

const unitsStackSolver: Shot = {
  id: 'concepts-units-stack-solver',
  kind: 'still',
  async take(s) {
    await openLayouts(s, MEASURED);
    const solver = s.page.getByRole('button', { name: label('stackSolver.title') }).first();
    await s.ui.preClick(solver);
    await s.ui.warm(20);
    const head = s.page.getByRole('button', { name: label('common.physicalUnits') }).first();
    await s.ui.preReveal(solver);
    const top = await s.box(head);
    const rows = await s.page
      .locator('aside')
      .first()
      .getByText(/spare|Nothing fits/)
      .evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
    await s.still({ x: top.x, y: top.y, width: top.width, height: rows + 16 - top.y }, 1.5);
  },
};

/** The Screwdrivers bin keeps room above it for the handles that stand out of it. */
const CLEARANCE: FixtureLayout = {
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  height: 16,
  categories: WORKSHOP_CATEGORIES,
  layers: [
    { name: 'Layer 1', height: 4 },
    { name: 'Layer 2', height: 3 },
  ],
  bins: [
    { x: 0, y: 0, w: 3, d: 4, h: 4, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 3, y: 0, w: 3, d: 4, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 3, y: 0, w: 2, d: 2, h: 3, label: 'Bits', cat: 'Bits', layer: 1 },
  ],
};

const layoutsClearance: Shot = {
  id: 'concepts-layouts-clearance',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, CLEARANCE);
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('layers.selectLayer', { name: 'Layer 1' }) })
    );
    const bin = await s.box(s.page.locator('[data-bin-id]', { hasText: 'Screwdrivers' }).first());
    await s.page.mouse.click(bin.x + bin.width / 2, bin.y + bin.height / 2);
    await s.ui.warm(20);
    await s.dismissToasts();
    const more = stepper(s, 'increaseAria', label('inspector.single.clearanceAria'));
    await s.ui.preReveal(more);
    const panel = await s.box(s.page.locator('aside').last());
    const lock = await s.box(s.page.getByRole('button', { name: label('inspector.lockSize') }));
    // A wide frame, so it ends above the print bed check under the steppers, which is not part of this step.
    const aspect = 1.6;
    const width = panel.width - 16;
    const fieldUp = { x: panel.x + 8, y: lock.y - 10, width, height: width / aspect };
    const layer2 = s.page.getByRole('button', {
      name: label('layers.selectLayer', { name: 'Layer 2' }),
    });
    const layersHead = await s.box(
      s.page.getByRole('button', { name: label('common.layers'), exact: true })
    );
    const sidebar = await s.box(s.page.locator('aside').first());
    const layers = {
      x: sidebar.x,
      y: layersHead.y - 8,
      width: sidebar.width,
      height: sidebar.width / aspect,
    };
    const cells = frameAround(
      await gridArea(s, CLEARANCE.width, CLEARANCE.depth),
      24,
      aspect,
      await editorArea(s)
    );
    await s.ui.park(fieldUp.x + fieldUp.width * 0.3, fieldUp.y + fieldUp.height * 0.9);
    await s.take(
      fieldUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(more);
        await s.ui.hold(0.3);
        await s.ui.click(more);
        await s.ui.hold(0.7);
      },
      cells.width / fieldUp.width
    );
    await s.ui.park(layers.x + layers.width * 0.45, layers.y + layers.height * 0.93);
    await s.take(layers, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(layer2);
      await s.ui.hold(0.3);
    });
    await s.ui.hideCursor();
    await s.take(cells, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

/** Short enough that the stash under the grid sits close to it, so one frame holds both. */
const SHORT = { width: DESKTOP.width, height: 720 };

async function gridAndStash(s: DocsSession, f: FixtureLayout): Promise<Rect> {
  const area = await editorArea(s);
  const cells = await gridArea(s, f.width, f.depth);
  return { x: cells.x - 16, y: area.y, width: cells.width + 32, height: area.height };
}

/** Columns 6 and 7 hold the bins that a narrower drawer sends to the stash. */
const SHRINK: FixtureLayout = {
  name: 'Desk drawer',
  width: 7,
  depth: 3,
  height: 8,
  bins: [
    { x: 0, y: 0, w: 2, d: 3, h: 3, label: 'Notebooks', cat: 'Cloud' },
    { x: 2, y: 0, w: 3, d: 2, h: 3, label: 'Pens', cat: 'Sky' },
    { x: 2, y: 2, w: 3, d: 1, h: 3, label: 'Rulers', cat: 'Green' },
    { x: 5, y: 0, w: 2, d: 1, h: 3, label: 'USB sticks', cat: 'Coral' },
    { x: 5, y: 1, w: 2, d: 2, h: 3, label: 'Chargers', cat: 'Charcoal' },
  ],
};

const layoutsSmallerDrawer: Shot = {
  id: 'concepts-layouts-smaller-drawer',
  kind: 'clip',
  viewport: SHORT,
  async take(s) {
    await openLayouts(s, SHRINK);
    await zoomGrid(s, SHRINK, 0.8);
    const narrower = stepper(s, 'decreaseAria', label('sidebar.drawerWidthAria'));
    await s.ui.preReveal(narrower);
    const scene = await gridAndStash(s, SHRINK);
    const head = await s.box(
      s.page.getByRole('button', { name: new RegExp(`^${label('sidebar.gridSize')}`) }).first()
    );
    // Down from the group's header, so the card above it stays out of the frame.
    const closeUp = { x: 0, y: head.y - 6, width: 300, height: 300 / (scene.width / scene.height) };
    await s.ui.hideCursor();
    await s.take(scene, async () => {
      await s.ui.hold(1);
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.1);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(narrower);
      await s.ui.hold(0.3);
      await s.ui.click(narrower);
      await s.ui.hold(0.5);
    });
    await s.ui.hideCursor();
    await s.take(scene, async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const STASHED: FixtureLayout = {
  name: 'Desk drawer',
  width: 6,
  depth: 3,
  height: 8,
  bins: [
    { x: 0, y: 0, w: 2, d: 3, h: 3, label: 'Notebooks', cat: 'Cloud' },
    { x: 2, y: 0, w: 2, d: 3, h: 3, label: 'Pens', cat: 'Sky' },
  ],
  stash: [
    { x: 0, y: 0, w: 2, d: 1, h: 3, label: 'USB sticks', cat: 'Coral' },
    { x: 0, y: 0, w: 1, d: 1, h: 3, label: 'SD cards', cat: 'Green' },
  ],
};

const layoutsStashPlace: Shot = {
  id: 'concepts-layouts-stash-place',
  kind: 'clip',
  viewport: SHORT,
  async take(s) {
    await openLayouts(s, STASHED);
    await zoomGrid(s, STASHED, 0.8);
    const scene = await gridAndStash(s, STASHED);
    const stashed = s.page.locator('[title*="USB sticks"]').first();
    const b = await s.box(stashed);
    const [cx, cy] = await cellCenter(s, 5, 2);
    // Cursor moves take as many frames as their length: offsets from the targets keep
    // them the same in both themes, which a clip needs.
    await s.ui.park(b.x + b.width / 2 + 160, b.y - 100);
    await s.take(scene, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(b.x + b.width / 2, b.y + b.height / 2);
      await s.ui.hold(0.3);
      await s.keys('r', 'R');
      await s.ui.hold(0.4);
      const turned = await s.box(stashed);
      await s.ui.drag([turned.x + turned.width / 2, turned.y + turned.height / 2], [cx, cy], 20);
      await s.ui.hold(0.2);
      await s.ui.moveTo(cx + 180, cy + 120);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

async function panelCrop(s: DocsSession, top: Locator, bottom: Locator): Promise<Rect> {
  const panel = await s.box(s.page.locator('aside').first());
  const a = await s.box(top);
  const b = await s.box(bottom);
  return { x: panel.x, y: a.y - 8, width: panel.width, height: b.y + b.height + 8 - (a.y - 8) };
}

const groupHeader = (s: DocsSession, title: string): Locator =>
  s.page.getByRole('button', { name: new RegExp(`^${title}`) }).first();

const binAnatomyFeet: Shot = {
  id: 'concepts-bin-anatomy-feet',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screw bin', {
      width: 2,
      depth: 1,
      height: 3,
      base: { style: 'magnet' },
    });
    // Drag up to swing the camera under the floor and look up at the feet.
    await dragView(s, await grip(s), 0, -260);
    const bin = await partBox(s);
    await s.still(frameAround(bin, 24, 4 / 3, await preview(s)));
  },
};

const binAnatomyStackingLip: Shot = {
  id: 'concepts-bin-anatomy-stacking-lip',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Parts bin', {
      width: 2,
      depth: 1,
      height: 4,
      base: { stackingLip: false },
    });
    const lip = s.page.getByRole('switch', { name: label('assembledHeight.stackingLip') });
    await s.ui.preReveal(lip);
    const bin = await partBox(s);
    // Room above for the lip that the bin gains.
    const grown = { ...bin, y: bin.y - bin.height * 0.2, height: bin.height * 1.2 };
    const result = frameAround(grown, 40, 4 / 3, await preview(s));
    const closeUp = frameAround(
      union(
        await s.box(
          s.page.getByText(label('binDesigner.base.section.stacking'), { exact: true }).first()
        ),
        await s.box(lip)
      ),
      30,
      4 / 3,
      WINDOW
    );
    await s.ui.hideCursor();
    await s.take(result, async () => {
      await s.ui.hold(1);
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.5, closeUp.y + closeUp.height * 0.9);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(lip);
      await s.ui.hold(0.4);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.take(result, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const binAnatomyLidNeedsLip: Shot = {
  id: 'concepts-bin-anatomy-lid-needs-lip',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Parts bin', {
      width: 2,
      depth: 1,
      height: 4,
      base: { stackingLip: false },
    });
    const enable = s.page.getByRole('button', {
      name: label('binDesigner.dependency.enableStackingLip'),
    });
    await s.ui.preReveal(enable);
    await s.ui.hideCursor();
    await s.still(await panelCrop(s, groupHeader(s, label('binDesigner.group.lid')), enable), 1.5);
  },
};

const binAnatomyInteriorStyles: Shot = {
  id: 'concepts-bin-anatomy-interior-styles',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Parts bin', { width: 2, depth: 2, height: 4 });
    const last = s.page.getByRole('radio', { name: label('binDesigner.interior.solid.title') });
    await s.ui.preReveal(last);
    await s.ui.hideCursor();
    await s.still(
      await panelCrop(s, groupHeader(s, label('binDesigner.group.interior')), last),
      1.5
    );
  },
};

/** One saved design beside plain bins, for the layout preview to tell apart. */
const MIXED: FixtureLayout = {
  name: 'Workbench',
  width: 6,
  depth: 3,
  height: 8,
  categories: WORKSHOP_CATEGORIES,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 3, label: 'Small parts', cat: 'Fasteners' },
    { x: 2, y: 0, w: 2, d: 2, h: 3, label: 'Hex keys', cat: 'Hand tools' },
    { x: 4, y: 0, w: 2, d: 3, h: 3, label: 'Wire nuts', cat: 'Electrical' },
    { x: 0, y: 2, w: 4, d: 1, h: 3, label: 'Drill bits', cat: 'Bits' },
  ],
};

async function openLayoutPreview(s: DocsSession): Promise<void> {
  await s.ui.preClick(s.page.getByRole('button', { name: label('toolbar.show3dPreview') }).first());
  await s.until(s.page.locator('canvas').first());
  await s.page.waitForTimeout(3000);
  await s.ui.warm(60);
  await s.ui.preClick(previewButton(s, label('grid.preview.expand')));
  await s.page.waitForTimeout(1500);
  await s.ui.warm(60);
  await s.dismissToasts();
}

const previewLayoutModels: Shot = {
  id: 'concepts-preview-layout-models',
  kind: 'still',
  async take(s) {
    await s.open('/', grid);
    const design = await saveDesign(s, 'Small parts bin', {
      width: 2,
      depth: 2,
      height: 3,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3] },
      label: { enabled: true },
      scoop: { enabled: true },
    });
    const file = layoutFile(MIXED) as { bins: { label: string }[] };
    await s.importLayouts(
      [
        {
          ...file,
          bins: file.bins.map((b) =>
            b.label === 'Small parts' ? { ...b, linkedDesignId: design } : b
          ),
        },
      ],
      grid
    );
    await openLayoutPreview(s);
    await dragView(s, [1200, 300], 0, 40);
    await wheelView(s, [720, 450], 3);
    // Between the preview's view buttons and its shortcut strip, which sit over the scene.
    const views = await s.box(previewButton(s, label('grid.frontView')));
    const strip = s.page
      .locator('span', { hasText: label('grid.toggle') })
      .filter({ has: s.page.locator('kbd') })
      .first();
    const top = views.y + views.height + 12;
    const height = (await s.box(strip)).y - 12 - top;
    const canvas = await preview(s);
    const width = height * (4 / 3);
    await s.still({ x: canvas.x + canvas.width / 2 - width / 2, y: top, width, height });
  },
};

const savedDesignsLinkInspector: Shot = {
  id: 'concepts-saved-designs-link-inspector',
  kind: 'still',
  async take(s) {
    await openLayouts(s, WORKBENCH);
    const bin = await s.box(s.page.locator('[data-bin-id]', { hasText: 'Washers' }).first());
    await s.page.mouse.click(bin.x + bin.width / 2, bin.y + bin.height / 2);
    await s.ui.warm(20);
    await s.dismissToasts();
    const inspector = s.page.locator('aside').last();
    const heading = inspector
      .getByText(label('designLinking.inspector.linkedDesign'), { exact: true })
      .first();
    // Cards above the section load late and push it down; measure once it stops moving.
    let top = await s.box(heading);
    for (let i = 0; i < 20; i++) {
      await s.ui.preReveal(heading);
      await s.page.waitForTimeout(500);
      await s.ui.warm(20);
      const now = await s.box(heading);
      if (Math.abs(now.y - top.y) < 0.5 && i > 1) break;
      top = now;
    }
    const link = inspector.getByRole('button', {
      name: label('designLinking.inspector.linkExisting'),
      exact: true,
    });
    const panel = await s.box(inspector);
    const b = union(await s.box(link), top);
    await s.ui.hideCursor();
    await s.still(
      { x: panel.x, y: top.y - 14, width: panel.width, height: b.y + b.height + 14 - (top.y - 14) },
      1.5
    );
  },
};

/** Three bins linked to one 2 x 1 design, with a free row behind them to grow into. */
const LINKED_ROW: FixtureLayout = {
  name: 'Fastener drawer',
  width: 6,
  depth: 3,
  height: 6,
  categories: [{ name: 'Fasteners', color: '#38bdf8' }],
  bins: [
    { x: 0, y: 0, w: 2, d: 1, h: 3, label: 'Screws' },
    { x: 2, y: 0, w: 2, d: 1, h: 3, label: 'Nuts' },
    { x: 4, y: 0, w: 2, d: 1, h: 3, label: 'Washers' },
  ],
};

const savedDesignsSizeSync: Shot = {
  id: 'concepts-saved-designs-size-sync',
  kind: 'clip',
  async take(s) {
    await s.open('/', grid);
    const design = await saveDesign(s, 'Small parts bin', { width: 2, depth: 1, height: 3 });
    const file = layoutFile(LINKED_ROW) as { bins: object[] };
    await s.importLayouts(
      [{ ...file, bins: file.bins.map((b) => ({ ...b, linkedDesignId: design })) }],
      grid
    );
    const bin = await s.box(s.page.locator('[data-bin-id]', { hasText: 'Screws' }).first());
    await s.page.mouse.click(bin.x + bin.width / 2, bin.y + bin.height / 2);
    await s.ui.warm(20);
    await s.dismissToasts();
    const inspector = s.page.locator('aside').last();
    const deeper = inspector
      .getByRole('button', { name: label('common.increaseAria', { what: label('common.depth') }) })
      .first();
    await s.ui.preReveal(deeper);
    const scene = frameAround(
      await gridArea(s, LINKED_ROW.width, LINKED_ROW.depth),
      24,
      4 / 3,
      await editorArea(s)
    );
    const closeUp = frameAround(
      union(
        await s.box(deeper),
        await s.box(
          inspector
            .getByRole('button', {
              name: label('common.decreaseAria', { what: label('common.width') }),
            })
            .first()
        )
      ),
      40,
      4 / 3,
      WINDOW
    );
    await s.ui.hideCursor();
    await s.take(scene, async () => {
      await s.ui.hold(1);
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.04, closeUp.y + closeUp.height * 0.62);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(deeper);
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await s.take(scene, async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

/** A 6-unit bin is longer than a 180 mm bed. */
const OVERSIZED: FixtureLayout = {
  name: 'Garage shelf',
  width: 6,
  depth: 3,
  height: 12,
  printBedSize: 180,
  categories: WORKSHOP_CATEGORIES,
  bins: [
    { x: 0, y: 0, w: 6, d: 1, h: 3, label: 'Long tool tray', cat: 'Hand tools' },
    { x: 0, y: 1, w: 2, d: 2, h: 3, label: 'Tape', cat: 'Spares' },
    { x: 2, y: 1, w: 2, d: 2, h: 3, label: 'Pliers', cat: 'Hand tools' },
  ],
};

const printBedLayoutSplit: Shot = {
  id: 'concepts-print-bed-layout-split',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, OVERSIZED);
    const bin = await s.box(s.page.locator('[data-bin-id]', { hasText: 'Long tool tray' }).first());
    const scene = frameAround(
      await gridArea(s, OVERSIZED.width, OVERSIZED.depth),
      24,
      4 / 3,
      await editorArea(s)
    );
    await s.ui.park(scene.x + scene.width * 0.8, scene.y + scene.height * 0.15);
    await s.take(scene, async () => {
      await s.ui.hold(0.6);
      await s.ui.clickAt(bin.x + bin.width * 0.3, bin.y + bin.height / 2);
      await s.ui.hold(0.6);
    });
    await s.dismissToasts();
    const title = s.page.getByText(label('inspector.split.title'), { exact: true }).first();
    await s.ui.preReveal(title);
    const panel = await s.box(s.page.locator('aside').last());
    const card = union(
      await s.box(title),
      await s.box(s.page.getByText(/so it prints in pieces/).first()),
      { ...(await s.box(title)), x: panel.x + 16, width: panel.width - 32 }
    );
    await s.ui.hideCursor();
    await s.take(frameAround(card, 20, 4 / 3, WINDOW), async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const printBedDiagonal: Shot = {
  id: 'concepts-print-bed-diagonal',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Ruler tray', { width: 1, depth: 7, height: 3 });
    await s.ui.preClick(s.page.getByRole('button', { name: label('binDesigner.exportBinAsStl') }));
    const dialog = s.page.getByRole('dialog');
    await s.until(dialog);
    const box = await s.box(dialog);
    const checkbox = await s.box(
      dialog.getByText(label('binDesigner.splitExport.enableSplit'), { exact: true }).first()
    );
    await s.ui.hideCursor();
    await s.still(
      { x: box.x, y: box.y, width: box.width, height: checkbox.y + checkbox.height + 22 - box.y },
      1.25
    );
  },
};

const multiColorExport: Shot = {
  id: 'concepts-multi-color-export',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Bolts', {
      width: 2,
      depth: 2,
      height: 4,
      compartments: { compartmentTexts: ['Bolts'] },
      label: { enabled: true },
      featureColors: {
        enabled: true,
        labelTab: '#ffffff',
        text: '#1f2937',
        lip: { cells: { 'lip:frontLeft:0': ORANGE } },
      },
    });
    await s.ui.preClick(s.page.getByRole('button', { name: label('binDesigner.exportBinAsStl') }));
    const dialog = s.page.getByRole('dialog');
    await s.until(dialog);
    await s.ui.preClick(
      dialog.getByRole('button', { name: label('binDesigner.colors.slicerHandoff.show') })
    );
    const box = await s.box(dialog);
    const last = await s.box(
      dialog.getByText(label('binDesigner.colors.slicerHandoff.filament', { n: 4 }), {
        exact: true,
      })
    );
    await s.ui.hideCursor();
    await s.still(
      { x: box.x, y: box.y, width: box.width, height: last.y + last.height + 30 - box.y },
      1.25
    );
  },
};

const basicsMagnetHoles: Shot = {
  id: 'introduction-gridfinity-basics-magnet-holes',
  kind: 'clip',
  async take(s) {
    await openBaseplate(s, { name: 'Workbench', width: 3, depth: 2, height: 6 });
    // From higher than the default angle, to look down into the pockets.
    await dragView(s, await grip(s), 0, 60);
    const plate = await partBox(s);
    const result = frameAround(plate, 40, 4 / 3, await preview(s));
    const magnets = s.page.getByRole('switch', { name: label('baseplate.magnetHoles') }).first();
    await s.ui.preReveal(magnets);
    const row = await s.box(
      s.page.getByText(label('baseplate.magnetHoles'), { exact: true }).first()
    );
    const closeUp = frameAround(union(row, await s.box(magnets)), 40, 4 / 3, WINDOW);
    await s.ui.hideCursor();
    await s.take(result, async () => {
      await s.ui.hold(1);
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.5, closeUp.y + closeUp.height * 0.92);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(magnets);
      await s.ui.hold(0.4);
    });
    await s.ui.hideCursor();
    await waitBaseplate(s);
    await s.take(result, async () => {
      s.poster();
      await s.ui.hold(2);
    });
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
  unitsUnlinkPitch,
  unitsHalfGrid,
  unitsStackSolver,
  layoutsClearance,
  layoutsSmallerDrawer,
  layoutsStashPlace,
  binAnatomyFeet,
  binAnatomyStackingLip,
  binAnatomyLidNeedsLip,
  binAnatomyInteriorStyles,
  previewLayoutModels,
  savedDesignsLinkInspector,
  savedDesignsSizeSync,
  printBedLayoutSplit,
  printBedDiagonal,
  multiColorExport,
  basicsMagnetHoles,
];
