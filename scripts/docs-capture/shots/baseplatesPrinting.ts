import type { Locator } from '@playwright/test';
import { WORKSHOP_CATEGORIES, layoutFile } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { cornerCutVertices } from '../../../src/shared/utils/cornerCutOutline';
import { FPS } from '../../feature-tips/encode';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { baseplateReady, openDesigner, partBox, waitBaseplate } from './apps';
import type { Params } from './apps';
import { openLayouts } from './layoutEditor';

/** The baseplate fields a layout file must carry, at the app's defaults. */
const PLATE: Params = {
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  lightweight: true,
  solidFloor: false,
  solidFloorThickness: 0.8,
};

const KITCHEN: FixtureLayout = { name: 'Kitchen', width: 6, depth: 4, height: 10 };
const VAN: FixtureLayout = { name: 'Van drawer', width: 4, depth: 3, height: 8 };

/** The baseplate generator on `layout`, with `plate` and `drawer` merged into its file. */
async function openPlate(
  s: DocsSession,
  layout: FixtureLayout,
  plate: Params = {},
  drawer: Params = {}
): Promise<void> {
  await s.open('/baseplate', baseplateReady);
  const file = layoutFile(layout) as { drawer: Params };
  await s.importLayouts(
    [{ ...file, drawer: { ...file.drawer, ...drawer }, baseplateParams: { ...PLATE, ...plate } }],
    baseplateReady
  );
  await waitBaseplate(s);
}

/** Renames the plate design the active layout uses, where the header and the library read it. */
async function nameActivePlate(s: DocsSession, name: string): Promise<void> {
  await s.page.evaluate(async (n) => {
    type Res = { ok: boolean; value?: { id: string; name: string; updatedAt: string } };
    const { useLayoutStore } = (await import('/src/core/store/layout/index.ts' as string)) as {
      useLayoutStore: { getState(): { layout: { activeBaseplateId?: string | null } } };
    };
    const storage = (await import(
      '/src/features/baseplate/storage/BaseplateStorage.ts' as string
    )) as { updateDesignName(id: string, name: string): Promise<Res> };
    const registry = (await import(
      '/src/features/baseplate/store/baseplateRegistry.ts' as string
    )) as { upsertRegistryEntry(ref: { id: string; name: string; updatedAt: string }): void };
    const id = useLayoutStore.getState().layout.activeBaseplateId;
    if (!id) throw new Error('the layout has no plate design');
    const res = await storage.updateDesignName(id, n);
    if (!res.ok || !res.value) throw new Error('could not rename the plate design');
    registry.upsertRegistryEntry({ id, name: n, updatedAt: res.value.updatedAt });
  }, name);
  await s.ui.warm(10);
}

async function setPlate(s: DocsSession, patch: Params): Promise<void> {
  await s.page.evaluate(async (p) => {
    const { useLayoutStore } = (await import('/src/core/store/layout/index.ts' as string)) as {
      useLayoutStore: {
        getState(): { layout: { baseplateParams?: Params }; setBaseplateParams(p: Params): void };
      };
    };
    const st = useLayoutStore.getState();
    st.setBaseplateParams({ ...st.layout.baseplateParams, ...p });
  }, patch);
  await waitBaseplate(s);
}

const panel = (s: DocsSession): Promise<Rect> => s.box(s.page.locator('aside').first());
const canvas = (s: DocsSession): Promise<Rect> => s.box(s.page.locator('canvas').first());
const view = (s: DocsSession, key: 'baseplate.isoView' | 'baseplate.topView'): Locator =>
  s.page.getByRole('button', { name: label(key), exact: true });
const toggle = (s: DocsSession, name: string): Locator =>
  s.page.getByRole('switch', { name, exact: true });

/** A 4:3 close-up of the panel, `above` CSS px over `target`. */
async function panelCloseUp(s: DocsSession, target: Locator, above: number): Promise<Rect> {
  const p = await panel(s);
  const t = await s.box(target);
  return { x: p.x, y: t.y - above, width: p.width, height: (p.width * 3) / 4 };
}

async function plateFrame(s: DocsSession, margin = 28): Promise<Rect> {
  return frameAround(await partBox(s), margin, 4 / 3, await canvas(s));
}

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** On camera, scrolls the panel until the top of `target` is at `y`. */
async function scrollPanelTo(
  s: DocsSession,
  target: Locator,
  y: number,
  frames = 16
): Promise<void> {
  const scroll = (top?: number): Promise<number> =>
    target.evaluate((el, value) => {
      let n = el.parentElement;
      while (
        n &&
        !(
          n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)
        )
      )
        n = n.parentElement;
      if (!n) throw new Error('no scroller above the target');
      if (value !== undefined) n.scrollTop = value;
      return n.scrollTop;
    }, top);
  const start = await scroll();
  const dy = (await s.box(target)).y - y;
  for (let i = 1; i <= frames; i++) {
    await scroll(start + dy * ease(i / frames));
    await s.ui.hold(1 / FPS);
  }
}

/** Clip width in the docs, in CSS px. */
const CLIP_WIDTH = 640;

interface BeforeAfter {
  closeUp: Rect;
  /** Where the cursor waits in the close-up: on nothing that shows a hover state. */
  rest: [number, number];
  /** The preview frame; the whole plate when absent. */
  plate?: Rect;
  act(): Promise<void>;
}

/**
 * Before and after for one panel control: the plate, a close-up of the
 * control in use, then the rebuilt plate in the same frame.
 */
async function beforeAfter(
  s: DocsSession,
  { closeUp, rest, plate: frame, act }: BeforeAfter
): Promise<void> {
  const plate = frame ?? (await plateFrame(s));
  await s.ui.hideCursor();
  await s.take(plate, () => s.ui.hold(1.2), CLIP_WIDTH / plate.width);
  await s.ui.park(...rest);
  await s.take(closeUp, async () => {
    await s.ui.hold(0.4);
    await act();
  });
  await s.ui.hideCursor();
  await waitBaseplate(s);
  await s.take(plate, async () => {
    s.poster();
    await s.ui.hold(2);
  });
}

/** Tall enough that all four panel sections show. */
const BASICS = { width: 1440, height: 1240 };

const basicsPanel: Shot = {
  id: 'baseplates-basics-panel',
  kind: 'still',
  viewport: BASICS,
  async take(s) {
    await openPlate(s, KITCHEN);
    await nameActivePlate(s, 'Kitchen drawer');
    await s.still({ x: 0, y: 0, ...BASICS });
  },
};

const basicsLibrary: Shot = {
  id: 'baseplates-basics-library',
  kind: 'still',
  async take(s) {
    const list = s.page.getByRole('button', { name: label('baseplate.library.openList') });
    const library = s.page.getByRole('dialog', { name: label('baseplate.library.title') });
    const openLibrary = async (): Promise<void> => {
      await s.ui.preClick(list);
      await s.until(library);
    };
    // The page saves a design's thumbnail a moment after its plate is built.
    const settle = async (): Promise<void> => {
      await s.page.waitForTimeout(2500);
      await s.ui.warm(30);
    };
    await openPlate(s, KITCHEN, { magnetHoles: true });
    await nameActivePlate(s, 'Kitchen drawer');
    await settle();
    await openLibrary();
    await s.ui.preClick(
      library.getByRole('button', { name: label('baseplate.library.newBaseplate') })
    );
    await setPlate(s, { syncWithLayout: false, baseplateWidth: 2, baseplateDepth: 2 });
    await nameActivePlate(s, 'Test print 2x2');
    await settle();
    // Back to the kitchen plate, so the test print is used by no layout.
    await openLibrary();
    await s.ui.preClick(library.getByRole('option').filter({ hasText: 'Kitchen drawer' }));
    await waitBaseplate(s);
    await settle();
    await openLibrary();
    await s.dismissToasts();
    await s.still(await s.box(library));
  },
};

const stackSection: Shot = {
  id: 'baseplates-stack-section',
  kind: 'clip',
  async take(s) {
    await openPlate(s, { name: 'Tool chest', width: 12, depth: 8, height: 12 });
    const stack = toggle(s, label('baseplate.stackPrint.enable'));
    const closeUp = await panelCloseUp(s, stack, 22);
    await s.ui.park(closeUp.x + closeUp.width * 0.6, closeUp.y + 34);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(stack);
        await s.ui.hold(1.6);
      },
      CLIP_WIDTH / closeUp.width
    );
    await s.ui.hideCursor();
    await waitBaseplate(s);
    await s.ui.preClick(view(s, 'baseplate.isoView'));
    await s.ui.warm(30);
    const slider = s.page.getByRole('slider', {
      name: label('baseplate.stackPrint.separationSlider'),
    });
    const track = slider.locator('..');
    // Off camera, pull the tower apart once to frame it at its tallest.
    await slider.focus();
    await s.page.keyboard.press('End');
    await s.ui.warm(20);
    const apart = await partBox(s);
    await s.page.keyboard.press('Home');
    await s.ui.warm(20);
    const together = await partBox(s);
    const area = frameAround(
      union(apart, together, await s.box(track.locator('..'))),
      24,
      4 / 3,
      await canvas(s)
    );
    const t = await s.box(track);
    const x = t.x + t.width / 2;
    await s.ui.park(x - 60, t.y + t.height + 40);
    await s.take(area, async () => {
      await s.ui.hold(0.6);
      await s.ui.drag([x, t.y + t.height - 2], [x, t.y + 4], 40);
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const SCREWS: Params = {
  enabled: true,
  diameter: 3.4,
  headStyle: 'countersink',
  headDiameter: 6,
  screwsPerPiece: 4,
};

const magnetsBaseSection: Shot = {
  id: 'baseplates-magnets-base-section',
  kind: 'clip',
  async take(s) {
    await openPlate(s, VAN, { screwHoles: SCREWS });
    await s.ui.preClick(view(s, 'baseplate.isoView'));
    await s.ui.warm(30);
    const magnets = toggle(s, label('baseplate.magnetHoles'));
    const m = await s.box(magnets);
    await beforeAfter(s, {
      closeUp: await panelCloseUp(s, magnets, 62),
      rest: [m.x - 100, m.y - 12],
      act: async () => {
        await s.ui.click(magnets);
        await s.ui.hold(1.2);
      },
    });
  },
};

const magnetsScrewSettings: Shot = {
  id: 'baseplates-magnets-screw-settings',
  kind: 'clip',
  async take(s) {
    await openPlate(s, VAN);
    // From the top, each countersink reads as a ring where four pockets meet.
    await s.ui.preClick(view(s, 'baseplate.topView'));
    await s.ui.warm(30);
    const screws = toggle(s, label('baseplate.screwHoles.label'));
    // Mid panel, so the settings it opens have room below it.
    await s.ui.preReveal(screws);
    const t = await s.box(screws);
    const closeUp = await panelCloseUp(s, screws, 108 - t.height / 2);
    await beforeAfter(s, {
      closeUp,
      rest: [t.x - 100, t.y - 12],
      act: async () => {
        await s.ui.click(screws);
        await s.ui.hold(0.4);
        await s.ui.click(
          s.page.getByRole('button', { name: label('common.customize'), exact: true }).last()
        );
        await s.ui.hold(0.4);
        // Out of the frame, so it covers none of the settings.
        await s.ui.moveTo(closeUp.x + closeUp.width + 60, closeUp.y + closeUp.height * 0.4);
        await scrollPanelTo(
          s,
          s.page.getByRole('slider', { name: label('baseplate.screwHoles.diameter.label') }),
          closeUp.y + 26
        );
        await s.ui.hold(1.8);
      },
    });
  },
};

const SHAPED: FixtureLayout = { name: 'Kitchen', width: 6, depth: 5, height: 10 };
const SHAPED_CUTS: Parameters<typeof cornerCutVertices>[2] = {
  tl: { kind: 'radius', r: 30 },
  tr: { kind: 'radius', r: 30 },
  bl: { kind: 'none' },
  br: { kind: 'notch', w: 60, d: 45 },
};

const shapedPlate: Shot = {
  id: 'baseplates-shaped-plate',
  kind: 'clip',
  async take(s) {
    await openPlate(
      s,
      SHAPED,
      {},
      {
        outline: {
          vertices: cornerCutVertices(SHAPED.width * 42, SHAPED.depth * 42, SHAPED_CUTS),
          authoring: { kind: 'corners', corners: SHAPED_CUTS },
        },
      }
    );
    await s.ui.preClick(view(s, 'baseplate.isoView'));
    await s.ui.warm(30);
    const wholeCells = toggle(s, label('baseplate.wholeCellsOnly'));
    const closeUp = await panelCloseUp(s, wholeCells, 181);
    await beforeAfter(s, {
      closeUp,
      rest: [closeUp.x + closeUp.width * 0.82, closeUp.y + closeUp.height * 0.33],
      act: async () => {
        await s.ui.click(wholeCells);
        await s.ui.hold(1);
      },
    });
  },
};

const splittingMap: Shot = {
  id: 'baseplates-splitting-map',
  kind: 'clip',
  async take(s) {
    await openPlate(s, { name: 'Workbench', width: 10, depth: 7, height: 12 });
    const seam = (column: number): Locator =>
      s.page.getByRole('button', {
        name: label('baseplate.splitSeamVertical', { position: column }),
        exact: true,
      });
    const hint = s.page.getByText(label('baseplate.splitEditHint')).first();
    await s.ui.preReveal(hint);
    const reason = await s.box(
      s.page.getByText(label('baseplate.splitReason', { printBed: 256 })).first()
    );
    const p = await panel(s);
    const h = await s.box(hint);
    const area: Rect = {
      x: p.x,
      y: reason.y - 14,
      width: p.width,
      height: h.y + h.height + 22 - (reason.y - 14),
    };
    await s.ui.park(area.x + area.width * 0.85, reason.y + reason.height + 24);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.8);
        await s.ui.click(seam(4));
        await s.ui.hold(0.7);
        await s.ui.click(seam(5));
        s.poster();
        await s.ui.hold(2);
      },
      2
    );
  },
};

/** A 6 by 4 tool drawer for a 180 mm bed, where the screwdriver bin must split. */
const TOOL_DRAWER: FixtureLayout = {
  name: 'Tool drawer',
  width: 6,
  depth: 4,
  height: 8,
  printBedSize: 180,
  categories: WORKSHOP_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 3 }],
  bins: [
    { x: 0, y: 0, w: 6, d: 1, h: 3, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 0, y: 1, w: 2, d: 1, h: 3, label: 'Drill bits', cat: 'Bits' },
    { x: 2, y: 1, w: 2, d: 1, h: 3, label: 'Drill bits', cat: 'Bits' },
    { x: 4, y: 3, w: 2, d: 1, h: 3, label: 'Drill bits', cat: 'Bits' },
    { x: 4, y: 1, w: 1, d: 1, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 5, y: 1, w: 1, d: 1, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 4, y: 2, w: 1, d: 1, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 5, y: 2, w: 1, d: 1, h: 4, label: 'Sockets', cat: 'Hand tools' },
    { x: 0, y: 2, w: 2, d: 2, h: 3, label: 'Washers', cat: 'Fasteners' },
    { x: 2, y: 2, w: 2, d: 2, h: 3, label: 'Washers', cat: 'Fasteners' },
  ],
};

/** Tall enough that the bin list's summary is not cut off. */
const TALL = { width: 1440, height: 1040 };

const binListHeader = (s: DocsSession): Locator =>
  s.page.getByRole('button', { name: new RegExp(`^${label('rightPanel.binList')}`) }).first();
const spoolRow = (s: DocsSession): Locator =>
  s.page.getByText(label('print.summary.spoolLabel'), { exact: true }).first();

const printList: Shot = {
  id: 'printing-print-list',
  kind: 'still',
  viewport: TALL,
  async take(s) {
    await openLayouts(s, TOOL_DRAWER);
    const head = await s.box(binListHeader(s));
    const spool = await s.box(spoolRow(s));
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

const estimatesSummary: Shot = {
  id: 'printing-estimates-summary',
  kind: 'still',
  viewport: TALL,
  async take(s) {
    await openLayouts(s, TOOL_DRAWER);
    const right = await s.box(s.page.locator('aside').last());
    const nozzle = await s.box(
      s.page.locator('aside').last().getByLabel(label('settings.nozzleSize'), { exact: true })
    );
    const spool = await s.box(spoolRow(s));
    // Starts below the border under the bin list's last row.
    const top = nozzle.y - 8;
    await s.still(
      { x: right.x, y: top, width: right.width, height: spool.y + spool.height + 18 - top },
      2
    );
  },
};

const exportButton = (s: DocsSession): Locator =>
  s.page.getByRole('button', { name: label('binDesigner.exportBinAsStl') }).first();

async function openExport(s: DocsSession): Promise<Locator> {
  await s.ui.preClick(exportButton(s));
  const dialog = s.page.getByRole('dialog').first();
  await s.until(dialog);
  return dialog;
}

const formatsDialog: Shot = {
  id: 'printing-formats-dialog',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screwdriver Bin', {
      width: 2,
      depth: 3,
      height: 6,
      base: { style: 'magnet' },
    });
    const dialog = await openExport(s);
    await s.ui.preClick(dialog.getByRole('radio', { name: '3MF', exact: true }));
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.still(await s.box(dialog));
  },
};

/** All sixteen lip cells in one color. */
function lipCells(color: string): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const corner of ['frontLeft', 'frontRight', 'backRight', 'backLeft'])
    for (const band of [0, 1, 2, 3]) cells[`lip:${corner}:${band}`] = color;
  return cells;
}

const filamentMap: Shot = {
  id: 'printing-slicers-filament-map',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screw bin', {
      width: 2,
      depth: 2,
      height: 4,
      label: { enabled: true },
      featureColors: {
        enabled: true,
        body: '#334155',
        base: '#334155',
        lip: { corners: 1, bands: 1, cells: lipCells('#f59e0b') },
        labelTab: '#f8fafc',
        text: '#f8fafc',
      },
    });
    const dialog = await openExport(s);
    const show = dialog.getByRole('button', {
      name: label('binDesigner.colors.slicerHandoff.show'),
    });
    await s.ui.preClick(show);
    await s.ui.warm(20);
    await s.dismissToasts();
    const format = await s.box(dialog.getByText(label('export.format'), { exact: true }).first());
    const mapping = await s.box(show.locator('..'));
    await s.still(pad(union(format, mapping), 14, DESKTOP), 1.5);
  },
};

const connectorTest: Shot = {
  id: 'printing-fit-connector-test',
  kind: 'still',
  async take(s) {
    await openPlate(
      s,
      { name: 'Workbench', width: 10, depth: 7, height: 12 },
      { connectorNubs: true, connectorStyle: 'dovetailKey' }
    );
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('baseplate.connectorSample.button') }).first()
    );
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.dismissToasts();
    await s.still(await s.box(dialog));
  },
};

export const BASEPLATES_PRINTING: readonly Shot[] = [
  basicsPanel,
  basicsLibrary,
  stackSection,
  magnetsBaseSection,
  magnetsScrewSettings,
  shapedPlate,
  splittingMap,
  printList,
  estimatesSummary,
  formatsDialog,
  filamentMap,
  connectorTest,
];
