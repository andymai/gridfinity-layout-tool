import type { Locator } from '@playwright/test';
import { label } from '../labels';
import { DESKTOP, frameAround, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { openDesigner, partBox, setDesign } from './apps';
import type { Params } from './apps';

type Key = Parameters<typeof label>[0];

/** Below the app header. */
const WORKSPACE: Rect = { x: 0, y: 48, width: DESKTOP.width, height: DESKTOP.height - 48 };
const CLOSE_UP_WIDTH = 640;
const MIN_CLOSE_UP = 460;
/** The right edge of the side panel at its default width. */
const PANEL_EDGE = 320;

const toggle = (s: DocsSession, key: Key): Locator =>
  s.page.getByRole('switch', { name: label(key), exact: true }).first();

const texts = (s: DocsSession, key: Key): Locator => s.page.getByText(label(key), { exact: true });

const text = (s: DocsSession, key: Key): Locator => texts(s, key).first();

const customize = (s: DocsSession): Locator =>
  s.page.getByRole('button', { name: label('common.customize'), exact: true });

/** Use it for a control or a heading whose name repeats down the panel. */
async function nearest(
  s: DocsSession,
  candidates: Locator,
  anchor: Locator,
  side: 'below' | 'above' = 'below'
): Promise<Locator> {
  const y = (await s.box(anchor)).y;
  let best: Locator | null = null;
  let bestGap = Infinity;
  for (let i = 0; i < (await candidates.count()); i++) {
    const b = await candidates.nth(i).boundingBox();
    if (!b) continue;
    const gap = side === 'below' ? b.y - y : y - b.y;
    if (gap > 0 && gap < bestGap) {
      bestGap = gap;
      best = candidates.nth(i);
    }
  }
  if (!best) throw new Error(`nothing like ${String(candidates)} ${side} ${String(anchor)}`);
  return best;
}

const below = (s: DocsSession, candidates: Locator, anchor: Locator): Promise<Locator> =>
  nearest(s, candidates, anchor, 'below');

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

type Step = () => Locator | Promise<Locator>;

interface Placed {
  anchor: Locator;
  y: number;
}

/**
 * A take is framed before it starts, so this is how it frames controls that
 * only show once its own clicks have run.
 */
async function dryRun(
  s: DocsSession,
  at: Placed,
  steps: readonly Step[],
  area: () => Promise<Rect>,
  reset: () => Promise<void>
): Promise<Rect> {
  await scrollPanel(s, at.anchor, at.y);
  for (const step of steps) {
    // Actionability waits never settle on a frozen clock.
    await (await step()).click({ force: true });
    await s.ui.warm(12);
  }
  const box = await area();
  await reset();
  await scrollPanel(s, at.anchor, at.y);
  return box;
}

/** A small area is framed wider, so its text is not blown up past the other close-ups. */
async function closeUp(
  s: DocsSession,
  area: Rect,
  act: (frame: Rect) => Promise<void>
): Promise<Rect> {
  const margin = 28;
  const width = Math.max(area.width, MIN_CLOSE_UP - margin * 2);
  const height = Math.max(area.height, (MIN_CLOSE_UP * 3) / 4 - margin * 2);
  const grown = {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height,
  };
  const frame = frameAround(grown, margin, 4 / 3, WORKSPACE);
  // The cursor waits on the preview's empty edge, where it lights up no control.
  const rest = frame.x + frame.width > PANEL_EDGE + 60 ? frame.x + frame.width - 40 : frame.x + 20;
  await s.ui.park(rest, frame.y + frame.height * 0.85);
  await s.take(frame, () => act(frame), CLOSE_UP_WIDTH / frame.width);
  return frame;
}

async function clickThrough(s: DocsSession, steps: readonly Step[], pause = 0.3): Promise<void> {
  for (const step of steps) {
    await s.ui.click(await step());
    await s.ui.hold(pause);
  }
}

/**
 * A drag up lowers the camera, so a negative `dy` looks at the underside; a
 * drag right swings it to the left of the bin.
 */
async function orbit(s: DocsSession, dy: number, dx = 0): Promise<void> {
  const c = await s.box(s.page.locator('canvas').first());
  const x = c.x + c.width * 0.85 - dx / 2;
  const y = c.y + c.height / 2 - dy / 2;
  await s.ui.park(x, y);
  await s.ui.drag([x, y], [x + dx, y + dy], 16);
  await s.ui.hideCursor();
  // The orbit eases out over the next frames.
  await s.ui.warm(60);
}

async function cutToPart(s: DocsSession, hold = 2): Promise<void> {
  await s.ui.hideCursor();
  await s.ui.waitBuilt();
  const canvas = await s.box(s.page.locator('canvas').first());
  await s.take(frameAround(await partBox(s), 40, 4 / 3, canvas), async () => {
    s.poster();
    await s.ui.hold(hold);
  });
}

const MOUNTING_BIN: Params = { width: 3, depth: 3, height: 3 };

const baseMounting: Shot = {
  id: 'designer-base-mounting',
  kind: 'clip',
  async take(s) {
    const name = 'Socket set';
    await openDesigner(s, name, MOUNTING_BIN);
    const heading = text(s, 'binDesigner.base.section.mounting');
    const magnets = toggle(s, 'binDesigner.base.magnetHoles');
    const steps: Step[] = [
      () => magnets,
      () => below(s, customize(s), magnets),
      () => toggle(s, 'binDesigner.base.magnetCrushRibs'),
      () => toggle(s, 'binDesigner.base.cornerHolesOnly'),
    ];
    const area = await dryRun(
      s,
      { anchor: heading, y: 160 },
      steps,
      async () =>
        union(await s.box(heading), await s.box(toggle(s, 'binDesigner.base.cornerHolesOnly'))),
      () => setDesign(s, name, MOUNTING_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps);
      await s.ui.hold(0.3);
    });
    await orbit(s, -240);
    await cutToPart(s);
  },
};

const LIGHTWEIGHT_BIN: Params = { width: 2, depth: 2, height: 3 };

const baseLightweight: Shot = {
  id: 'designer-base-lightweight',
  kind: 'clip',
  async take(s) {
    const name = 'Spare screws';
    await openDesigner(s, name, LIGHTWEIGHT_BIN);
    const lightweight = toggle(s, 'binDesigner.lightweight');
    const heading = await nearest(
      s,
      texts(s, 'binDesigner.base.section.floor'),
      lightweight,
      'above'
    );
    const underside = s.page
      .getByRole('radio', { name: label('binDesigner.lightweightMode.underside'), exact: true })
      .first();
    const steps: Step[] = [
      () => lightweight,
      () => below(s, customize(s), lightweight),
      () => underside,
    ];
    const area = await dryRun(
      s,
      { anchor: heading, y: 300 },
      steps,
      async () => union(await s.box(heading), await s.box(underside)),
      () => setDesign(s, name, LIGHTWEIGHT_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.35);
      await s.ui.hold(0.3);
    });
    await orbit(s, -220);
    await cutToPart(s);
  },
};

const SCOOP_BIN: Params = {
  width: 3,
  depth: 2,
  height: 6,
  compartments: { cols: 3, rows: 1, cells: [0, 1, 2] },
};

const scoop: Shot = {
  id: 'designer-getting-things-out-scoop',
  kind: 'clip',
  async take(s) {
    const name = 'Small parts';
    await openDesigner(s, name, SCOOP_BIN);
    const scoopToggle = toggle(s, 'binDesigner.fingerScoop');
    const caption = text(s, 'binDesigner.fingerScoop');
    const back = s.page
      .getByRole('group', { name: label('binDesigner.scoop.sideAria') })
      .getByRole('switch', { name: label('binDesigner.scoopSideBack'), exact: true });
    const style = (): Promise<Locator> =>
      below(
        s,
        s.page.getByRole('radiogroup', { name: label('binDesigner.scoopStyle'), exact: true }),
        scoopToggle
      );
    const steps: Step[] = [
      () => scoopToggle,
      () => below(s, customize(s), scoopToggle),
      () => back,
    ];
    const area = await dryRun(
      s,
      { anchor: caption, y: 280 },
      steps,
      async () => union(await s.box(caption), await s.box(scoopToggle), await s.box(await style())),
      () => setDesign(s, name, SCOOP_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.35);
      await s.ui.hold(0.3);
    });
    // Higher than the default view, so the ramps on the front wall show too.
    await orbit(s, 110);
    await cutToPart(s);
  },
};

const PULL_TAB_BIN: Params = { width: 3, depth: 2, height: 4 };

const pullTab: Shot = {
  id: 'designer-getting-things-out-pull-tab',
  kind: 'clip',
  async take(s) {
    const name = 'Drill bits';
    await openDesigner(s, name, PULL_TAB_BIN);
    const tabToggle = toggle(s, 'binDesigner.pullTab.title');
    const caption = text(s, 'binDesigner.pullTab.title');
    const walls = s.page.getByRole('group', { name: label('binDesigner.pullTab.sideAria') });
    const back = walls.getByRole('switch', {
      name: label('binDesigner.pullTab.side.back'),
      exact: true,
    });
    const steps: Step[] = [() => tabToggle, () => back];
    const area = await dryRun(
      s,
      { anchor: caption, y: 300 },
      steps,
      async () => union(await s.box(caption), await s.box(tabToggle), await s.box(walls)),
      () => setDesign(s, name, PULL_TAB_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.4);
      await s.ui.hold(0.3);
    });
    await cutToPart(s);
  },
};

const GRID_BIN: Params = {
  width: 4,
  depth: 3,
  height: 6,
  compartments: { cols: 4, rows: 3, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

const compartmentGrid: Shot = {
  id: 'designer-compartments-grid',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Electronics bin', GRID_BIN);
    const hint = text(s, 'binDesigner.compartmentEditor.dragOrClick');
    const grid = s.page
      .getByRole('application', {
        name: label('binDesigner.compartmentGridAria', { cols: 4, rows: 3 }),
      })
      .first();
    await scrollPanel(s, hint, 300);
    const cell = async (col: number): Promise<[number, number]> => {
      // Rows count from the front of the bin, so row 3 is the top of the grid.
      const b = await s.box(
        grid.getByRole('button', {
          name: label('binDesigner.compartmentEditor.cellAria', { col, row: 3 }),
        })
      );
      return [b.x + b.width / 2, b.y + b.height / 2];
    };
    const from = await cell(1);
    const to = await cell(2);
    await closeUp(s, union(await s.box(hint), await s.box(grid)), async (frame) => {
      await s.ui.hold(0.5);
      await s.ui.drag(from, to, 16);
      await s.ui.hold(0.3);
      // Off the grid, so the merged compartment shows whole, not with its hovered half lit.
      await s.ui.moveTo(frame.x + frame.width - 40, frame.y + frame.height * 0.85);
      await s.ui.hold(0.6);
    });
    // Higher than the default view, so the long compartment at the back shows.
    await orbit(s, 100);
    await cutToPart(s);
  },
};

const TAB_BIN: Params = {
  width: 3,
  depth: 1,
  height: 6,
  compartments: { cols: 3, rows: 1, cells: [0, 1, 2] },
  label: { enabled: true },
};

const tabCaption = (s: DocsSession, n: number): Locator =>
  s.page.getByRole('textbox', { name: label('binDesigner.tabEngravedTextAriaLabel', { n }) });

const tabList: Shot = {
  id: 'designer-labels-and-text-tab-list',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Hardware', TAB_BIN);
    const tabs = text(s, 'binDesigner.labelTabs');
    await scrollPanel(s, tabs, 200);
    const area = union(
      await s.box(tabs),
      await s.box(toggle(s, 'binDesigner.labelTabs')),
      await s.box(tabCaption(s, 3))
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(tabCaption(s, 1));
      await s.type('Screws');
      await s.keys('Enter');
      await s.type('Nuts');
      await s.keys('Enter');
      await s.type('Washers');
      await s.ui.hold(0.5);
    });
    // Higher than the default view, so the captions on the tabs read.
    await orbit(s, 140);
    await cutToPart(s);
  },
};

const WALL_TEXT_BIN: Params = { width: 3, depth: 2, height: 4 };

const wallText: Shot = {
  id: 'designer-labels-and-text-wall-text',
  kind: 'clip',
  async take(s) {
    const name = 'Charging cables';
    await openDesigner(s, name, WALL_TEXT_BIN);
    const textToggle = toggle(s, 'binDesigner.walls.text.heading');
    const caption = text(s, 'binDesigner.walls.text.heading');
    const front = s.page.getByRole('textbox', {
      name: label('binDesigner.walls.text.sideAria', { side: label('binDesigner.lid.side.front') }),
    });
    const lastFace = s.page.getByRole('radiogroup', {
      name: label('binDesigner.walls.text.faceAria', { side: label('binDesigner.lid.side.right') }),
    });
    let frontY = 0;
    const area = await dryRun(
      s,
      { anchor: caption, y: 240 },
      [() => textToggle],
      async () => {
        frontY = (await s.box(front)).y;
        return union(await s.box(caption), await s.box(textToggle), await s.box(lastFace));
      },
      () => setDesign(s, name, WALL_TEXT_BIN)
    );
    const frame = await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(textToggle);
      await s.ui.hold(0.35);
      await s.ui.click(front);
      await s.type('Cables');
      await s.ui.hold(0.1);
    });
    // The first text on a bin adds the Typography section above, which pushes
    // the wall text down; the panel is scrolled back before the take goes on.
    await s.until(text(s, 'binDesigner.type.heading'));
    await scrollPanel(s, front, frontY);
    await s.take(frame, () => s.ui.hold(0.5));
    await s.ui.preClick(
      s.page.getByRole('button', {
        name: label('binDesigner.cameraPresetAria', {
          view: label('workshop.view.front'),
          key: '1',
        }),
      })
    );
    await s.ui.warm(40);
    await cutToPart(s);
  },
};

/** The tabs print white and the text black once multi-color is on. */
const COLOR_BIN: Params = {
  width: 2,
  depth: 2,
  height: 3,
  compartments: { cols: 2, rows: 1, cells: [0, 1], compartmentTexts: ['M3', 'M4'] },
  label: { enabled: true },
  scoop: { enabled: true },
  featureColors: { labelTab: '#f5f5f5', text: '#1f2937' },
};

const colorZones: Shot = {
  id: 'designer-colors-zones',
  kind: 'clip',
  async take(s) {
    const name = 'Fasteners';
    await openDesigner(s, name, COLOR_BIN);
    // A one-time banner, which a maker who has used multi-color before already closed.
    await s.page.evaluate(async () => {
      const { useSettingsStore } = (await import('/src/core/store/settings.ts' as string)) as {
        useSettingsStore: {
          getState(): {
            settings: { dismissedHints: string[] };
            updateSettings(u: { dismissedHints: string[] }): void;
          };
        };
      };
      const st = useSettingsStore.getState();
      st.updateSettings({ dismissedHints: [...st.settings.dismissedHints, 'multi-color-export'] });
    });
    const colorToggle = toggle(s, 'binDesigner.group.colors');
    const heading = await nearest(
      s,
      texts(s, 'binDesigner.style.section.color'),
      colorToggle,
      'above'
    );
    const zone = (key: Key): Locator =>
      s.page.getByRole('button', { name: new RegExp(`^${label(key)}: #`) }).first();
    const area = await dryRun(
      s,
      { anchor: heading, y: 200 },
      [() => colorToggle],
      async () => union(await s.box(heading), await s.box(zone('binDesigner.colors.base'))),
      () => setDesign(s, name, COLOR_BIN)
    );
    // From the front left, the design name on the floor lies away from the
    // panel, out of the color picker's close-up.
    await orbit(s, 0, 270);
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(colorToggle);
      await s.ui.hold(0.5);
      await s.ui.click(zone('binDesigner.colors.lip'));
      await s.ui.hold(0.2);
    });
    const picker = s.page.getByRole('dialog').first();
    await s.until(picker);
    const pick = union(await s.box(zone('binDesigner.colors.lip')), await s.box(picker));
    await s.take(frameAround(pick, 16, 4 / 3, WORKSPACE), async () => {
      await s.ui.hold(0.3);
      await s.ui.click(
        picker.getByRole('button', { name: label('colors.filament.orange'), exact: true })
      );
      await s.ui.hold(0.6);
    });
    await s.page.keyboard.press('Escape');
    // Back to the default view, which ends off the panel, so no zone row
    // stays hovered and lit in the preview.
    await orbit(s, 0, -270);
    await cutToPart(s);
  },
};

const SOCKET_BIN: Params = {
  width: 4,
  depth: 1,
  height: 4,
  compartments: {
    cols: 2,
    rows: 1,
    cells: [0, 1],
    compartmentTexts: ['M3', 'M4'],
    labelIcons: ['bolt', null],
  },
  label: { enabled: true, mode: 'socket' },
};

function panelCrop(area: Rect): Rect {
  const x = Math.max(4, area.x - 12);
  return {
    x,
    y: area.y - 12,
    width: Math.min(PANEL_EDGE - 5, area.x + area.width + 12) - x,
    height: area.height + 24,
  };
}

const socketList: Shot = {
  id: 'designer-label-plates-socket-list',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'M3 and M4 screws', SOCKET_BIN);
    const tabs = text(s, 'binDesigner.labelTabs');
    await scrollPanel(s, tabs, 150);
    const socket = s.page.getByRole('group', { name: label('binDesigner.socketStyle') }).first();
    const area = union(
      await s.box(tabs),
      await s.box(toggle(s, 'binDesigner.labelTabs')),
      await s.box(socket)
    );
    await s.still(panelCrop(area), 1.5);
  },
};

const plateExport: Shot = {
  id: 'designer-label-plates-export',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'M3 and M4 screws', SOCKET_BIN);
    // The heading carries the plate count in the same element.
    const list = s.page
      .getByText(new RegExp(`^${label('binDesigner.plates.title')}\\s*\\d*$`))
      .first();
    await scrollPanel(s, list, 300);
    const exportButton = s.page
      .getByRole('button', { name: label('binDesigner.plates.export'), exact: true })
      .first();
    await s.still(panelCrop(union(await s.box(list), await s.box(exportButton))), 1.5);
  },
};

const TYPE_BIN: Params = {
  ...TAB_BIN,
  compartments: {
    cols: 3,
    rows: 1,
    cells: [0, 1, 2],
    compartmentTexts: ['Screws', 'Nuts', 'Washers'],
  },
};

const typography: Shot = {
  id: 'designer-labels-and-text-typography',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'Hardware', TYPE_BIN);
    const heading = text(s, 'binDesigner.type.heading');
    await scrollPanel(s, heading, 150);
    const position = await below(
      s,
      s.page.getByRole('radiogroup', { name: label('binDesigner.type.anchor'), exact: true }),
      heading
    );
    // A tall section: less zoom keeps it from filling a whole screen of the docs.
    await s.still(panelCrop(union(await s.box(heading), await s.box(position))), 1.25);
  },
};

/** Wide enough that the bento canvas, the compartment panel and the preview all have room. */
const BENTO_VIEW = { width: 1680, height: 940 };

/** Label tabs on, as typing a compartment label in the Bento workspace turns them on. */
const BENTO_BIN: Params = { width: 4, depth: 3, height: 6, label: { enabled: true } };

const BENTO_DRAWING = {
  grid: { cols: 8, rows: 6 },
  fused: [
    { col: 0, row: 0, w: 2, h: 6 },
    { col: 2, row: 0, w: 3, h: 2 },
  ],
  compartments: [
    { col: 2, row: 2, w: 3, h: 4 },
    { col: 5, row: 3, w: 3, h: 3 },
    { col: 5, row: 0, w: 2, h: 3 },
    { col: 7, row: 0, w: 1, h: 3 },
  ],
  /** Each label is found by a cell of its compartment, since ids renumber on every draw. */
  labels: [
    { col: 0, row: 0, text: 'Wire cutters' },
    { col: 2, row: 2, text: 'Heat shrink' },
    { col: 5, row: 3, text: 'Solder' },
    { col: 5, row: 0, text: 'Flux' },
    { col: 7, row: 0, text: 'Tips' },
  ],
  raised: { col: 7, row: 0, mm: 20 },
};

const bento: Shot = {
  id: 'designer-compartments-bento',
  kind: 'still',
  viewport: BENTO_VIEW,
  storage: { 'gridfinity-bento-quickstart-seen-v2': 'true' },
  async take(s) {
    await openDesigner(s, 'Soldering kit', BENTO_BIN);
    await s.page.evaluate(async (d) => {
      type Rect = { col: number; row: number; w: number; h: number };
      const { useDesignerStore } = (await import(
        '/src/features/bin-designer/store/designer.ts' as string
      )) as {
        useDesignerStore: {
          getState(): {
            params: { compartments: { cols: number; cells: number[] } };
            setInteriorCard(card: 'bento'): void;
            setBentoGridPreserving(cols: number, rows: number): unknown;
            drawBentoCompartment(rect: Rect): number | null;
            mergeBentoCompartments(ids: number[]): number | null;
            setCompartmentText(id: number, text: string): void;
            setCompartmentFloorRaise(id: number, mm: number): void;
            setSelectedBentoCompartmentId(id: number): void;
            setBentoWorkspaceOpen(open: boolean): void;
          };
        };
      };
      const st = () => useDesignerStore.getState();
      const must = (id: number | null): number => {
        if (id === null) throw new Error('a bento draw was refused');
        return id;
      };
      st().setInteriorCard('bento');
      st().setBentoGridPreserving(d.grid.cols, d.grid.rows);
      const [a, b] = d.fused;
      const first = must(st().drawBentoCompartment(a));
      const second = must(st().drawBentoCompartment(b));
      must(st().mergeBentoCompartments([first, second]));
      for (const r of d.compartments) must(st().drawBentoCompartment(r));
      const at = (col: number, row: number): number => {
        const c = st().params.compartments;
        const id = c.cells[row * c.cols + col];
        if (id === undefined) throw new Error(`no cell at ${col}, ${row}`);
        return id;
      };
      for (const l of d.labels) st().setCompartmentText(at(l.col, l.row), l.text);
      const raised = at(d.raised.col, d.raised.row);
      st().setCompartmentFloorRaise(raised, d.raised.mm);
      st().setBentoWorkspaceOpen(true);
      st().setSelectedBentoCompartmentId(raised);
    }, BENTO_DRAWING);
    await s.until(s.page.getByText(label('binDesigner.bento.floorRaise'), { exact: true }).first());
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('binDesigner.cutoutEditor.fitToView'), exact: true })
    );
    await s.ui.waitBuilt();
    await s.dismissToasts();
    const preview = await s.box(s.page.locator('canvas').first());
    await s.still({ x: 0, y: 48, width: preview.x, height: BENTO_VIEW.height - 48 });
  },
};

export const DESIGNER_BODY: readonly Shot[] = [
  baseMounting,
  baseLightweight,
  colorZones,
  compartmentGrid,
  bento,
  scoop,
  pullTab,
  socketList,
  plateExport,
  tabList,
  typography,
  wallText,
];
