import type { Locator } from '@playwright/test';
import { FPS } from '../../feature-tips/encode';
import { layoutFile } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { designerReady, openDesigner, partBox, setDesign } from './apps';
import { gridArea } from './layoutEditor';
import type { Params } from './apps';

/** The designer's settings panel, below the app header. */
const PANEL: Rect = { x: 0, y: 48, width: 319, height: DESKTOP.height - 48 };
const CLIP_WIDTH = 640;

const toggle = (s: DocsSession, key: Parameters<typeof label>[0]): Locator =>
  s.page.getByRole('switch', { name: label(key), exact: true }).first();

const panelFrame = (top: number): Rect => ({
  x: PANEL.x,
  y: top,
  width: PANEL.width,
  height: (PANEL.width * 3) / 4,
});

async function closeUp(s: DocsSession, ...targets: Locator[]): Promise<Rect> {
  const boxes: Rect[] = [];
  for (const t of targets) boxes.push(await s.box(t));
  return frameAround(union(...boxes), 12, 4 / 3, PANEL);
}

async function partFrame(s: DocsSession): Promise<Rect> {
  await s.ui.hideCursor();
  await s.ui.waitBuilt();
  const canvas = await s.box(s.page.locator('canvas').first());
  return frameAround(await partBox(s), 40, 4 / 3, canvas);
}

async function holdOnPart(s: DocsSession): Promise<void> {
  await s.take(await partFrame(s), async () => {
    s.poster();
    await s.ui.hold(2);
  });
}

async function dimensionsSection(s: DocsSession): Promise<Rect> {
  const heading = await s.box(
    s.page.getByText(label('binDesigner.dimensions'), { exact: true }).first()
  );
  const halfGrid = await s.box(toggle(s, 'binDesigner.halfBinMode'));
  const top = heading.y - 16;
  return { x: 0, y: top, width: PANEL.width, height: halfGrid.y + halfGrid.height + 14 - top };
}

const dimensions: Shot = {
  id: 'designer-size-and-shape-dimensions',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screw bin', {});
    await s.still(await dimensionsSection(s), 1.5);
  },
};

async function scrollBy(s: DocsSession, inside: Locator, dy: number, frames = 10): Promise<void> {
  const scroller = await inside.evaluateHandle((el) => {
    let n = el.parentElement;
    while (
      n &&
      !(n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))
    )
      n = n.parentElement;
    return n ?? document.scrollingElement ?? document.body;
  });
  const start = await scroller.evaluate((el) => (el as Element).scrollTop);
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await scroller.evaluate(
      (el, top) => {
        (el as Element).scrollTop = top;
      },
      start + dy * eased
    );
    await s.ui.hold(1 / FPS);
  }
}

/** Two units deep, so the presets and the whole grid share one close-up. */
const customShape: Shot = {
  id: 'designer-size-and-shape-custom-shape',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Corner tray', { width: 4, depth: 2, height: 3 });
    const sw = toggle(s, 'binDesigner.shape.customShape');
    const grid = s.page.getByRole('grid').first();
    // Off camera, turned on once to measure how far below the switch its grid ends.
    await s.ui.preClick(sw);
    const on = await s.box(grid);
    const below = on.y + on.height - (await s.box(sw)).y;
    await sw.click({ force: true });
    await s.ui.waitBuilt();
    const switchBox = await s.box(sw);
    const frame = panelFrame(switchBox.y - 14);
    const scroll = Math.max(0, switchBox.y + below + 12 - (frame.y + frame.height));
    const lPreset = s.page.getByRole('button', {
      name: label('binDesigner.shape.preset.l'),
      exact: true,
    });
    await s.ui.park(frame.x + frame.width * 0.62, frame.y + frame.height * 0.66);
    await s.take(
      frame,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(sw);
        await s.ui.hold(0.3);
        await scrollBy(s, sw, scroll);
        await s.ui.hold(0.2);
        await s.ui.click(lPreset);
        await s.ui.hold(0.9);
      },
      CLIP_WIDTH / frame.width
    );
    await holdOnPart(s);
  },
};

const VIEWS = {
  front: ['workshop.view.front', '1'],
  side: ['workshop.view.side', '2'],
} as const;

const viewButton = (s: DocsSession, view: keyof typeof VIEWS): Locator => {
  const [key, shortcut] = VIEWS[view];
  return s.page.getByRole('button', {
    name: label('binDesigner.cameraPresetAria', { view: label(key), key: shortcut }),
  });
};

async function setView(s: DocsSession, view: keyof typeof VIEWS): Promise<void> {
  await viewButton(s, view).click({ force: true });
  await s.ui.warm(90);
}

async function belowToolbar(s: DocsSession): Promise<Rect> {
  const canvas = await s.box(s.page.locator('canvas').first());
  const bar = await s.box(viewButton(s, 'front'));
  const top = bar.y + bar.height + 8;
  return { ...canvas, y: top, height: canvas.y + canvas.height - top };
}

async function zoomPreview(s: DocsSession, steps: number): Promise<void> {
  const canvas = await s.box(s.page.locator('canvas').first());
  await s.page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  for (let i = 0; i < steps; i++) {
    await s.page.mouse.wheel(0, -100);
    await s.ui.warm(3);
  }
  await s.ui.warm(60);
}

const topRim: Shot = {
  id: 'designer-stacking-top-rim',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Parts tray', { width: 3, depth: 2, height: 3 });
    const heading = s.page.getByText(label('binDesigner.base.section.stacking'), { exact: true });
    const notches = toggle(s, 'binDesigner.base.lipNotches');
    const rounded = s.page.getByRole('radio', {
      name: label('binDesigner.base.lipTip.round'),
      exact: true,
    });
    await s.ui.preReveal(notches);
    const area = await closeUp(s, heading.first(), notches);
    await s.ui.park(area.x + area.width * 0.45, area.y + area.height * 0.92);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(rounded);
        await s.ui.hold(0.4);
        await s.ui.click(notches);
        await s.ui.hold(0.7);
      },
      CLIP_WIDTH / area.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await zoomPreview(s, 6);
    await s.take(frameAround(await partBox(s), 20, 4 / 3, await belowToolbar(s)), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

async function orbitBelow(s: DocsSession): Promise<void> {
  const canvas = await s.box(s.page.locator('canvas').first());
  const x = canvas.x + canvas.width / 2;
  const y = canvas.y + canvas.height * 0.75;
  await s.page.mouse.move(x, y);
  await s.page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await s.page.mouse.move(x, y - i * 13);
    await s.ui.warm(1);
  }
  await s.page.mouse.up();
  await s.ui.warm(60);
}

/**
 * On this short window, the note the switch adds to Lightweight floor is out of
 * view above, so the browser keeps the switch in place as the panel grows.
 */
const drainage: Shot = {
  id: 'designer-walls-drainage',
  kind: 'clip',
  viewport: { width: DESKTOP.width, height: 720 },
  async take(s) {
    await openDesigner(s, 'Sponge tray', { width: 2, depth: 2, height: 3 });
    const sw = toggle(s, 'binDesigner.base.floorPattern');
    const heading = s.page.getByText(label('binDesigner.base.section.floorPattern'), {
      exact: true,
    });
    await s.ui.preReveal(sw);
    // Ends above the hint under the scale slider, so no line of text is cut in half.
    const area = panelFrame((await s.box(heading.first())).y - 32);
    await s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.4);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(sw);
        await s.ui.hold(1);
      },
      CLIP_WIDTH / area.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await orbitBelow(s);
    await holdOnPart(s);
  },
};

const wallPattern: Shot = {
  id: 'designer-walls-pattern',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Spray cans', { width: 3, depth: 2, height: 6 });
    const heading = s.page
      .getByText(label('binDesigner.style.section.wallSurface'), { exact: true })
      .first();
    const select = s.page.getByRole('combobox', { name: label('binDesigner.walls.pattern.label') });
    await s.ui.preReveal(select);
    const area = panelFrame((await s.box(heading)).y - 14);
    const walls = s.page.getByRole('group', { name: label('binDesigner.walls.pattern.sides') });
    const wall = (side: 'back' | 'left' | 'right'): Locator =>
      walls.getByRole('switch', { name: label(`binDesigner.lid.side.${side}`), exact: true });
    await s.ui.park(area.x + area.width * 0.7, area.y + area.height * 0.85);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        const box = await s.box(select);
        await s.ui.moveTo(box.x + box.width * 0.6, box.y + box.height / 2);
        await s.ui.hold(0.2);
        await select.selectOption('honeycomb');
        await s.ui.hold(0.6);
        const picker = await s.box(walls);
        await scrollBy(s, heading, picker.y + picker.height + 16 - (area.y + area.height), 14);
        await s.ui.hold(0.2);
        await s.ui.click(wall('back'));
        await s.ui.click(wall('left'));
        await s.ui.click(wall('right'));
        await s.ui.hold(0.7);
      },
      CLIP_WIDTH / area.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await setView(s, 'front');
    await holdOnPart(s);
  },
};

const slant: Shot = {
  id: 'designer-special-bins-slant',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Pen holder', { width: 1, depth: 2, height: 6 });
    const sw = toggle(s, 'binDesigner.slant.title');
    await s.ui.preReveal(sw);
    const switchBox = await s.box(sw);
    const area = panelFrame(switchBox.y - 14);
    const flatter = s.page.getByRole('button', {
      name: label('common.decreaseAria', { what: label('binDesigner.slant.angleAria') }),
    });
    const support = toggle(s, 'binDesigner.slant.endSupport');
    await s.ui.park(area.x + area.width * 0.6, area.y + area.height * 0.75);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(sw);
        await s.ui.hold(0.5);
        // Three 5 degree steps, from the 45 a new slant starts at down to 30.
        for (let i = 0; i < 3; i++) {
          await s.ui.click(flatter);
          await s.ui.hold(0.15);
        }
        await s.ui.hold(0.3);
        const row = await s.box(support);
        await scrollBy(s, sw, row.y + row.height + 14 - (area.y + area.height));
        await s.ui.click(support);
        await s.ui.hold(0.6);
      },
      CLIP_WIDTH / area.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await setView(s, 'side');
    await holdOnPart(s);
  },
};

const lidAttachment: Shot = {
  id: 'designer-lids-attachment',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Screw bin', { width: 2, depth: 2, height: 3 });
    const sw = toggle(s, 'binDesigner.lid.enable');
    const hinged = s.page.getByRole('radio', {
      name: label('binDesigner.lid.attachment.hinge'),
      exact: true,
    });
    await s.ui.preReveal(sw);
    // The attachment choices end just inside this frame.
    const group = s.page.getByRole('heading', {
      name: label('binDesigner.group.lid'),
      exact: true,
    });
    const area = panelFrame((await s.box(group)).y);
    const rest = (): Promise<void> =>
      s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.55);
    await rest();
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(sw);
        await s.ui.hold(0.7);
      },
      CLIP_WIDTH / area.width
    );
    await s.take(await partFrame(s), async () => {
      await s.ui.hold(1.3);
    });
    await rest();
    await s.take(area, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(hinged);
      await s.ui.hold(0.6);
    });
    await holdOnPart(s);
  },
};

/** The measured height gives the readout a fit line to report. */
const MEASURED_DRAWER: FixtureLayout = {
  name: 'Desk drawer',
  width: 9,
  depth: 7,
  height: 8,
  measuredMm: { width: 390, depth: 300, height: 62 },
};

const assembledHeight: Shot = {
  id: 'designer-stacking-assembled-height',
  kind: 'still',
  async take(s) {
    await s.open('/designer', designerReady);
    await s.importLayouts([layoutFile(MEASURED_DRAWER)], designerReady);
    await setDesign(s, 'Tool tray', { width: 2, depth: 2, height: 6 });
    const readout = s.page.getByRole('button', {
      name: new RegExp(`^${label('assembledHeight.title')}`),
    });
    await s.ui.preClick(readout);
    // Off the readout, so it shows open rather than hovered.
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.dismissToasts();
    await s.still(await dimensionsSection(s), 1.5);
  },
};

interface LibraryDesign {
  name: string;
  params: Params;
  tags?: string[];
}

interface Seeding {
  __seed?: { ids?: string[]; error?: string };
}

async function seedLibrary(s: DocsSession, designs: readonly LibraryDesign[]): Promise<string[]> {
  await s.open('/designer', designerReady);
  // A thumbnail render started while the designer still builds its own bin is cancelled.
  await s.ui.waitBuilt();
  // Started in the background and polled: the renders wait on timers that
  // only move while the clock steps.
  await s.page.evaluate((list) => {
    const w = window as unknown as Seeding;
    w.__seed = {};
    const run = async (): Promise<string[]> => {
      type Saved = { id: string; params?: Params };
      type Res<T> = { ok: boolean; value?: T; error?: unknown };
      const storage = (await import(
        '/src/features/bin-designer/storage/DesignerStorage.ts' as string
      )) as {
        saveDesign(d: object): Promise<Res<Saved>>;
        listDesigns(): Promise<Res<Saved[]>>;
        deleteDesign(id: string): Promise<Res<void>>;
        updateDesignThumbnail(id: string, thumbnail: string): Promise<Res<Saved>>;
      };
      const { regenerateThumbnail } = (await import(
        '/src/features/bin-designer/utils/thumbnailRegenerator.ts' as string
      )) as { regenerateThumbnail(params: Params): Promise<string | null> };
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
      const before = (await storage.listDesigns()).value ?? [];
      const made: string[] = [];
      for (const d of list) {
        const res = await storage.saveDesign({
          name: d.name,
          params: deepMerge(DEFAULT_BIN_PARAMS, d.params),
          thumbnail: null,
          exportFileNameConfig: null,
          ...(d.tags ? { tags: d.tags } : {}),
        });
        if (!res.ok || !res.value)
          throw new Error(`could not save ${d.name}: ${String(res.error)}`);
        // A render that a background build cancels comes back null, so it tries again.
        let thumbnail: string | null = null;
        for (let i = 0; i < 3 && !thumbnail; i++)
          thumbnail = await regenerateThumbnail(res.value.params ?? {});
        if (!thumbnail) throw new Error(`no thumbnail for ${d.name}`);
        await storage.updateDesignThumbnail(res.value.id, thumbnail);
        made.push(res.value.id);
      }
      // The design a first visit makes would sit in every library shot.
      for (const d of before) await storage.deleteDesign(d.id);
      return made;
    };
    run().then(
      (ids) => (w.__seed = { ids }),
      (e: unknown) => (w.__seed = { error: String(e) })
    );
  }, designs);
  for (let i = 0; ; i++) {
    const state = await s.page.evaluate(() => (window as unknown as Seeding).__seed ?? {});
    if (state.error) throw new Error(state.error);
    if (state.ids) {
      const [first] = state.ids;
      if (!first) throw new Error('no designs to save');
      await openDesign(s, first);
      return state.ids;
    }
    if (i >= 900) throw new Error('the library did not finish saving');
    await s.ui.warm(4);
    await s.page.waitForTimeout(100);
  }
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

const cells = (cols: number, rows: number): Params => ({
  cols,
  rows,
  thickness: 1.2,
  cells: Array.from({ length: cols * rows }, (_, i) => i),
});

/**
 * Newest last: the list shows the open design first, then the most recently
 * saved, so the two oldest fill a second row and the menu of Screw bin, in
 * the first row, opens inside the dialog.
 */
const LIBRARY: readonly LibraryDesign[] = [
  { name: 'Bit holder', params: { width: 3, depth: 1, height: 3, compartments: cells(6, 1) } },
  { name: 'Zip ties', params: { width: 2, depth: 1, height: 6 } },
  { name: 'Wire nuts', params: { width: 1, depth: 1, height: 4, compartments: cells(1, 2) } },
  {
    name: 'Pen cup',
    params: { width: 1, depth: 1, height: 8, wallPattern: { enabled: true, pattern: 'honeycomb' } },
  },
  {
    name: 'SD card holder',
    params: { width: 1, depth: 1, height: 3, compartments: cells(1, 3) },
    tags: ['Desk'],
  },
  { name: 'Battery caddy', params: { width: 2, depth: 2, height: 4, compartments: cells(4, 2) } },
  {
    name: 'Screw bin',
    params: { width: 2, depth: 1, height: 3, compartments: cells(3, 1) },
    tags: ['Workbench'],
  },
];

/** Tall enough that the dialog holds two rows of designs and the open menu. */
const LIBRARY_VIEW = { width: DESKTOP.width, height: 1080 };

const library: Shot = {
  id: 'designer-save-and-reuse-library',
  kind: 'still',
  viewport: LIBRARY_VIEW,
  async take(s) {
    await seedLibrary(s, LIBRARY);
    await s.page
      .getByRole('button', { name: label('binDesigner.openDesignList') })
      .click({ force: true });
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    const menuButton = s.page.getByRole('button', {
      name: label('binDesigner.moreActionsForDesign', { name: 'Screw bin' }),
    });
    await s.until(menuButton);
    await s.page.waitForTimeout(800);
    await s.ui.warm(20);
    await s.ui.preClick(menuButton);
    await s.ui.warm(20);
    await s.ui.hideCursor();
    const menu = await s.box(s.page.getByRole('menu').first());
    await s.still(pad(union(await s.box(dialog), menu), 0, LIBRARY_VIEW));
  },
};

const DRILL_HOLES: Params[] = [3, 4, 5, 6, 8, 10].map((d, i) => ({
  id: `bit-${d}mm`,
  shape: 'circle',
  x: 12 + i * 20 - (d + 1) / 2,
  y: 19.5 - (d + 1) / 2,
  width: d + 1,
  depth: d + 1,
  cutDepth: 20,
  rotation: 0,
  cornerRadius: 0,
  label: `${d} mm`,
  groupId: null,
}));

const variant: Shot = {
  id: 'designer-save-and-reuse-variant',
  kind: 'still',
  async take(s) {
    const [parent] = await seedLibrary(s, [
      {
        name: 'Drill bit holder',
        params: {
          width: 3,
          depth: 1,
          height: 4,
          style: 'solid',
          base: { solid: true },
          cutouts: DRILL_HOLES,
        },
      },
    ]);
    if (!parent) throw new Error('no parent design');
    const child = await s.page.evaluate(async (parentId) => {
      const storage = (await import(
        '/src/features/bin-designer/storage/DesignerStorage.ts' as string
      )) as {
        createVariant(
          id: string,
          name: string,
          overrides: object
        ): Promise<{ ok: boolean; value?: { id: string } }>;
      };
      const res = await storage.createVariant(parentId, 'Drill bit holder, 4 wide', {
        dimensions: { width: 4 },
      });
      if (!res.ok || !res.value) throw new Error('could not create the variant');
      return res.value.id;
    }, parent);
    await openDesign(s, child);
    const heading = s.page.getByText(label('binDesigner.variants.label'), { exact: true }).first();
    const detach = s.page.getByRole('button', { name: label('binDesigner.variants.detach') });
    await s.ui.preReveal(heading);
    // A claimed row wider than the panel cuts off its value and buttons;
    // fail rather than publish that.
    const overflow = await detach.evaluate((el) => {
      let n = el.parentElement;
      while (n && !/(auto|scroll)/.test(getComputedStyle(n).overflowY)) n = n.parentElement;
      return n ? n.scrollWidth - n.clientWidth : 0;
    });
    if (overflow > 0)
      throw new Error(`the claimed width row is ${overflow} px wider than the panel`);
    const top = (await s.box(heading)).y - 14;
    const bottom = await s.box(detach);
    await s.still(
      { x: 0, y: top, width: PANEL.width, height: bottom.y + bottom.height + 14 - top },
      1.5
    );
  },
};

/**
 * The shot picks a slot so the Knife section shows, and zooms the board out a
 * step so the whole block fits beside the inspector.
 */
const knifeBlock: Shot = {
  id: 'designer-special-bins-knife-block',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Knife drawer', {});
    const page = s.page;
    await page
      .getByRole('button', { name: new RegExp(`^${label('binExamples.sidebarEntry')}`) })
      .click({ force: true });
    const examples = page.getByRole('tab', { name: label('binExamples.gallery.tabs.examples') });
    await s.until(examples);
    await examples.click({ force: true });
    const knives = page.getByRole('tab', { name: label('binExamples.technique.knifeSlots') });
    await s.until(knives);
    await knives.click({ force: true });
    const card = page.getByRole('heading', {
      name: label('binExamples.knifeBlockChefTrio.name'),
      exact: true,
    });
    await s.until(card);
    await card.click({ force: true });
    const use = page.getByRole('button', { name: label('binExamples.useAsNewDesign') });
    await s.until(use);
    await use.click({ force: true });
    await s.ui.waitBuilt();
    await s.dismissToasts();

    await s.ui.preClick(
      page.getByRole('button', { name: new RegExp(`^${label('binDesigner.editCutouts')}`) })
    );
    const gotIt = page.getByRole('button', {
      name: label('binDesigner.cutoutEditor.quickstart.dismiss'),
    });
    await s.until(gotIt);
    await gotIt.click({ force: true });
    await page
      .getByRole('button', { name: label('binDesigner.cutoutEditor.zoomOut') })
      .click({ force: true });
    await s.ui.warm(20);
    const shapes = page.getByRole('tab', { name: label('binDesigner.shapeList.tabShapes') });
    await shapes.click({ force: true });
    const slots = page.getByRole('button', {
      name: new RegExp(`^${label('binDesigner.cutouts.addKnifeSlot')} \\d`),
    });
    await s.until(slots.nth(1));
    await slots.nth(1).click({ force: true });
    await page
      .getByRole('tab', { name: label('binDesigner.shapeList.tabProperties') })
      .click({ force: true });
    const knife = page
      .getByRole('button', { name: label('binDesigner.cutouts.section.knife'), exact: true })
      .first();
    await s.until(knife);
    await page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    // The board sits centred in its area; the inspector scrolls so the Knife
    // section starts level with the top of the block.
    const [board, preview] = await page.locator('canvas').evaluateAll((els) => {
      const boxes = els.map((e) => e.getBoundingClientRect());
      const left = boxes.find((b) => b.left < 100);
      const right = boxes.find((b) => b.left >= 100);
      return [
        left ? { y: left.y, height: left.height } : null,
        right ? { x: right.x } : null,
      ] as const;
    });
    if (!board || !preview) throw new Error('no cut editor board beside the preview');
    const boardMiddle = board.y + board.height / 2;
    await knife.evaluate((el, y) => {
      let n = el.parentElement;
      while (
        n &&
        !(
          n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)
        )
      )
        n = n.parentElement;
      if (n) n.scrollTop += el.getBoundingClientRect().y - y;
    }, boardMiddle - 90);
    await s.ui.warm(20);
    const heading = await s.box(knife);
    const handleSide = await s.box(
      page.getByRole('button', {
        name: label('common.aboutLabel', { label: label('binDesigner.cutouts.knifeOpenEnd') }),
      })
    );
    const top = heading.y - 24;
    await s.still({ x: 0, y: top, width: preview.x, height: handleSide.y + 70 - top });
  },
};

const stepper = (s: DocsSession, what: string, dir: 'increaseAria' | 'decreaseAria'): Locator =>
  s.page.getByRole('button', { name: label(`common.${dir}`, { what }) }).first();

const radio = (s: DocsSession, key: Parameters<typeof label>[0]): Locator =>
  s.page.getByRole('radio', { name: label(key), exact: true }).first();

const heading = (s: DocsSession, key: Parameters<typeof label>[0]): Locator =>
  s.page.getByText(label(key), { exact: true }).first();

async function frameFrom(s: DocsSession, target: Locator, above = 14): Promise<Rect> {
  return panelFrame((await s.box(target)).y - above);
}

async function bringUp(s: DocsSession, target: Locator, area: Rect, margin = 14): Promise<void> {
  const b = await s.box(target);
  const dy = b.y + b.height + margin - (area.y + area.height);
  if (dy > 0) await scrollBy(s, target, dy);
}

async function closeUpTake(s: DocsSession, area: Rect, act: () => Promise<void>): Promise<void> {
  await s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.9);
  await s.take(area, act, CLIP_WIDTH / area.width);
}

async function partTake(s: DocsSession, seconds: number, poster = false): Promise<void> {
  // A hovered overhang row tints its side of the part, so the pointer leaves the panel.
  await s.ui.park(PANEL.width + 24, DESKTOP.height - 24);
  await s.take(await partFrame(s), async () => {
    if (poster) s.poster();
    await s.ui.hold(seconds);
  });
}

const halfGrid: Shot = {
  id: 'designer-size-and-shape-half-grid',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Hex key holder', { width: 2, depth: 2, height: 3 });
    const sw = toggle(s, 'binDesigner.halfBinMode');
    const narrower = stepper(s, label('common.width'), 'decreaseAria');
    const left = s.page.getByTitle(label('sidebar.halfBinLeft'));
    // From below the height stepper to the custom shape row, so no row is cut.
    const above = await s.box(stepper(s, label('common.height'), 'increaseAria'));
    const below = await s.box(toggle(s, 'binDesigner.shape.customShape'));
    const top = above.y + above.height + 2;
    const height = below.y + below.height + 2 - top;
    const switchArea: Rect = {
      x: (PANEL.width - (height * 4) / 3) / 2,
      y: top,
      width: (height * 4) / 3,
      height,
    };
    // Ends above the height label that the edge choice pushes down.
    const sizeArea = await frameFrom(s, heading(s, 'binDesigner.dimensions'), 3);
    await s.ui.park(switchArea.x + switchArea.width * 0.6, switchArea.y + switchArea.height * 0.85);
    await s.take(
      switchArea,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(sw);
        await s.ui.hold(0.6);
      },
      CLIP_WIDTH / switchArea.width
    );
    await s.ui.park(sizeArea.x + sizeArea.width * 0.6, sizeArea.y + sizeArea.height * 0.6);
    await s.take(sizeArea, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(narrower);
      await s.ui.hold(0.8);
      await s.ui.click(left);
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await orbitBelow(s);
    await partTake(s, 2, true);
  },
};

const overhang: Shot = {
  id: 'designer-size-and-shape-overhang',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Drawer edge tray', { width: 2, depth: 2, height: 3 });
    const sw = toggle(s, 'binDesigner.overhang.title');
    const right = s.page.getByRole('button', {
      name: new RegExp(`^${label('binDesigner.overhang.side.right')}: `),
    });
    const feet = toggle(s, 'binDesigner.overhang.feet');
    await s.ui.preReveal(sw);
    const area = await frameFrom(s, sw);
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(sw);
      await s.ui.hold(0.5);
      await s.ui.click(right);
      await s.ui.hold(0.2);
      await s.type('21');
      await s.keys('Enter');
      await s.ui.hold(0.5);
    });
    await s.ui.hideCursor();
    await partTake(s, 1.4);
    await s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.9);
    await s.take(area, async () => {
      await s.ui.hold(0.2);
      await bringUp(s, feet, area);
      await s.ui.click(feet);
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await orbitBelow(s);
    await partTake(s, 2, true);
  },
};

const bodyType: Shot = {
  id: 'designer-size-and-shape-body-type',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screw bin', {});
    const note = s.page.getByText(label('binDesigner.base.bodyType.standard.description'), {
      exact: true,
    });
    await s.ui.preReveal(note);
    const top = (await s.box(heading(s, 'binDesigner.base.bodyType'))).y - 14;
    const end = await s.box(note);
    await s.still({ x: 0, y: top, width: PANEL.width, height: end.y + end.height + 14 - top }, 1.5);
  },
};

const lidNeedsLip: Shot = {
  id: 'designer-lids-needs-stacking-lip',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Screw bin', { base: { stackingLip: false } });
    const fix = s.page.getByRole('button', {
      name: label('binDesigner.dependency.enableStackingLip'),
    });
    await s.ui.preReveal(fix);
    const top =
      (
        await s.box(
          s.page.getByRole('heading', { name: label('binDesigner.group.lid'), exact: true })
        )
      ).y - 4;
    const end = await s.box(fix);
    await s.still({ x: 0, y: top, width: PANEL.width, height: end.y + end.height + 16 - top }, 1.5);
  },
};

const lidTopSurface: Shot = {
  id: 'designer-lids-top-surface',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Screw bin', { width: 2, depth: 2, height: 3, lid: { enabled: true } });
    const title = heading(s, 'binDesigner.lid.section.topSurface');
    await s.ui.preReveal(title);
    const area = await frameFrom(s, title);
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(radio(s, 'binDesigner.lid.topSurface.stackable'));
      await s.ui.hold(0.7);
    });
    await s.ui.hideCursor();
    await partTake(s, 1.6);
    await s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.9);
    await s.take(area, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(radio(s, 'binDesigner.lid.topSurface.tray'));
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await partTake(s, 2, true);
  },
};

async function lidSlider(s: DocsSession): Promise<{ track: Rect; thumbY: number }> {
  const input = s.page.getByRole('slider', {
    name: label('binDesigner.preview.lidExplodeSlider'),
  });
  return input.evaluate((el) => {
    const i = el as HTMLInputElement;
    let track = i.parentElement;
    while (track && track.getBoundingClientRect().height < 100) track = track.parentElement;
    if (!track) throw new Error('no slider track');
    const r = track.getBoundingClientRect();
    const f = (Number(i.value) - Number(i.min)) / (Number(i.max) - Number(i.min));
    return {
      track: { x: r.x, y: r.y, width: r.width, height: r.height },
      thumbY: r.bottom - f * r.height,
    };
  });
}

const lidSliding: Shot = {
  id: 'designer-lids-sliding',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'SD card box', { width: 2, depth: 2, height: 3, lid: { enabled: true } });
    const title = heading(s, 'binDesigner.lid.section.attaches');
    await s.ui.preReveal(title);
    const area = await frameFrom(s, title);
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(radio(s, 'binDesigner.lid.attachment.slide'));
      await s.ui.hold(0.6);
      // Room below Click shut for the span readout under it.
      await bringUp(s, toggle(s, 'binDesigner.lid.slide.detent'), area, 44);
      await s.ui.hold(1.2);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    const canvas = await s.box(s.page.locator('canvas').first());
    const { track, thumbY } = await lidSlider(s);
    const view = frameAround(union(await partBox(s), track), 24, 4 / 3, canvas);
    const x = track.x + track.width / 2;
    await s.ui.park(x - 60, thumbY + 40);
    await s.take(view, async () => {
      await s.ui.hold(0.6);
      // Closed, then back out to where it started, which is the part that `view` frames.
      await s.ui.drag([x, thumbY], [x, track.y + track.height - 2], 20);
      await s.ui.hold(0.5);
      await s.ui.drag([x, track.y + track.height - 2], [x, thumbY], 20);
      await s.ui.moveTo(x - 60, thumbY + 40);
      s.poster();
      await s.ui.hold(1.6);
    });
  },
};

const roundRim: Shot = {
  id: 'designer-stacking-round-rim',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Parts tray', { width: 2, depth: 2, height: 3 });
    const title = heading(s, 'binDesigner.base.section.stacking');
    const lip = toggle(s, 'assembledHeight.stackingLip');
    const rim = toggle(s, 'binDesigner.base.rimFillet');
    await s.ui.preReveal(lip);
    const area = await frameFrom(s, title);
    await s.ui.hideCursor();
    await zoomPreview(s, 6);
    const rimView = async (): Promise<Rect> =>
      frameAround(await partBox(s), 20, 4 / 3, await belowToolbar(s));
    const withLip = await rimView();
    await s.take(withLip, () => s.ui.hold(1), CLIP_WIDTH / withLip.width);
    await s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.9);
    await s.take(area, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(lip);
      await s.ui.hold(0.7);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.ui.park(PANEL.width + 24, DESKTOP.height - 24);
    await s.ui.hideCursor();
    await s.take(await rimView(), () => s.ui.hold(1.4));
    // A 0.4 mm round does not show at this scale, so the clip ends on its controls.
    await s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.9);
    await s.take(area, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(rim);
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const nesting: Shot = {
  id: 'designer-stacking-nesting',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Stacking box', { width: 2, depth: 2, height: 6 });
    const tile = radio(s, 'binDesigner.base.bodyType.nesting');
    const magnets = toggle(s, 'binDesigner.base.magnetHoles');
    await s.ui.preReveal(tile);
    const area = await frameFrom(s, heading(s, 'binDesigner.base.bodyType'));
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(tile);
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await partTake(s, 1.4);
    await s.ui.park(area.x + area.width * 0.62, area.y + area.height * 0.9);
    await s.take(area, async () => {
      await s.ui.hold(0.2);
      // Room below the switch for the magnet size line it adds.
      await bringUp(s, magnets, area, 44);
      await s.ui.click(magnets);
      await s.ui.hold(0.7);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await orbitBelow(s);
    await partTake(s, 2, true);
  },
};

const wallCutouts: Shot = {
  id: 'designer-walls-cutouts',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Cable tray', { width: 2, depth: 2, height: 4 });
    const sw = toggle(s, 'binDesigner.wallCutouts');
    await s.ui.preReveal(sw);
    const area = await frameFrom(s, sw);
    const walls = (side: 'front'): Locator =>
      s.page.getByRole('switch', { name: label(`binDesigner.wallCutouts.${side}`), exact: true });
    const deeper = stepper(s, label('binDesigner.wallCutouts.heightPercentAria'), 'increaseAria');
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(sw);
      await s.ui.hold(0.5);
      await s.ui.click(
        s.page.getByRole('button', {
          name: label('binDesigner.wallCutouts.shape.scoop'),
          exact: true,
        })
      );
      await s.ui.hold(0.3);
      await s.ui.click(walls('front').first());
      await s.ui.hold(0.3);
      await bringUp(s, deeper, area);
      for (let i = 0; i < 2; i++) {
        await s.ui.click(deeper);
        await s.ui.hold(0.15);
      }
      await s.ui.hold(0.5);
    });
    await s.ui.hideCursor();
    await partTake(s, 2, true);
  },
};

const handles: Shot = {
  id: 'designer-walls-handles',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Tool tote', { width: 3, depth: 2, height: 6 });
    const sw = toggle(s, 'binDesigner.handles');
    await s.ui.preReveal(sw);
    // From the pull tab above, which gains a note when the handles turn on.
    const area = await frameFrom(s, toggle(s, 'binDesigner.pullTab.title'));
    const front = s.page
      .getByRole('switch', { name: label('binDesigner.handles.front'), exact: true })
      .first();
    const taller = stepper(s, label('binDesigner.handles.heightAria'), 'increaseAria');
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(sw);
      await s.ui.hold(0.5);
      await s.ui.click(
        s.page.getByRole('button', { name: label('binDesigner.handles.shape.oval'), exact: true })
      );
      await s.ui.hold(0.3);
      await bringUp(s, front, area);
      await s.ui.click(front);
      await s.ui.hold(0.3);
      await bringUp(s, taller, area);
      for (let i = 0; i < 2; i++) {
        await s.ui.click(taller);
        await s.ui.hold(0.15);
      }
      await s.ui.hold(0.5);
    });
    await s.ui.hideCursor();
    await partTake(s, 2, true);
  },
};

const labelSlots: Shot = {
  id: 'designer-walls-label-slots',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Spare parts', { width: 3, depth: 2, height: 6 });
    const sw = toggle(s, 'binDesigner.walls.labelSlots.heading');
    await s.ui.preReveal(sw);
    const area = await frameFrom(s, sw);
    const sides = s.page.getByRole('group', { name: label('binDesigner.walls.labelSlots.sides') });
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(sw);
      await s.ui.hold(0.6);
      await s.ui.click(
        // The right wall faces the camera, so its new slots show in the preview.
        sides.getByRole('switch', { name: label('binDesigner.lid.side.right'), exact: true })
      );
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await partTake(s, 2, true);
  },
};

async function knifeExample(s: DocsSession): Promise<void> {
  await openDesigner(s, 'Knife drawer', {});
  const page = s.page;
  await page
    .getByRole('button', { name: new RegExp(`^${label('binExamples.sidebarEntry')}`) })
    .click({ force: true });
  const examples = page.getByRole('tab', { name: label('binExamples.gallery.tabs.examples') });
  await s.until(examples);
  await examples.click({ force: true });
  const knives = page.getByRole('tab', { name: label('binExamples.technique.knifeSlots') });
  await s.until(knives);
  await knives.click({ force: true });
  const card = page.getByRole('heading', {
    name: label('binExamples.knifeBlockChefTrio.name'),
    exact: true,
  });
  await s.until(card);
  await card.click({ force: true });
  const use = page.getByRole('button', { name: label('binExamples.useAsNewDesign') });
  await s.until(use);
  await use.click({ force: true });
  await s.ui.waitBuilt();
  await s.dismissToasts();
}

const handleRest: Shot = {
  id: 'designer-special-bins-handle-rest',
  kind: 'clip',
  async take(s) {
    await knifeExample(s);
    const sw = toggle(s, 'binDesigner.knifeRest.title');
    await s.ui.preClick(sw);
    await s.ui.waitBuilt();
    await s.dismissToasts();
    const area = await frameFrom(s, sw);
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(sw);
      await s.ui.hold(0.8);
    });
    await s.ui.hideCursor();
    await partTake(s, 1.6);
    // Between the gap and depth steppers, clear of the Base header below.
    await s.ui.park(area.x + area.width * 0.45, area.y + area.height * 0.6);
    await s.take(area, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(radio(s, 'binDesigner.knifeRest.style.integrated'));
      await s.ui.hold(0.6);
    });
    await s.ui.hideCursor();
    await partTake(s, 2, true);
  },
};

/**
 * The screen box of every built mesh with at least `minTriangles`, like
 * partBox. The sliding tray is a plain box of a few dozen triangles, below
 * partBox's cut for text and overlays, so partBox frames the bin without it.
 */
async function meshBox(s: DocsSession, minTriangles: number): Promise<Rect> {
  return s.page.evaluate((min) => {
    type V = { x: number; y: number; z: number };
    type P = V & {
      set(x: number, y: number, z: number): P;
      applyMatrix4(m: unknown): P;
      project(c: unknown): P;
      clone(): P;
    };
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
        boundingBox: { min: V; max: V } | null;
      };
      traverse(fn: (o: Obj) => void): void;
      updateMatrixWorld(force: boolean): void;
    };
    const w = window as unknown as { __observed: Obj[]; __docsCamera?: { position: P } };
    const camera = w.__docsCamera;
    const canvas = document.querySelector('canvas');
    if (!camera || !canvas) throw new Error('the preview never rendered');
    const r = canvas.getBoundingClientRect();
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const scene of w.__observed) {
      if (!scene.isScene) continue;
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        for (let p: Obj | null = o; p; p = p.parent) if (!p.visible) return;
        const g = o.geometry;
        if ((g.index?.count ?? g.attributes.position?.count ?? 0) / 3 < min) return;
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
    if (!Number.isFinite(x0)) throw new Error('no built part in the preview');
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }, minTriangles);
}

const slidingTray: Shot = {
  id: 'designer-special-bins-sliding-tray',
  kind: 'clip',
  storage: {
    'gridfinity-labs-v1': JSON.stringify({ enabledFeatures: { sliding_tray: true } }),
  },
  async take(s) {
    await openDesigner(s, 'Bit tray', { width: 2, depth: 2, height: 6 });
    const sw = toggle(s, 'binDesigner.slideTray.title');
    await s.ui.preReveal(sw);
    const area = await frameFrom(s, sw);
    await closeUpTake(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(sw);
      await s.ui.hold(1.2);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    const canvas = await s.box(s.page.locator('canvas').first());
    await s.take(frameAround(await meshBox(s, 20), 40, 4 / 3, canvas), async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const WINDOW: Rect = { x: 0, y: 0, ...DESKTOP };

function windowOf(s: DocsSession): Rect {
  return { x: 0, y: 0, ...(s.page.viewportSize() ?? DESKTOP) };
}

interface SeededVersion {
  name: string;
  params: Params;
  pinned?: boolean;
}

async function seedVersions(s: DocsSession, versions: readonly SeededVersion[]): Promise<void> {
  // Polled like seedLibrary: the thumbnail renders wait on the stepped clock.
  await s.page.evaluate((list) => {
    const w = window as unknown as Seeding;
    w.__seed = {};
    const run = async (): Promise<string[]> => {
      type Res<T> = { ok: boolean; value?: T; error?: unknown };
      const storage = (await import(
        '/src/features/bin-designer/storage/DesignerStorage.ts' as string
      )) as { getActiveDesignId(): string | null };
      const service = (await import(
        '/src/features/bin-designer/storage/DesignVersionService.ts' as string
      )) as {
        createDesignVersion(
          id: string,
          name: string,
          content: object,
          thumbnail: string | null
        ): Promise<Res<{ version: { id: string } }>>;
        setDesignVersionPinned(id: string, pinned: boolean): Promise<Res<unknown>>;
      };
      const { regenerateThumbnail } = (await import(
        '/src/features/bin-designer/utils/thumbnailRegenerator.ts' as string
      )) as { regenerateThumbnail(params: Params): Promise<string | null> };
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
      const id = storage.getActiveDesignId();
      if (!id) throw new Error('no open design');
      const made: string[] = [];
      for (const v of list) {
        const params = deepMerge(DEFAULT_BIN_PARAMS, v.params) as Params;
        let thumbnail: string | null = null;
        for (let i = 0; i < 3 && !thumbnail; i++) thumbnail = await regenerateThumbnail(params);
        if (!thumbnail) throw new Error(`no thumbnail for ${v.name}`);
        const res = await service.createDesignVersion(
          id,
          v.name,
          { name: v.name, params },
          thumbnail
        );
        if (!res.ok || !res.value) throw new Error(`could not save ${v.name}`);
        if (v.pinned) await service.setDesignVersionPinned(res.value.version.id, true);
        made.push(res.value.version.id);
      }
      return made;
    };
    run().then(
      (ids) => (w.__seed = { ids }),
      (e: unknown) => (w.__seed = { error: String(e) })
    );
  }, versions);
  for (let i = 0; ; i++) {
    const state = await s.page.evaluate(() => (window as unknown as Seeding).__seed ?? {});
    if (state.error) throw new Error(state.error);
    if (state.ids) return;
    if (i >= 900) throw new Error('the versions did not finish saving');
    await s.ui.warm(4);
    await s.page.waitForTimeout(100);
  }
}

const CADDY: Params = { width: 2, depth: 2, height: 4, compartments: cells(4, 2) };

const versions: Shot = {
  id: 'designer-save-and-reuse-versions',
  kind: 'clip',
  async take(s) {
    await seedLibrary(s, [{ name: 'Battery caddy', params: CADDY }]);
    await seedVersions(s, [
      {
        name: 'First print',
        params: { ...CADDY, compartments: cells(2, 2) },
        pinned: true,
      },
      { name: 'Four cells a row', params: CADDY },
    ]);
    const page = s.page;
    const open = page.getByRole('button', { name: label('binDesigner.versions.open') });
    const save = page.getByRole('button', { name: label('binDesigner.versions.save') });
    const confirm = page.getByRole('button', {
      name: label('binDesigner.versions.confirmSave'),
      exact: true,
    });
    const dialog = page.getByRole('dialog').first();
    // Off camera, opened once in its naming state to frame the shot on it.
    await open.click({ force: true });
    await s.until(save);
    await save.click({ force: true });
    await s.ui.warm(20);
    const naming = await s.box(dialog);
    await page.getByRole('button', { name: label('binDesigner.versions.cancel') }).click({
      force: true,
    });
    await page.keyboard.press('Escape');
    await s.ui.warm(30);
    await s.dismissToasts();
    // The closed dialog hands focus back to its trigger, which would show a focus ring.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const button = await s.box(open);
    // Ends in the gap before the language menu, so no header control is cut in half.
    const header: Rect = { x: button.x + button.width + 6 - 500, y: 0, width: 500, height: 375 };
    // Room below for the version the clip adds.
    const list = frameAround({ ...naming, height: naming.height + 70 }, 20, 4 / 3, WINDOW);
    await s.ui.park(header.x + header.width * 0.7, header.y + header.height * 0.6);
    await s.take(
      header,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(open);
        await s.ui.hold(0.3);
      },
      CLIP_WIDTH / header.width
    );
    await s.until(save);
    await s.ui.park(list.x + list.width * 0.75, list.y + list.height * 0.85);
    await s.take(list, async () => {
      await s.ui.hold(0.5);
      await s.ui.click(save);
      await s.ui.hold(0.3);
      await s.type('0.2 mm clearance');
      await s.ui.hold(0.2);
      await s.ui.click(confirm);
      await s.ui.hold(0.3);
      await s.ui.moveTo(list.x + list.width * 0.75, list.y + list.height * 0.9);
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const examples: Shot = {
  id: 'designer-save-and-reuse-examples',
  kind: 'clip',
  async take(s) {
    // The dev server has no community API. Left unanswered, the Community tab
    // the gallery opens on shows its loading state rather than an error.
    await s.page.route(
      (url) => url.pathname === '/api/community',
      () => undefined
    );
    await openDesigner(s, 'Screw bin', {});
    const page = s.page;
    const entry = page
      .getByRole('button', { name: new RegExp(`^${label('binExamples.sidebarEntry')}`) })
      .first();
    const start = panelFrame((await s.box(entry)).y - 50);
    await s.ui.park(start.x + start.width * 0.6, start.y + start.height * 0.85);
    await s.take(
      start,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(entry);
        await s.ui.hold(0.3);
      },
      CLIP_WIDTH / start.width
    );
    const tab = page.getByRole('tab', { name: label('binExamples.gallery.tabs.examples') });
    await s.until(tab);
    const gallery = await s.box(page.getByRole('dialog').first());
    const tabs = union(
      await s.box(tab),
      await s.box(page.getByRole('tab', { name: label('binExamples.gallery.tabs.community') }))
    );
    const header: Rect = {
      x: Math.min(tabs.x + tabs.width + 80, gallery.x + gallery.width) - 640,
      y: gallery.y,
      width: 640,
      height: 480,
    };
    await s.ui.park(header.x + header.width * 0.5, header.y + header.height * 0.7);
    await s.take(header, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(tab);
      await s.ui.hold(0.5);
    });
    const search = page.getByPlaceholder(label('binExamples.searchPlaceholder'));
    await s.until(search, 90000);
    // The gallery is wider than a readable crop, so the shot searches in its left part.
    const grid: Rect = { x: gallery.x, y: gallery.y, width: 640, height: 480 };
    const card = page.getByRole('heading', {
      name: label('binExamples.heroHoneycombCaddy.name'),
      exact: true,
    });
    await s.ui.park(grid.x + grid.width * 0.5, grid.y + grid.height * 0.85);
    await s.take(grid, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(search);
      await s.type('honeycomb');
      await s.ui.hold(0.6);
      await s.ui.click(card);
      await s.ui.hold(0.3);
    });
    const use = page.getByRole('button', { name: label('binExamples.useAsNewDesign') });
    await s.until(use);
    await s.page.waitForTimeout(1500);
    await s.ui.warm(40);
    const detail = page.getByRole('dialog').filter({ has: use }).last();
    const card3d = frameAround(await s.box(detail), 16, 4 / 3, WINDOW);
    const view = await s.box(detail.locator('canvas').first());
    const mid: [number, number] = [view.x + view.width / 2, view.y + view.height / 2];
    await s.ui.park(mid[0] + 80, mid[1] + 60);
    await s.take(card3d, async () => {
      await s.ui.hold(0.4);
      await s.ui.drag([mid[0] - 60, mid[1]], [mid[0] + 90, mid[1] - 10], 30);
      await s.ui.hold(0.6);
      await s.ui.click(use);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.dismissToasts();
    await partTake(s, 2, true);
  },
};

/** Room at the right of the drawer for the placed bin. */
const DESK_DRAWER: FixtureLayout = {
  name: 'Desk drawer',
  width: 6,
  depth: 4,
  height: 8,
  bins: [
    { x: 0, y: 0, w: 2, d: 2, h: 3, label: 'Pens', cat: 'Sky' },
    { x: 2, y: 0, w: 2, d: 1, h: 3, label: 'USB sticks' },
    { x: 2, y: 1, w: 2, d: 1, h: 3, label: 'Erasers' },
    { x: 0, y: 2, w: 4, d: 2, h: 3, label: 'Notepads', cat: 'Green' },
  ],
};

async function libraryMenuFrame(s: DocsSession, name: string): Promise<Rect> {
  const page = s.page;
  const menuButton = page.getByRole('button', {
    name: label('binDesigner.moreActionsForDesign', { name }),
  });
  const openList = async (): Promise<void> => {
    await page
      .getByRole('button', { name: label('binDesigner.openDesignList') })
      .click({ force: true });
    await s.until(menuButton);
    await page.waitForTimeout(800);
    await s.ui.warm(20);
  };
  await openList();
  await s.ui.preClick(menuButton);
  await s.ui.warm(20);
  const menu = await s.box(page.getByRole('menu').first());
  const card = await menuButton.evaluate((el) => {
    let n = el.parentElement;
    while (n && n.getBoundingClientRect().height < 150) n = n.parentElement;
    const r = (n ?? el).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  // Escape closes the menu and the dialog with it, so the list opens again.
  await page.keyboard.press('Escape');
  await s.ui.warm(20);
  if (!(await menuButton.isVisible())) await openList();
  await s.ui.hideCursor();
  return frameAround(union(menu, card), 24, 4 / 3, windowOf(s));
}

/** Clicks a menu item where it sits: ui.click would first sweep to the middle of the scrolling menu. */
async function clickMenuItem(s: DocsSession, name: string): Promise<void> {
  const item = await s.box(s.page.getByRole('menuitem', { name }));
  await s.ui.clickAt(item.x + item.width / 2, item.y + item.height / 2);
}

const placeInLayout: Shot = {
  id: 'designer-save-and-reuse-place-in-layout',
  kind: 'clip',
  viewport: LIBRARY_VIEW,
  async take(s) {
    await seedLibrary(s, LIBRARY);
    await s.importLayouts([layoutFile(DESK_DRAWER)], designerReady);
    await s.ui.waitBuilt();
    const area = await libraryMenuFrame(s, 'Battery caddy');
    const page = s.page;
    const menuButton = page.getByRole('button', {
      name: label('binDesigner.moreActionsForDesign', { name: 'Battery caddy' }),
    });
    await s.ui.park(area.x + area.width * 0.3, area.y + area.height * 0.85);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(menuButton);
        await s.ui.hold(0.6);
        await clickMenuItem(s, label('binDesigner.placeInLayout.action'));
      },
      CLIP_WIDTH / area.width
    );
    await s.ui.hideCursor();
    const placed = page.locator('[data-bin-id]', { hasText: 'Battery caddy' }).first();
    await s.until(placed);
    await page.waitForTimeout(800);
    await s.ui.warm(30);
    const view = windowOf(s);
    const grid = pad(await gridArea(s, DESK_DRAWER.width, DESK_DRAWER.depth), 16, view);
    await s.take(frameAround(grid, 0, 4 / 3, view), async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const createVariant: Shot = {
  id: 'designer-save-and-reuse-create-variant',
  kind: 'clip',
  viewport: LIBRARY_VIEW,
  async take(s) {
    await seedLibrary(s, [
      {
        name: 'Drill bit holder',
        params: {
          width: 3,
          depth: 1,
          height: 4,
          style: 'solid',
          base: { solid: true },
          cutouts: DRILL_HOLES,
        },
      },
      ...LIBRARY.slice(0, 4),
    ]);
    const area = await libraryMenuFrame(s, 'Drill bit holder');
    const page = s.page;
    const menuButton = page.getByRole('button', {
      name: label('binDesigner.moreActionsForDesign', { name: 'Drill bit holder' }),
    });
    await s.ui.park(area.x + area.width * 0.3, area.y + area.height * 0.85);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(menuButton);
        await s.ui.hold(0.6);
        await clickMenuItem(s, label('binDesigner.variants.create'));
      },
      CLIP_WIDTH / area.width
    );
    await s.ui.hideCursor();
    const title = page.getByText(label('binDesigner.variants.label'), { exact: true }).first();
    await s.until(title);
    await s.ui.waitBuilt();
    await s.dismissToasts();
    const claim = page.getByRole('button', { name: label('binDesigner.variants.claim') });
    const overflow = await claim.first().evaluate((el) => {
      let n = el.parentElement;
      while (n && !/(auto|scroll)/.test(getComputedStyle(n).overflowY)) n = n.parentElement;
      return n ? n.scrollWidth - n.clientWidth : 0;
    });
    if (overflow > 0) throw new Error(`the variant section is ${overflow} px wider than the panel`);
    const panel = await frameFrom(s, title);
    await s.take(panel, async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

export const DESIGNER_DETAILS: readonly Shot[] = [
  dimensions,
  halfGrid,
  overhang,
  bodyType,
  customShape,
  topRim,
  roundRim,
  nesting,
  drainage,
  wallPattern,
  wallCutouts,
  handles,
  labelSlots,
  slant,
  handleRest,
  slidingTray,
  lidAttachment,
  lidSliding,
  lidTopSurface,
  lidNeedsLip,
  assembledHeight,
  library,
  versions,
  createVariant,
  variant,
  examples,
  placeInLayout,
  knifeBlock,
];
