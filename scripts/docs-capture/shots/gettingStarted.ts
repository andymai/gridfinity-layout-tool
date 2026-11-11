import type { Locator } from '@playwright/test';
import { WORKBENCH } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { openBaseplate, openDesigner, partBox } from './apps';
import { cellCenter, gridArea, openLayouts } from './layoutEditor';

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
];
