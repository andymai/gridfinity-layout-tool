import type { Locator } from '@playwright/test';
import { FPS } from '../../feature-tips/encode';
import { layoutFile } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { designerReady, openDesigner, partBox, setDesign } from './apps';
import type { Params } from './apps';

/** The designer's settings panel, below the app header. */
const PANEL: Rect = { x: 0, y: 48, width: 319, height: DESKTOP.height - 48 };
/** Close-ups fill a clip this wide. */
const CLIP_WIDTH = 640;

const toggle = (s: DocsSession, key: Parameters<typeof label>[0]): Locator =>
  s.page.getByRole('switch', { name: label(key), exact: true }).first();

/** A 4:3 crop of the panel's full width from `top`, for a close-up take. */
const panelFrame = (top: number): Rect => ({
  x: PANEL.x,
  y: top,
  width: PANEL.width,
  height: (PANEL.width * 3) / 4,
});

/** A 4:3 crop of the panel around `targets`, for a close-up take. */
async function closeUp(s: DocsSession, ...targets: Locator[]): Promise<Rect> {
  const boxes: Rect[] = [];
  for (const t of targets) boxes.push(await s.box(t));
  return frameAround(union(...boxes), 12, 4 / 3, PANEL);
}

/** Off camera: waits for the exact build, then frames the part in the preview. */
async function partFrame(s: DocsSession): Promise<Rect> {
  await s.ui.hideCursor();
  await s.ui.waitBuilt();
  const canvas = await s.box(s.page.locator('canvas').first());
  return frameAround(await partBox(s), 40, 4 / 3, canvas);
}

/** The result of a close-up: the part, held for the poster. */
async function holdOnPart(s: DocsSession): Promise<void> {
  await s.take(await partFrame(s), async () => {
    s.poster();
    await s.ui.hold(2);
  });
}

/** The Dimensions section, from its heading to the Half-grid mode switch. */
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

/** On camera: eases the scroller around `inside` down by `dy` px, as a person scrolls on a little. */
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

/**
 * Custom shape turned on in close-up, a short scroll to its cell grid, the L
 * preset, then the L-shaped bin it builds. Two units deep, so the presets and
 * the whole grid share one close-up.
 */
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

/** Off camera: turns the preview to a preset view and lets the camera settle. */
async function setView(s: DocsSession, view: keyof typeof VIEWS): Promise<void> {
  await viewButton(s, view).click({ force: true });
  await s.ui.warm(90);
}

/** The preview below its camera toolbar, for a part zoomed in to fill it. */
async function belowToolbar(s: DocsSession): Promise<Rect> {
  const canvas = await s.box(s.page.locator('canvas').first());
  const bar = await s.box(viewButton(s, 'front'));
  const top = bar.y + bar.height + 8;
  return { ...canvas, y: top, height: canvas.y + canvas.height - top };
}

/** Off camera: wheels the preview camera in on the part, `steps` notches. */
async function zoomPreview(s: DocsSession, steps: number): Promise<void> {
  const canvas = await s.box(s.page.locator('canvas').first());
  await s.page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  for (let i = 0; i < steps; i++) {
    await s.page.mouse.wheel(0, -100);
    await s.ui.warm(3);
  }
  await s.ui.warm(60);
}

/** Rounded lip peak and lip notches picked in close-up, then the notched rim up close. */
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

/**
 * Off camera: drags the preview up until the camera looks at the part from
 * below, as a person turns it over to check the underside.
 */
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
 * Drainage holes turned on in close-up, then the bin turned over to show them
 * through the feet. The switch adds a note to Lightweight floor, higher in the
 * panel; on a shorter window that note is above the visible part of the panel,
 * so the browser keeps the switch in place as the panel grows.
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

/**
 * Honeycomb picked in close-up, a scroll to the wall picker, three walls
 * turned off, then the bin from the front with the pattern on that wall alone.
 */
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

/**
 * Slant turned on and set to 30 degrees in close-up, a short scroll, End
 * support on, then the bin from the side, leaning back onto its wedge.
 */
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

/**
 * The lid turned on in close-up, the click-rail lid it starts with, then
 * Hinged picked and the lid standing open on its hinge.
 */
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
    // From the group title down to the attachment choices, which end just inside the frame.
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

/** A drawer measured 62 mm tall inside, so the readout has a fit line to report. */
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

/**
 * Off camera: saves `designs` through the library's own save path, removes
 * every other design, renders each thumbnail with the regenerator the
 * designer's boot pass uses, and reloads the designer on the first one.
 * Returns the new ids in order.
 */
async function seedLibrary(s: DocsSession, designs: readonly LibraryDesign[]): Promise<string[]> {
  await s.open('/designer', designerReady);
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
        const thumbnail = await regenerateThumbnail(res.value.params ?? {});
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

/** Off camera: reloads the designer on saved design `id`. */
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

/** Compartment ids for a cols x rows grid with no merged cells. */
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

/** A row of round holes for drill bits, 3 to 10 mm, in a solid 3 x 1 bin. */
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
    // The storage call behind the library's Create variant, with the width already claimed.
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
 * The Knife Block example from the gallery, in the cut editor, with its
 * middle slot picked so the Knife section shows. The board is zoomed out a
 * step, so the whole block fits beside the inspector.
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

/** Shots for the bin designer pages on lids, saved designs, size and shape, special bins, stacking and walls. */
export const DESIGNER_DETAILS: readonly Shot[] = [
  dimensions,
  customShape,
  topRim,
  drainage,
  wallPattern,
  slant,
  lidAttachment,
  assembledHeight,
  library,
  variant,
  knifeBlock,
];
