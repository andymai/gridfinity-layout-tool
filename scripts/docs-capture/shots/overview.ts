import type { Locator } from '@playwright/test';
import { WORKBENCH } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { openBaseplate, openDesigner, partBox, waitBaseplate } from './apps';
import type { Params } from './apps';
import { cellCenter, openLayouts } from './layoutEditor';

const ASPECT = 16 / 9;
/** CSS px the clip is captured at; every take is scaled to it. */
const WIDTH = 960;

/**
 * The Workbench drawer widened to 12 x 7, close to the clip's 16:9, so the grid
 * fills the frame: the canvas pins a narrower grid to its left edge.
 */
const WIDE_DRAWER: FixtureLayout = {
  ...WORKBENCH,
  width: 12,
  bins: [
    ...(WORKBENCH.bins ?? []),
    { x: 6, y: 5, w: 3, d: 2, h: 6, label: 'Sandpaper', cat: 'Spares' },
    { x: 9, y: 0, w: 3, d: 2, h: 6, label: 'Pliers', cat: 'Hand tools' },
    { x: 9, y: 2, w: 3, d: 3, h: 6, label: 'Batteries', cat: 'Electrical' },
  ],
};

const canvas = (s: DocsSession): Promise<Rect> => s.box(s.page.locator('canvas').first());

const BIN_STATES: readonly Params[] = [
  { width: 3, depth: 2, height: 6 },
  {
    width: 3,
    depth: 2,
    height: 6,
    compartments: { cols: 3, rows: 1, cells: [0, 1, 2], compartmentTexts: ['M3', 'M4', 'M5'] },
    label: { enabled: true },
  },
  {
    width: 3,
    depth: 2,
    height: 6,
    compartments: { cols: 3, rows: 1, cells: [0, 1, 2], compartmentTexts: ['M3', 'M4', 'M5'] },
    label: { enabled: true },
    featureColors: { enabled: true, body: '#38bdf8', labelTab: '#f5f5f5', text: '#1f2937' },
  },
];

/** `setParams` merges one level deep, so nested settings merge here first. */
async function applyDesign(s: DocsSession, params: Params): Promise<void> {
  await s.page.evaluate(async (p) => {
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as {
      useDesignerStore: { getState(): { params: Params; setParams(params: Params): void } };
    };
    const isRecord = (x: unknown): x is Params =>
      typeof x === 'object' && x !== null && !Array.isArray(x);
    const deepMerge = (d: unknown, v: unknown): unknown => {
      if (!isRecord(d) || !isRecord(v)) return v;
      const out: Params = { ...d };
      for (const [k, x] of Object.entries(v)) out[k] = deepMerge(d[k], x);
      return out;
    };
    const store = useDesignerStore.getState();
    store.setParams(structuredClone(deepMerge(store.params, p)) as Params);
  }, params);
  await s.ui.waitBuilt();
}

const overview: Shot = {
  id: 'introduction-overview',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, WIDE_DRAWER);
    // With both side panels closed, the 16:9 frame holds the grid and nothing else.
    for (const name of ['sidebar.collapseLeftPanel', 'rightPanel.collapseRightPanel'] as const) {
      await s.page
        .getByRole('button', { name: label(name) })
        .first()
        .click({ force: true });
      await s.ui.warm(10);
    }
    await s.page
      .getByRole('button', { name: label('toolbar.fitGridToScreen') })
      .first()
      .click({ force: true });
    await s.page.waitForTimeout(800);
    await s.ui.warm(40);
    const from = await cellCenter(s, 10, 7);
    const to = await cellCenter(s, 12, 6);
    // The cells, from the row and column numbers: the grid element itself spans
    // the whole canvas, empty space included.
    const header = (key: 'grid.selectColumnAria' | 'grid.selectRowAria', n: number) =>
      s.box(
        s.page.getByRole('button', {
          name: label(key, key === 'grid.selectColumnAria' ? { column: n } : { row: n }),
          exact: true,
        })
      );
    const measure = async (): Promise<Rect> =>
      union(
        await header('grid.selectColumnAria', 1),
        await header('grid.selectColumnAria', WIDE_DRAWER.width),
        await header('grid.selectRowAria', 1),
        await header('grid.selectRowAria', WIDE_DRAWER.depth)
      );
    // The canvas recentres after the panels close; frame it once it holds still.
    let cells = await measure();
    for (let i = 0; i < 20; i++) {
      await s.ui.warm(10);
      await s.page.waitForTimeout(250);
      const next = await measure();
      const still = Math.abs(next.x - cells.x) < 1 && Math.abs(next.width - cells.width) < 1;
      cells = next;
      if (still) break;
    }
    // Right of the closed left panel's rail, which would show as a strip at the edge.
    const rail = await s.box(s.page.locator('aside').first());
    const left = rail.x + rail.width;
    const area = frameAround(cells, 24, ASPECT, {
      x: left,
      y: 48,
      width: DESKTOP.width - left,
      height: DESKTOP.height - 48,
    });
    // Over the empty corner: a cursor resting on a bin lights its resize handles.
    const rest = await cellCenter(s, 11, 6);
    await s.ui.park(rest[0], rest[1]);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.5);
        await s.ui.drag(from, to, 16);
        await s.ui.hold(1);
      },
      WIDTH / area.width
    );

    await s.ui.hideCursor();
    await openDesigner(s, 'Screw bin', BIN_STATES[0] ?? {});
    const shot = frameAround(await partBox(s), 70, ASPECT, await canvas(s));
    for (const [i, params] of BIN_STATES.entries()) {
      await applyDesign(s, params);
      await s.take(shot, async () => {
        if (i === BIN_STATES.length - 1) s.poster();
        await s.ui.hold(0.9);
      });
    }

    await openBaseplate(s, { ...WIDE_DRAWER, bins: [], printBedSize: 220 });
    const exploded: Locator = s.page
      .getByRole('button', { name: label('baseplate.viewExploded'), exact: true })
      .first();
    await exploded.click({ force: true });
    await waitBaseplate(s);
    const plate = await canvas(s);
    const plateShot = frameAround(
      {
        x: plate.x + plate.width * 0.12,
        y: plate.y + plate.height * 0.12,
        width: plate.width * 0.76,
        height: plate.height * 0.76,
      },
      0,
      ASPECT,
      plate
    );
    await s.take(plateShot, () => s.ui.hold(1.8));
  },
};

export const OVERVIEW: readonly Shot[] = [overview];
