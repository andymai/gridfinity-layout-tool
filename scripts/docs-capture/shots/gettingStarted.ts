import type { Locator } from '@playwright/test';
import { WORKBENCH } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { designerReady, openBaseplate, openDesigner, partBox, waitBaseplate } from './apps';
import { cellCenter, grid, gridArea, openLayouts } from './layoutEditor';

const WINDOW: Rect = { x: 0, y: 0, ...DESKTOP };
/** Below the app header. */
const WORKSPACE: Rect = { x: 0, y: 48, width: DESKTOP.width, height: DESKTOP.height - 48 };

/** The layout the first-drawer tutorial starts from: an empty 9 x 7 grid. */
const EMPTY: FixtureLayout = { name: 'My first drawer', width: 9, depth: 7, height: 12 };

/** Six bins in three sizes, as the tutorial has after step 4. */
const FIRST_DRAWER: FixtureLayout = {
  ...EMPTY,
  bins: [
    { x: 0, y: 0, w: 2, d: 3, h: 6, label: 'Hex keys', cat: 'Sky' },
    { x: 2, y: 0, w: 1, d: 1, h: 3, label: 'M3' },
    { x: 3, y: 0, w: 1, d: 1, h: 3, label: 'M4' },
    { x: 4, y: 0, w: 1, d: 1, h: 3, label: 'M5' },
    { x: 2, y: 1, w: 3, d: 2, h: 6, label: 'Washers', cat: 'Green' },
    { x: 5, y: 0, w: 3, d: 2, h: 6, label: 'Drill bits', cat: 'Green' },
  ],
};

/** A side panel's collapsible group header, scrolled into view off camera. */
async function groupHeader(s: DocsSession, title: string): Promise<Locator> {
  const h = s.page.getByRole('button', { name: new RegExp(`^${title}`) }).first();
  await s.ui.preReveal(h);
  return h;
}

const toolSwitcher: Shot = {
  id: 'introduction-what-it-does-tool-switcher',
  kind: 'still',
  async take(s) {
    await openLayouts(s, WORKBENCH);
    const tools = await s.box(
      s.page.getByRole('navigation', { name: label('toolSwitcher.toolSwitcher') })
    );
    const name = await s.box(
      s.page.getByRole('button', { name: label('header.switchLayout', { name: WORKBENCH.name }) })
    );
    await s.still(pad(union(tools, name), 10, DESKTOP));
  },
};

const measuredSize: Shot = {
  id: 'getting-started-first-drawer-measured-size',
  kind: 'clip',
  async take(s) {
    // A first visit's grid, before the tutorial fits it to the drawer.
    await openLayouts(s, { ...EMPTY, width: 10, depth: 8 });
    const head = await s.box(await groupHeader(s, label('sidebar.gridSize')));
    const add = s.page.getByRole('button', { name: label('drawerDims.addMeasured') });
    const area: Rect = { x: 0, y: head.y - 4, width: head.width, height: 300 };
    await s.ui.park(area.x + area.width * 0.8, area.y + area.height * 0.9);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(add);
        await s.ui.hold(0.3);
        await s.type('400');
        await s.keys('Tab');
        await s.type('300');
        await s.keys('Tab');
        await s.type('80');
        await s.keys('Enter');
        s.poster();
        await s.ui.hold(1.4);
        await s.ui.click(
          s.page.getByRole('button', { name: label('drawerDims.suggestionUse'), exact: true })
        );
        await s.ui.hold(1.6);
      },
      1.6
    );
  },
};

const drawBin: Shot = {
  id: 'getting-started-first-drawer-draw-bin',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, EMPTY);
    const from = await cellCenter(s, 1, 1);
    const to = await cellCenter(s, 2, 3);
    const area = pad(await gridArea(s, EMPTY.width, EMPTY.depth), 6, DESKTOP);
    await s.ui.park(area.x + area.width * 0.6, area.y + area.height * 0.75);
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.ui.drag(from, to, 18);
      s.poster();
      await s.ui.hold(1.6);
    });
  },
};

/** Tall enough that the bin list's summary is not cut off. */
const TALL = { width: 1440, height: 1040 };

const binList: Shot = {
  id: 'getting-started-first-drawer-bin-list',
  kind: 'still',
  viewport: TALL,
  async take(s) {
    await openLayouts(s, FIRST_DRAWER);
    const head = await s.box(
      s.page.getByRole('button', { name: new RegExp(`^${label('rightPanel.binList')}`) }).first()
    );
    const spool = await s.box(
      s.page.getByText(label('print.summary.spoolLabel'), { exact: true }).first()
    );
    await s.still(
      {
        x: head.x,
        y: head.y - 4,
        width: TALL.width - head.x,
        height: spool.y + spool.height + 18 - (head.y - 4),
      },
      1.5
    );
  },
};

const firstBinDesigner: Shot = {
  id: 'getting-started-first-bin-designer',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screw bin', {});
    await s.still(WINDOW);
  },
};

/** The column and row steppers clicked in close-up, then the bin they build. */
const firstBinCompartments: Shot = {
  id: 'getting-started-first-bin-compartments',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Screw bin', { width: 3, depth: 2, height: 4 });
    const step = (what: string, dir: 'increaseAria' | 'decreaseAria'): Locator =>
      s.page.getByRole('button', { name: label(`common.${dir}`, { what }) }).first();
    const columns = step(label('binDesigner.columns'), 'increaseAria');
    const rows = step(label('binDesigner.rows'), 'increaseAria');
    await s.ui.preReveal(columns);
    const steppers = union(
      await s.box(step(label('binDesigner.columns'), 'decreaseAria')),
      await s.box(rows)
    );
    const closeUp = frameAround(steppers, 36, 4 / 3, WORKSPACE);
    await s.ui.park(closeUp.x + closeUp.width * 0.5, closeUp.y + closeUp.height * 0.92);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(columns);
        await s.ui.hold(0.35);
        await s.ui.click(columns);
        await s.ui.hold(0.35);
        await s.ui.click(rows);
        await s.ui.hold(0.6);
      },
      640 / closeUp.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    const canvas = await s.box(s.page.locator('canvas').first());
    const result = frameAround(await partBox(s), 40, 4 / 3, canvas);
    await s.take(result, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const BASEPLATE_DRAWER: FixtureLayout = { ...EMPTY, name: 'Workbench' };

const baseplateDimensions: Shot = {
  id: 'getting-started-first-baseplate-dimensions',
  kind: 'still',
  async take(s) {
    await openBaseplate(s, BASEPLATE_DRAWER);
    const panel = await s.box(s.page.locator('aside').first());
    const padding = await s.box(
      s.page.getByText(label('baseplate.padding'), { exact: true }).first()
    );
    await s.still(
      { x: panel.x, y: panel.y, width: panel.width, height: padding.y - 14 - panel.y },
      1.5
    );
  },
};

const baseplateSplit: Shot = {
  id: 'getting-started-first-baseplate-split',
  kind: 'still',
  async take(s) {
    await openBaseplate(s, { ...BASEPLATE_DRAWER, printBedSize: 220 });
    await s.page
      .locator('aside')
      .first()
      .evaluate((panel) => {
        const scroller = [panel, ...panel.querySelectorAll<HTMLElement>('*')].find(
          (x) =>
            x.scrollHeight > x.clientHeight + 4 &&
            /(auto|scroll)/.test(getComputedStyle(x).overflowY)
        );
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    await s.ui.warm(20);
    // Down to the map's hint: the panel's footer below it is not part of the step.
    const hint = await s.box(s.page.getByText(label('baseplate.splitEditHint')).first());
    await s.still({ ...WORKSPACE, height: hint.y + hint.height + 16 - WORKSPACE.y });
  },
};

/** Wide enough that the grid keeps its labels beside the open 3D preview. */
const TOUR = { width: 1680, height: 1050 };

const tourOverview: Shot = {
  id: 'getting-started-workspace-tour-overview',
  kind: 'still',
  viewport: TOUR,
  async take(s) {
    await openLayouts(s, WORKBENCH);
    await s.page
      .getByRole('button', { name: label('toolbar.show3dPreview') })
      .first()
      .click({ force: true });
    await s.page.waitForTimeout(2500);
    await s.ui.warm(40);
    // The preview halves the grid's room; Fit shows every cell again.
    await s.page
      .getByRole('button', { name: label('toolbar.fitGridToScreen') })
      .first()
      .click({ force: true });
    await s.ui.warm(30);
    await s.page.waitForTimeout(1000);
    await s.ui.warm(30);
    const bin = await s.box(s.page.locator('[data-bin-id]', { hasText: 'Screwdrivers' }).first());
    await s.ui.clickAt(bin.x + bin.width / 2, bin.y + bin.height / 2);
    await s.page.waitForTimeout(800);
    await s.dismissToasts();
    const header = await s.box(s.page.locator('header').first());
    const exportButton = await s.box(
      s.page.getByRole('button', { name: label('header.export') }).first()
    );
    const left = await s.box(s.page.locator('aside').first());
    const right = await s.box(s.page.locator('aside').last());
    const preview = await s.box(s.page.locator('canvas').first());
    // WORKBENCH leaves cells 8 to 9, rows 6 to 7, empty.
    const empty = await cellCenter(s, 8, 7);
    const emptyCorner = await cellCenter(s, 9, 6);
    const stash = await s.box(s.page.getByText(label('staging.stash'), { exact: true }).first());
    // Each marker sits on empty space in its area, so it hides no label.
    await s.markers([
      { n: 1, x: exportButton.x + exportButton.width + 40, y: header.y + header.height / 2 },
      { n: 2, x: left.x + left.width - 40, y: left.y + 30 },
      { n: 3, x: (empty[0] + emptyCorner[0]) / 2, y: (empty[1] + emptyCorner[1]) / 2 },
      { n: 4, x: preview.x + 32, y: preview.y + 32 },
      { n: 5, x: right.x + right.width - 40, y: right.y + 30 },
      { n: 6, x: stash.x + 270, y: stash.y + stash.height / 2 },
    ]);
    await s.still({ x: 0, y: 0, ...TOUR });
  },
};

const commandPalette: Shot = {
  id: 'getting-started-workspace-tour-command-palette',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, WORKBENCH);
    // Off camera, open it once to frame the shot on where it appears.
    await s.page.keyboard.press('ControlOrMeta+k');
    await s.ui.warm(20);
    const palette = s.page.locator('[cmdk-root]').first();
    await s.until(palette);
    const box = await s.box(palette);
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    const area = frameAround(box, 28, 4 / 3, WINDOW);
    await s.ui.hideCursor();
    await s.take(area, async () => {
      await s.ui.hold(0.6);
      await s.keys('ControlOrMeta+k', 'Ctrl K');
      await s.ui.hold(0.4);
      await s.type('layer');
      s.poster();
      await s.ui.hold(2);
    });
  },
};

/** The bin of step 3 again, drawn beside the right panel so both fit one frame. */
const NEW_BIN: FixtureLayout = { ...EMPTY, bins: [{ x: 7, y: 0, w: 2, d: 3, h: 3 }] };

const binOnGrid = (s: DocsSession, text?: string): Locator =>
  text
    ? s.page.locator('[data-bin-id]', { hasText: text }).first()
    : s.page.locator('[data-bin-id]').first();

async function selectBin(s: DocsSession, bin: Locator): Promise<void> {
  const b = await s.box(bin);
  await s.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await s.ui.warm(20);
  await s.dismissToasts();
}

const editBin: Shot = {
  id: 'getting-started-first-drawer-edit-bin',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, NEW_BIN);
    const bin = binOnGrid(s);
    await selectBin(s, bin);
    const title = s.page.getByRole('heading', { name: '2×3 Bin' }).first();
    const taller = s.page
      .getByRole('button', {
        name: label('common.increaseAria', { what: label('inspector.single.heightAria') }),
      })
      .first();
    const category = s.page.getByLabel(label('inspector.single.categoryAria')).first();
    const name = s.page.getByRole('combobox', { name: label('inspector.binLabel') }).first();
    const area = frameAround(
      union(await s.box(bin), await s.box(title), await s.box(name)),
      20,
      4 / 3,
      WORKSPACE
    );
    await s.ui.park(area.x + area.width * 0.3, area.y + area.height * 0.15);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      for (let i = 0; i < 3; i++) {
        await s.ui.click(taller);
        await s.ui.hold(0.15);
      }
      await s.ui.hold(0.3);
      await s.ui.click(name);
      await s.type('Drill bits');
      await s.ui.hold(0.5);
      // The label saves as it is typed; Enter would take the highlighted suggestion instead.
      await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      // The list of a native select never paints into a screenshot: point at it, then pick.
      const c = await s.box(category);
      await s.ui.moveTo(c.x + c.width * 0.6, c.y + c.height / 2);
      await s.ui.hold(0.2);
      await category.selectOption({ label: 'Green' });
      await s.ui.hold(0.2);
      await s.ui.moveTo(area.x + area.width * 0.5, area.y + area.height * 0.95);
      s.poster();
      await s.ui.hold(1.6);
    });
  },
};

const gridEdits: Shot = {
  id: 'getting-started-first-drawer-grid-edits',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, FIRST_DRAWER);
    const area = pad(await gridArea(s, EMPTY.width, EMPTY.depth), 6, DESKTOP);
    const drill = binOnGrid(s, 'Drill bits');
    const from = await s.box(drill);
    // Drill bits covers columns 6 to 8 and rows 1 to 2; it moves up to rows 4 to 5.
    const [, row1] = await cellCenter(s, 6, 1);
    const [, row4] = await cellCenter(s, 6, 4);
    const [col8] = await cellCenter(s, 8, 4);
    const [col9] = await cellCenter(s, 9, 4);
    const rest = await cellCenter(s, 3, 6);
    const grab: [number, number] = [from.x + from.width / 2, from.y + from.height * 0.7];
    const drop: [number, number] = [grab[0], grab[1] - (row1 - row4)];
    await s.ui.park(rest[0], rest[1]);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.drag(grab, drop, 20);
      await s.ui.hold(0.5);
      const handle = s.page
        .getByRole('slider', { name: label('gridEditor.resize.eastAria') })
        .first();
      const h = await s.box(handle);
      const [hx, hy] = [h.x + h.width / 2, h.y + h.height / 2];
      await s.ui.drag([hx, hy], [hx + (col9 - col8), hy], 14);
      await s.ui.hold(0.3);
      // Off the bin, so the keys act on the selection with no hover on it.
      await s.ui.moveTo(...rest);
      await s.keys('r', 'R');
      await s.ui.hold(0.5);
      await s.keys('ControlOrMeta+d', 'Ctrl D');
      s.poster();
      await s.ui.hold(1.4);
      await s.keys('Delete');
      await s.ui.hold(1.2);
    });
  },
};

/**
 * The screen box (CSS px) of the bins in the layout editor's 3D preview. The
 * preview merges the bins of one color into one mesh, so a lone bin is a mesh
 * of few triangles: `partBox` would skip it. Floor planes, text and markers
 * have fewer still.
 */
async function previewBins(s: DocsSession): Promise<Rect> {
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

async function framePreview(s: DocsSession, area: Rect): Promise<Rect> {
  const fill = (b: Rect): number => Math.max(b.width / area.width, b.height / area.height);
  const [cx, cy] = [area.x + area.width / 2, area.y + area.height / 2];
  let bins = await previewBins(s);
  for (let i = 0; i < 40 && fill(bins) < 0.75; i++) {
    await s.page.mouse.move(bins.x + bins.width / 2, bins.y + bins.height / 2);
    await s.page.mouse.wheel(0, -100);
    await s.ui.warm(8);
    bins = await previewBins(s);
  }
  for (let pass = 0; pass < 3; pass++) {
    const dx = cx - (bins.x + bins.width / 2);
    const dy = cy - (bins.y + bins.height / 2);
    if (Math.abs(dx) + Math.abs(dy) < 2) break;
    await s.page.mouse.move(cx, cy);
    await s.page.mouse.down({ button: 'right' });
    await s.page.mouse.move(cx + dx, cy + dy, { steps: 8 });
    await s.page.mouse.up({ button: 'right' });
    // The controls damp a pan, so the camera glides on after the drag.
    for (let i = 0; i < 60; i++) {
      await s.ui.warm(10);
      const next = await previewBins(s);
      const moved = Math.abs(next.x - bins.x) + Math.abs(next.y - bins.y);
      bins = next;
      if (moved < 0.5) break;
    }
  }
  return bins;
}

const view3d: Shot = {
  id: 'getting-started-first-drawer-3d-view',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, FIRST_DRAWER);
    const show = s.page.getByRole('button', { name: label('toolbar.show3dPreview') }).first();
    // Off camera, once, so the preview's code and scene are loaded before the take.
    await show.click({ force: true });
    await s.page.waitForTimeout(2500);
    await s.ui.warm(40);
    await s.page
      .getByRole('button', { name: label('toolbar.hide3dPreview') })
      .first()
      .click({ force: true });
    await s.page.waitForTimeout(800);
    await s.ui.warm(40);
    const left = await s.box(s.page.locator('aside').first());
    const right = await s.box(s.page.locator('aside').last());
    const width = right.x - (left.x + left.width);
    const area: Rect = { x: left.x + left.width, y: WORKSPACE.y, width, height: (width * 3) / 4 };
    const t = await s.box(show);
    await s.ui.park(t.x - 120, t.y + 160);
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.ui.click(show);
      await s.ui.moveTo(area.x + area.width * 0.3, area.y + area.height * 0.2);
      await s.ui.hold(1.2);
    });
    await s.ui.hideCursor();
    await s.page.waitForTimeout(1500);
    await s.ui.warm(40);
    const canvas = await s.box(s.page.locator('canvas').first());
    const stage = frameAround(
      { x: canvas.x, y: canvas.y + canvas.height / 2, width: canvas.width, height: 0 },
      0,
      4 / 3,
      canvas
    );
    await framePreview(s, stage);
    await s.take(stage, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const createButton = (s: DocsSession): Locator =>
  s.page
    .getByRole('button', { name: label('designLinking.inspector.createDesign'), exact: true })
    .first();

async function waitDesigner(s: DocsSession): Promise<void> {
  await designerReady(s.page).first().waitFor({ timeout: 90000 });
  await s.page.waitForTimeout(1500);
  await s.ui.warm(30);
  await s.ui.waitBuilt();
  await s.dismissToasts();
}

const createDesign: Shot = {
  id: 'getting-started-first-drawer-create-design',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, FIRST_DRAWER);
    const bin = binOnGrid(s, 'Drill bits');
    await selectBin(s, bin);
    const panel = await s.box(s.page.locator('aside').last());
    const area = frameAround(
      union(await s.box(bin), await s.box(createButton(s)), {
        x: panel.x + panel.width - 1,
        y: panel.y + 200,
        width: 1,
        height: 1,
      }),
      16,
      4 / 3,
      WORKSPACE
    );
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('inspector.deselectBin') }).first()
    );
    const b = await s.box(bin);
    await s.ui.park(b.x + b.width * 0.3, b.y - 60);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.clickAt(b.x + b.width / 2, b.y + b.height * 0.7);
      await s.ui.hold(0.6);
      await s.ui.click(createButton(s));
      await s.ui.hold(0.4);
    });
    const dialog = s.page.getByRole('dialog').first();
    const open = dialog
      .getByRole('button', { name: label('designLinking.createDialog.create') })
      .first();
    await s.take(frameAround(await s.box(dialog), 30, 4 / 3, WINDOW), async () => {
      await s.ui.hold(0.3);
      await s.ui.click(
        dialog.getByRole('button', { name: label('designLinking.createDialog.useLabel') }).first()
      );
      await s.ui.hold(0.6);
      const o = await s.box(open);
      await s.ui.moveTo(o.x + o.width / 2, o.y + o.height / 2);
      await s.ui.hold(0.2);
    });
    // The click loads the designer page: a take cannot run across a page load.
    await open.click({ force: true });
    await waitDesigner(s);
    await s.ui.hideCursor();
    const canvas = await s.box(s.page.locator('canvas').first());
    // Wide enough for the design's name on the floor in front of the bin.
    await s.take(frameAround(await partBox(s), 70, 4 / 3, canvas), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const drawerExport: Shot = {
  id: 'getting-started-first-drawer-export',
  kind: 'still',
  async take(s) {
    await openLayouts(s, FIRST_DRAWER);
    await selectBin(s, binOnGrid(s, 'Drill bits'));
    await s.ui.preClick(createButton(s));
    const dialog = s.page.getByRole('dialog').first();
    await s.ui.preClick(
      dialog.getByRole('button', { name: label('designLinking.createDialog.useLabel') }).first()
    );
    await dialog
      .getByRole('button', { name: label('designLinking.createDialog.create') })
      .first()
      .click({ force: true });
    await waitDesigner(s);
    await s.page
      .getByRole('tab', { name: label('toolSwitcher.layout') })
      .first()
      .click({ force: true });
    await grid(s.page).waitFor({ timeout: 90000 });
    await s.page.waitForTimeout(1500);
    await s.ui.warm(30);
    await s.dismissToasts();
    await s.ui.preClick(s.page.getByRole('button', { name: label('header.export') }).first());
    const exportDialog = s.page.getByRole('dialog').first();
    await s.until(exportDialog);
    await s.page.waitForTimeout(800);
    await s.ui.warm(20);
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(10);
    await s.still(pad(await s.box(exportDialog), 12, DESKTOP));
  },
};

const SCREW_BIN = {
  width: 3,
  depth: 2,
  height: 4,
  compartments: {
    cols: 3,
    rows: 2,
    cells: [0, 1, 2, 3, 4, 5],
    compartmentTexts: ['M3', 'M4', 'M5', 'M6', 'M8', 'M10'],
  },
  label: { enabled: true },
};

const firstBinName: Shot = {
  id: 'getting-started-first-bin-name',
  kind: 'clip',
  async take(s) {
    // The name a new design gets.
    await openDesigner(s, 'Untitled Bin', {});
    const name = s.page.getByRole('button', { name: 'Untitled Bin' }).first();
    const switcher = await s.box(
      s.page.getByRole('navigation', { name: label('toolSwitcher.toolSwitcher') })
    );
    const publish = await s.box(
      s.page.getByRole('button', { name: label('community.publishButtonAria') }).first()
    );
    const area = frameAround(union(switcher, await s.box(name), publish), 16, 4 / 3, WINDOW);
    const n = await s.box(name);
    await s.ui.park(n.x + n.width * 0.6, n.y + 150);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(name);
        await s.ui.hold(0.3);
        await s.page.keyboard.press('ControlOrMeta+a');
        await s.type('Screw bin');
        await s.ui.hold(0.2);
        await s.keys('Enter');
        await s.ui.moveTo(n.x + n.width * 0.6, n.y + 150);
        s.poster();
        await s.ui.hold(1.6);
      },
      640 / area.width
    );
  },
};

const stepper = (s: DocsSession, what: string, dir: 'increaseAria' | 'decreaseAria'): Locator =>
  s.page.getByRole('button', { name: label(`common.${dir}`, { what }) }).first();

const firstBinSize: Shot = {
  id: 'getting-started-first-bin-size',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Screw bin', {});
    const wider = stepper(s, label('common.width'), 'increaseAria');
    const taller = stepper(s, label('common.height'), 'increaseAria');
    const steppers = union(
      await s.box(stepper(s, label('common.width'), 'decreaseAria')),
      await s.box(stepper(s, label('common.depth'), 'increaseAria')),
      await s.box(taller)
    );
    const closeUp = frameAround(steppers, 30, 4 / 3, WORKSPACE);
    await s.ui.park(closeUp.x + closeUp.width * 0.5, closeUp.y + closeUp.height * 0.95);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(wider);
        await s.ui.hold(0.5);
        await s.ui.click(taller);
        await s.ui.hold(0.7);
      },
      640 / closeUp.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    const canvas = await s.box(s.page.locator('canvas').first());
    await s.take(frameAround(await partBox(s), 40, 4 / 3, canvas), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

async function scrollPanelTo(s: DocsSession, target: Locator, y: number): Promise<void> {
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

async function grip(s: DocsSession): Promise<[number, number]> {
  const c = await s.box(s.page.locator('canvas').first());
  return [c.x + c.width * 0.85, c.y + c.height * 0.5];
}

/** The left button turns the view (drag up to look from higher); the right button pans it. */
async function dragView(
  s: DocsSession,
  dx: number,
  dy: number,
  button: 'left' | 'right' = 'left'
): Promise<void> {
  const [x, y] = await grip(s);
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

async function placePart(s: DocsSession, area: Rect): Promise<Rect> {
  const fill = (b: Rect): number => Math.max(b.width / area.width, b.height / area.height);
  const wheel = async (dy: number): Promise<void> => {
    await s.page.mouse.move(...(await grip(s)));
    await s.page.mouse.wheel(0, dy);
    await s.ui.warm(14);
  };
  let part = await partBox(s);
  for (let i = 0; i < 30 && fill(part) > 1; i++) {
    await wheel(100);
    part = await partBox(s);
  }
  for (let i = 0; i < 30 && fill(part) < 0.94; i++) {
    await wheel(-100);
    part = await partBox(s);
  }
  await dragView(
    s,
    area.x + area.width / 2 - (part.x + part.width / 2),
    area.y + area.height / 2 - (part.y + part.height / 2),
    'right'
  );
  return partBox(s);
}

const firstBinLabelTab: Shot = {
  id: 'getting-started-first-bin-label-tab',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Screw bin', {
      ...SCREW_BIN,
      compartments: { ...SCREW_BIN.compartments, compartmentTexts: [] },
      label: { enabled: false },
    });
    const tabs = s.page.getByRole('switch', { name: label('binDesigner.labelTabs'), exact: true });
    // Six fields of 57 px from 206 px below the switch, once the switch is on.
    // Below the Interior group's sticky header.
    const top = 170;
    const area: Rect = { x: 0, y: top - 24, width: 760, height: 570 };
    // Higher than the default view, so the tabs and their text face the camera.
    await dragView(s, 0, 70);
    await placePart(s, { x: 360, y: area.y + 60, width: 380, height: area.height - 120 });
    await scrollPanelTo(s, tabs.first(), top);
    await s.ui.park(area.x + 200, area.y + area.height * 0.9);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(tabs.first());
      await s.ui.hold(0.6);
      await s.ui.click(
        s.page
          .getByRole('textbox', { name: label('binDesigner.tabEngravedTextAriaLabel', { n: 1 }) })
          .first()
      );
      for (const [i, text] of ['M3', 'M4', 'M5', 'M6', 'M8', 'M10'].entries()) {
        await s.type(text);
        if (i < 5) await s.keys('Enter');
      }
      await s.ui.moveTo(area.x + 200, area.y + area.height * 0.97);
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    const canvas = await s.box(s.page.locator('canvas').first());
    await s.take(frameAround(await partBox(s), 16, 4 / 3, canvas), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const firstBinExport: Shot = {
  id: 'getting-started-first-bin-export',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Screw bin', SCREW_BIN);
    const icon = s.page.getByRole('button', { name: label('binDesigner.exportBinAsStl') }).first();
    const name = await s.box(s.page.getByRole('button', { name: 'Screw bin' }).first());
    await s.ui.preClick(icon);
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.page.waitForTimeout(800);
    await s.ui.warm(20);
    const d = await s.box(dialog);
    await s.page.keyboard.press('Escape');
    await s.ui.warm(30);
    // Escape hands focus back to the icon, and its focus ring would show in the take.
    await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await s.ui.warm(4);
    const x = name.x - 16;
    const area: Rect = { x, y: 0, width: d.x + d.width + 16 - x, height: d.y + d.height + 16 };
    // The frame ends at the export window's right edge: the part has to sit left of it.
    const canvas = await s.box(s.page.locator('canvas').first());
    await placePart(s, {
      x: canvas.x + 40,
      y: canvas.y + 80,
      width: area.x + area.width - canvas.x - 80,
      height: area.height - canvas.y - 160,
    });
    await s.ui.park(d.x + d.width * 0.5, d.y + d.height * 0.3);
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.ui.click(icon);
      await s.ui.hold(1);
      const stl = await s.box(dialog.getByRole('radio', { name: 'STL', exact: true }).first());
      await s.ui.moveTo(stl.x + stl.width / 2, stl.y + stl.height * 0.7);
      await s.ui.hold(0.5);
      const download = await s.box(
        dialog
          .getByRole('button', { name: label('export.downloadFormat', { format: 'STL' }) })
          .first()
      );
      await s.ui.moveTo(download.x + download.width * 0.7, download.y + download.height / 2);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const baseplateMagnets: Shot = {
  id: 'getting-started-first-baseplate-magnets',
  kind: 'clip',
  async take(s) {
    await openBaseplate(s, BASEPLATE_DRAWER);
    const magnets = s.page
      .getByRole('switch', { name: label('baseplate.magnetHoles'), exact: true })
      .first();
    await s.ui.preReveal(magnets);
    const sw = await s.box(magnets);
    const panel = await s.box(s.page.locator('aside').first());
    // Room below the switch for the diameter and depth that Customize shows.
    const closeUp = frameAround(
      { x: panel.x, y: sw.y - 20, width: panel.width, height: 230 },
      8,
      4 / 3,
      WORKSPACE
    );
    await s.ui.park(closeUp.x + closeUp.width * 0.55, closeUp.y + closeUp.height * 0.3);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(magnets);
        await s.ui.hold(0.6);
        const customize = s.page.getByRole('button', {
          name: new RegExp(`^${label('common.customize')}`),
        });
        for (let i = 0; i < (await customize.count()); i++) {
          const b = await customize.nth(i).boundingBox();
          if (b && b.y > sw.y) {
            await s.ui.click(customize.nth(i));
            break;
          }
        }
        await s.ui.hold(1.4);
      },
      640 / closeUp.width
    );
    await s.ui.hideCursor();
    await waitBaseplate(s);
    const part = await partBox(s);
    const canvas = await s.box(s.page.locator('canvas').first());
    // The front-left corner of the plate, where the holes read at this size.
    const corner: Rect = {
      x: part.x,
      y: part.y + part.height * 0.55,
      width: part.width * 0.4,
      height: part.height * 0.45,
    };
    await s.take(frameAround(corner, 0, 4 / 3, canvas), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const baseplateExport: Shot = {
  id: 'getting-started-first-baseplate-export',
  kind: 'still',
  async take(s) {
    await openBaseplate(s, { ...BASEPLATE_DRAWER, printBedSize: 220 });
    await s.ui.preClick(s.page.getByRole('button', { name: label('common.export') }).first());
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.page.waitForTimeout(800);
    await s.ui.warm(20);
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(10);
    await s.still(pad(await s.box(dialog), 12, DESKTOP));
  },
};

const tourHelpSearch: Shot = {
  id: 'getting-started-workspace-tour-help-search',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, WORKBENCH);
    const target = s.page.getByRole('switch', { name: label('sidebar.halfBinMode') }).first();
    const goTo = (): Locator =>
      s.page.getByRole('button', { name: label('help.goTo'), exact: true }).first();
    const area: Rect = { x: 320, y: WORKSPACE.y, width: 800, height: 600 };
    // On empty cells, so no bin shows its hover handles.
    const rest = await cellCenter(s, 8, 7);
    await s.ui.park(...rest);
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.keys('?');
      await s.ui.hold(0.3);
      await s.type('half');
      await s.ui.hold(0.6);
      await s.ui.click(goTo());
    });
    await s.ui.hideCursor();
    // The sidebar scrolls the switch into view as the help window closes.
    const panel = await s.box(s.page.locator('aside').first());
    const landed = await s.box(target);
    const row = { x: panel.x, y: landed.y - 4, width: panel.width, height: landed.height + 8 };
    // Measured where it is: a reveal would scroll the sidebar off the jump.
    const group = await s.box(
      s.page.getByRole('button', { name: new RegExp(`^${label('sidebar.gridSize')}`) }).first()
    );
    await s.take(frameAround(union(group, row), 20, 4 / 3, WORKSPACE), async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const PHONE = { width: 390, height: 844 };

const tourPhone: Shot = {
  id: 'getting-started-workspace-tour-phone',
  kind: 'still',
  viewport: PHONE,
  async take(s) {
    await openLayouts(s, WORKBENCH);
    await s.still({ x: 0, y: 0, ...PHONE });
  },
};

const tourDesigner: Shot = {
  id: 'getting-started-workspace-tour-designer',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screw bin', SCREW_BIN);
    const groups = ['shape', 'lid', 'interior', 'base', 'finishing'] as const;
    const header = (g: (typeof groups)[number]): Locator =>
      s.page
        .getByRole('button', { name: new RegExp(`^${label(`binDesigner.group.${g}`)}`) })
        .first();
    for (const g of groups) {
      const h = header(g);
      await s.ui.preReveal(h);
      if ((await h.getAttribute('aria-expanded')) === 'true') {
        await h.click({ force: true });
        await s.ui.warm(20);
      }
    }
    await header('shape').evaluate((el) => {
      for (let n = el.parentElement; n; n = n.parentElement) n.scrollTop = 0;
    });
    await s.ui.warm(10);
    const versions = await s.box(
      s.page.getByRole('button', { name: label('binDesigner.versions.open') }).first()
    );
    const width = versions.x + versions.width + 24;
    const height = (width * 2) / 3;
    const canvas = await s.box(s.page.locator('canvas').first());
    await placePart(s, {
      x: canvas.x + 50,
      y: canvas.y + 70,
      width: width - canvas.x - 100,
      height: height - canvas.y - 110,
    });
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.hideCursor();
    await s.ui.warm(20);
    await s.still({ x: 0, y: 0, width, height });
  },
};

export const GETTING_STARTED: readonly Shot[] = [
  toolSwitcher,
  measuredSize,
  drawBin,
  binList,
  firstBinDesigner,
  firstBinCompartments,
  baseplateDimensions,
  baseplateSplit,
  tourOverview,
  commandPalette,
  editBin,
  gridEdits,
  view3d,
  createDesign,
  drawerExport,
  firstBinName,
  firstBinSize,
  firstBinLabelTab,
  firstBinExport,
  baseplateMagnets,
  baseplateExport,
  tourHelpSearch,
  tourPhone,
  tourDesigner,
];
