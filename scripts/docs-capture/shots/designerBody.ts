import type { Locator } from '@playwright/test';
import { label } from '../labels';
import { DESKTOP, frameAround, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { WORKBENCH } from '../fixtures';
import { openDesigner, partBox, setDesign } from './apps';
import type { Params } from './apps';
import { cellCenter, openLayouts } from './layoutEditor';

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
  const frame = frameAround(await partBox(s), 40, 4 / 3, canvas);
  // The zoom sizes the clip only when this is its first take.
  await s.take(
    frame,
    async () => {
      s.poster();
      await s.ui.hold(hold);
    },
    CLOSE_UP_WIDTH / frame.width
  );
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

/** A one-time banner, which a maker who has used multi-color before already closed. */
async function dismissColorHint(s: DocsSession): Promise<void> {
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
  await s.ui.warm(6);
}

const colorZones: Shot = {
  id: 'designer-colors-zones',
  kind: 'clip',
  async take(s) {
    const name = 'Fasteners';
    await openDesigner(s, name, COLOR_BIN);
    await dismissColorHint(s);
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

interface BentoRect {
  col: number;
  row: number;
  w: number;
  h: number;
}

interface BentoDrawing {
  grid: { cols: number; rows: number };
  fused: [BentoRect, BentoRect];
  compartments: BentoRect[];
  /** Each label is found by a cell of its compartment, since ids renumber on every draw. */
  labels: { col: number; row: number; text: string }[];
  /** Raised and selected, so the compartment panel shows its Floor raise. */
  raised?: { col: number; row: number; mm: number };
}

const BENTO_DRAWING: BentoDrawing = {
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
  labels: [
    { col: 0, row: 0, text: 'Wire cutters' },
    { col: 2, row: 2, text: 'Heat shrink' },
    { col: 5, row: 3, text: 'Solder' },
    { col: 5, row: 0, text: 'Flux' },
    { col: 7, row: 0, text: 'Tips' },
  ],
  raised: { col: 7, row: 0, mm: 20 },
};

async function drawBento(s: DocsSession, d: BentoDrawing): Promise<void> {
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
    st().setBentoWorkspaceOpen(true);
    if (!d.raised) return;
    const raised = at(d.raised.col, d.raised.row);
    st().setCompartmentFloorRaise(raised, d.raised.mm);
    st().setSelectedBentoCompartmentId(raised);
  }, d);
}

const fitBento = (s: DocsSession): Promise<void> =>
  s.ui.preClick(
    s.page.getByRole('button', { name: label('binDesigner.cutoutEditor.fitToView'), exact: true })
  );

const bento: Shot = {
  id: 'designer-compartments-bento',
  kind: 'still',
  viewport: BENTO_VIEW,
  storage: { 'gridfinity-bento-quickstart-seen-v2': 'true' },
  async take(s) {
    await openDesigner(s, 'Soldering kit', BENTO_BIN);
    await drawBento(s, BENTO_DRAWING);
    await s.until(s.page.getByText(label('binDesigner.bento.floorRaise'), { exact: true }).first());
    await fitBento(s);
    await s.ui.waitBuilt();
    await s.dismissToasts();
    const preview = await s.box(s.page.locator('canvas').first());
    await s.still({ x: 0, y: 48, width: preview.x, height: BENTO_VIEW.height - 48 });
  },
};

const HALF_BIN: Params = { width: 2, depth: 2, height: 3 };

const halfSockets: Shot = {
  id: 'designer-base-half-sockets',
  kind: 'clip',
  async take(s) {
    const name = 'Washers';
    await openDesigner(s, name, HALF_BIN);
    const half = toggle(s, 'binDesigner.halfSockets');
    const heading = await nearest(s, texts(s, 'binDesigner.base.section.feet'), half, 'above');
    const area = await dryRun(
      s,
      { anchor: heading, y: 300 },
      [() => half],
      async () => union(await s.box(heading), await s.box(half)),
      () => setDesign(s, name, HALF_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(half);
      await s.ui.hold(0.6);
    });
    await orbit(s, -240);
    await cutToPart(s);
  },
};

const FEET_BIN: Params = { width: 3, depth: 2, height: 4 };

const detachableFeet: Shot = {
  id: 'designer-base-detachable-feet',
  kind: 'clip',
  async take(s) {
    const name = 'Pliers';
    await openDesigner(s, name, FEET_BIN);
    const feet = toggle(s, 'binDesigner.detachableFeet');
    const heading = await nearest(s, texts(s, 'binDesigner.base.section.feet'), feet, 'above');
    const pin = (): Locator =>
      s.page
        .getByRole('radiogroup', { name: label('binDesigner.detachableFeet.pinSize') })
        .getByRole('radio', { name: 'ø2.7mm' });
    const steps: Step[] = [() => feet, () => below(s, customize(s), feet), pin];
    const area = await dryRun(
      s,
      { anchor: heading, y: 220 },
      steps,
      async () => union(await s.box(heading), await s.box(pin().locator('..'))),
      () => setDesign(s, name, FEET_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.35);
      await s.ui.hold(0.3);
    });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    // A little below the default view, so the feet show as they drop.
    await orbit(s, -70);
    await s.ui.warm(90);
    const slider = s.page.getByRole('slider', {
      name: label('binDesigner.preview.feetDetachSlider'),
    });
    const track = await s.box(slider.locator('..'));
    // Off camera, drop the feet once to frame the part at its tallest.
    await slider.focus();
    const ends: Rect[] = [];
    for (const key of ['Home', 'End']) {
      await s.page.keyboard.press(key);
      await s.ui.warm(30);
      ends.push(await partBox(s));
    }
    // The track is inverted, so which key attaches the feet is read, not assumed.
    if ((await slider.getAttribute('aria-valuenow')) !== '0') {
      await s.page.keyboard.press('Home');
      await s.ui.warm(30);
    }
    if ((await slider.getAttribute('aria-valuenow')) !== '0')
      throw new Error('the feet do not go back on the bin');
    await slider.blur();
    const canvas = await s.box(s.page.locator('canvas').first());
    const frame = frameAround(
      union(...ends, await s.box(slider.locator('../..'))),
      24,
      4 / 3,
      canvas
    );
    const x = track.x + track.width / 2;
    await s.ui.park(x - 50, track.y - 40);
    await s.take(frame, async () => {
      await s.ui.hold(0.5);
      await s.ui.drag([x, track.y + 3], [x, track.y + track.height - 3], 36);
      await s.ui.moveTo(x - 70, track.y + track.height + 60);
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const ACCENT_BIN: Params = {
  width: 2,
  depth: 2,
  height: 5,
  featureColors: { enabled: true },
};

const colorPicker = (s: DocsSession): Locator => s.page.getByRole('dialog').first();

async function pickColor(
  s: DocsSession,
  row: Locator,
  color: Parameters<typeof label>[0]
): Promise<void> {
  const picker = colorPicker(s);
  await s.until(picker);
  const pick = union(await s.box(row), await s.box(picker));
  await s.take(frameAround(pick, 16, 4 / 3, WORKSPACE), async () => {
    await s.ui.hold(0.3);
    await s.ui.click(picker.getByRole('button', { name: label(color), exact: true }));
    await s.ui.hold(0.6);
  });
  await s.page.keyboard.press('Escape');
  await s.ui.warm(10);
}

const accentBands: Shot = {
  id: 'designer-colors-accent-bands',
  kind: 'clip',
  async take(s) {
    const name = 'Hex keys';
    await openDesigner(s, name, ACCENT_BIN);
    await dismissColorHint(s);
    const heading = text(s, 'binDesigner.colors.accent.title');
    const top = toggle(s, 'binDesigner.colors.zone.topAccent');
    const height = (): Locator =>
      s.page.getByRole('slider', { name: label('binDesigner.colors.accent.height') }).first();
    const row = (): Locator =>
      s.page
        .getByRole('button', {
          name: new RegExp(`^${label('binDesigner.colors.zone.topAccent')}: #`),
        })
        .first();
    const area = await dryRun(
      s,
      { anchor: heading, y: 260 },
      [() => top],
      async () => union(await s.box(heading), await s.box(row())),
      () => setDesign(s, name, ACCENT_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(top);
      await s.ui.hold(0.5);
      const track = await s.box(height());
      const y = track.y + track.height / 2;
      // 2 mm sits near the left end of the track; the drag ends near 7 mm.
      await s.ui.drag([track.x + track.width * 0.06, y], [track.x + track.width * 0.2, y], 16);
      await s.ui.hold(0.4);
      await s.ui.click(row());
      await s.ui.hold(0.2);
    });
    await pickColor(s, row(), 'colors.filament.blue');
    await cutToPart(s);
  },
};

const lipCells = (hex: string): Record<string, string> =>
  Object.fromEntries(
    ['frontLeft', 'frontRight', 'backRight', 'backLeft'].flatMap((corner) =>
      [0, 1, 2, 3].map((band) => [`lip:${corner}:${band}`, hex])
    )
  );

const PALETTE_BIN: Params = {
  ...COLOR_BIN,
  featureColors: {
    enabled: true,
    lip: { cells: lipCells('#f97316') },
    labelTab: '#f5f5f5',
    text: '#1f2937',
  },
};

const savePalette: Shot = {
  id: 'designer-colors-save-palette',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'Fasteners', PALETTE_BIN);
    await dismissColorHint(s);
    const colorToggle = toggle(s, 'binDesigner.group.colors');
    const actions = s.page
      .getByRole('button', { name: label('binDesigner.colors.actions'), exact: true })
      .first();
    const menu = s.page.getByRole('menu').first();
    const heading = await nearest(
      s,
      texts(s, 'binDesigner.style.section.color'),
      colorToggle,
      'above'
    );
    await scrollPanel(s, heading, 150);
    await actions.click({ force: true });
    await s.until(menu);
    const area = union(await s.box(heading), await s.box(menu));
    await s.page.keyboard.press('Escape');
    await s.ui.warm(12);
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(actions);
      await s.ui.hold(0.4);
      await s.ui.click(
        s.page.getByRole('menuitem', { name: label('binDesigner.colors.savePalette') })
      );
      await s.ui.hold(0.3);
      await s.type('Shop orange');
      await s.keys('Enter');
      await s.ui.hold(0.6);
      await s.ui.click(actions);
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const BENTO_DRAW_BIN: Params = { width: 4, depth: 3, height: 6 };

/** The drawing grid's box on screen: the one pocket of an empty canvas fills it. */
async function bentoGrid(s: DocsSession): Promise<Rect> {
  const pockets = s.page.getByTestId('bento-pocket');
  const boxes: Rect[] = [];
  for (let i = 0; i < (await pockets.count()); i++) boxes.push(await s.box(pockets.nth(i)));
  if (boxes.length === 0) throw new Error('the Bento canvas shows no pockets');
  return union(...boxes);
}

const bentoDraw: Shot = {
  id: 'designer-compartments-bento-draw',
  kind: 'clip',
  viewport: BENTO_VIEW,
  storage: { 'gridfinity-bento-quickstart-seen-v2': 'true' },
  async take(s) {
    const name = 'Soldering kit';
    await openDesigner(s, name, BENTO_DRAW_BIN);
    const cards = s.page
      .getByRole('radiogroup', { name: label('binDesigner.group.interior'), exact: true })
      .first();
    const card = cards.getByRole('radio', {
      name: label('binDesigner.interior.bento.title'),
      exact: true,
    });
    const launch = (): Locator =>
      s.page
        .getByRole('button', { name: new RegExp(`^${label('binDesigner.openBentoWorkspace')}`) })
        .first();
    const area = await dryRun(
      s,
      { anchor: cards, y: 150 },
      [() => card],
      async () => union(await s.box(cards), await s.box(launch())),
      () => setDesign(s, name, BENTO_DRAW_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(card);
      await s.ui.hold(0.5);
      const b = await s.box(launch());
      await s.ui.moveTo(b.x + b.width / 2, b.y + b.height / 2);
      await s.ui.hold(0.2);
    });
    // The workspace opens over the panel, inside this close-up's frame, so the
    // click lands just after the cut.
    await launch().click({ force: true });
    const setup = s.page.getByText(label('binDesigner.bento.gridSetupTitle'), { exact: true });
    await s.until(setup);
    await s.page.waitForTimeout(1500);
    await s.ui.warm(30);
    const grid = await bentoGrid(s);
    const frame = frameAround(grid, 30, 4 / 3, WORKSPACE);
    const cols = 8;
    const rows = 6;
    // Rows count down from the top of the canvas here.
    const at = (col: number, row: number): [number, number] => [
      grid.x + ((col + 0.5) * grid.width) / cols,
      grid.y + ((row + 0.5) * grid.height) / rows,
    ];
    const edge = (col: number, row: number): [number, number] => [
      grid.x + (col * grid.width) / cols,
      grid.y + ((row + 0.5) * grid.height) / rows,
    ];
    await s.ui.park(frame.x + frame.width * 0.5, frame.y + frame.height - 20);
    await s.take(frame, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(
        s.page.getByRole('button', { name: new RegExp(`^${cols}×${rows}`) }).first()
      );
      await s.ui.hold(0.5);
      await s.ui.drag(at(0, 0), at(2, 5), 16);
      await s.ui.hold(0.3);
      await s.ui.drag(at(3, 0), at(7, 2), 16);
      await s.ui.hold(0.3);
      await s.ui.drag(at(3, 3), at(5, 5), 14);
      await s.ui.hold(0.4);
      // The new compartment is selected; its right handle sits on its right edge.
      await s.ui.drag(edge(6, 4), edge(8, 4), 14);
      await s.ui.hold(0.6);
    });
    await cutToPart(s);
  },
};

const floorRaise: Shot = {
  id: 'designer-compartments-floor-raise',
  kind: 'clip',
  viewport: BENTO_VIEW,
  storage: { 'gridfinity-bento-quickstart-seen-v2': 'true' },
  async take(s) {
    await openDesigner(s, 'Soldering kit', BENTO_BIN);
    await drawBento(s, { ...BENTO_DRAWING, raised: undefined });
    await s.until(s.page.getByTestId('bento-canvas'));
    await fitBento(s);
    await s.ui.waitBuilt();
    await s.dismissToasts();
    // A little higher than the default view, so the raised floor shows against
    // its deep neighbors; the clip opens on the bin before the change.
    await orbit(s, 50);
    await cutToPart(s, 1.2);
    const drawn = s.page.locator('[data-testid^="bento-compartment-"]');
    const boxes: Rect[] = [];
    for (let i = 0; i < (await drawn.count()); i++) boxes.push(await s.box(drawn.nth(i)));
    // Tips is the only compartment one cell wide.
    const narrowest = boxes.indexOf(boxes.reduce((a, b) => (b.width < a.width ? b : a)));
    const tips = drawn.nth(narrowest);
    const slider = (): Locator =>
      s.page.getByRole('slider', { name: label('binDesigner.bento.floorRaise') }).first();
    await tips.click({ force: true });
    await s.until(slider());
    const area = union(
      await s.box(tips),
      await s.box(s.page.getByText(label('binDesigner.bento.floorRaise'), { exact: true }).first()),
      await s.box(slider())
    );
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    if (await slider().isVisible()) throw new Error('the compartment stays selected');
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(tips);
      await s.ui.hold(0.5);
      await slide(s, slider(), 24, 20);
      await s.ui.hold(0.6);
    });
    await cutToPart(s);
  },
};

const DIAGONAL_BIN: Params = {
  width: 3,
  depth: 4,
  height: 4,
  compartments: { cols: 2, rows: 1, cells: [0, 1] },
};

async function setDiagonalEditing(s: DocsSession, on: boolean): Promise<void> {
  await s.page.evaluate(async (v) => {
    const { useSettingsStore } = (await import('/src/core/store/settings.ts' as string)) as {
      useSettingsStore: {
        getState(): { updateSetting(key: 'angledDividersEnabled', value: boolean): void };
      };
    };
    useSettingsStore.getState().updateSetting('angledDividersEnabled', v);
  }, on);
  await s.ui.warm(6);
}

const diagonalDividers: Shot = {
  id: 'designer-compartments-diagonal',
  kind: 'clip',
  async take(s) {
    const name = 'Cutlery';
    await openDesigner(s, name, DIAGONAL_BIN);
    const diagonal = toggle(s, 'binDesigner.angledDividers.title');
    const preset = (key: 'presetAngle' | 'presetLean'): Locator =>
      s.page
        .getByRole('button', { name: label(`binDesigner.angledDividers.${key}`, { angle: 15 }) })
        .first();
    const steps: Step[] = [
      () => diagonal,
      // The grid above names its divider the same way; the list row sits below the switch.
      async () => {
        const named = s.page.getByRole('button', {
          name: label('binDesigner.angledDividers.editRowLabel', { a: 1, b: 2 }),
        });
        await s.until(named.nth(1));
        return below(s, named, diagonal);
      },
      () => preset('presetAngle'),
      () => preset('presetLean'),
    ];
    const area = await dryRun(
      s,
      { anchor: diagonal, y: 200 },
      steps,
      async () =>
        union(
          await s.box(diagonal),
          await s.box(
            s.page
              .getByRole('spinbutton', {
                name: label('binDesigner.angledDividers.leanLabel'),
                exact: true,
              })
              .first()
          )
        ),
      async () => {
        // The picked divider outlives the switch, and would skip the list next time.
        await s.page
          .getByRole('button', {
            name: label('binDesigner.angledDividers.backToList'),
            exact: true,
          })
          .first()
          .click({ force: true });
        await s.ui.warm(6);
        await setDiagonalEditing(s, false);
        await setDesign(s, name, DIAGONAL_BIN);
      }
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.45);
      await s.ui.hold(0.3);
    });
    await orbit(s, 80);
    await cutToPart(s);
  },
};

const SLOTTED_BIN: Params = { width: 3, depth: 3, height: 4 };

const removableDividers: Shot = {
  id: 'designer-compartments-removable',
  kind: 'clip',
  async take(s) {
    const name = 'Spare parts';
    await openDesigner(s, name, SLOTTED_BIN);
    const cards = s.page
      .getByRole('radiogroup', { name: label('binDesigner.group.interior'), exact: true })
      .first();
    const slotted = cards.getByRole('radio', {
      name: label('binDesigner.interior.slotted.title'),
      exact: true,
    });
    const button = (key: Key): Locator =>
      s.page.getByRole('button', { name: label(key), exact: true }).first();
    // With both directions on, each direction gets its own width.
    const spacing = (): Locator =>
      s.page.getByRole('spinbutton', { name: new RegExp(`^${label('binDesigner.slotSpacing')}`) });
    const steps: Step[] = [
      () => slotted,
      () => button('binDesigner.slotLayoutEven'),
      () => button('binDesigner.slotBoth'),
    ];
    const area = await dryRun(
      s,
      { anchor: cards, y: 190 },
      steps,
      async () => union(await s.box(cards), await s.box(spacing().last())),
      () => setDesign(s, name, SLOTTED_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.4);
      for (const i of [0, 1]) {
        await s.ui.click(spacing().nth(i));
        await s.page.keyboard.press('ControlOrMeta+a');
        await s.type('40');
        await s.keys('Enter');
      }
      await s.ui.hold(0.3);
    });
    await orbit(s, 90);
    await cutToPart(s);
  },
};

async function slide(s: DocsSession, slider: Locator, to: number, frames = 18): Promise<void> {
  const b = await s.box(slider);
  const [min, max, now] = await slider.evaluate((el) => {
    const input = el as HTMLInputElement;
    return [Number(input.min), Number(input.max), Number(input.value)];
  });
  const x = (v: number): number => b.x + ((v - min) / (max - min)) * b.width;
  const y = b.y + b.height / 2;
  await s.ui.drag([x(now), y], [x(to), y], frames);
}

const FILLET_BIN: Params = {
  width: 3,
  depth: 2,
  height: 4,
  compartments: { cols: 3, rows: 1, cells: [0, 1, 2] },
};

const interiorFillet: Shot = {
  id: 'designer-getting-things-out-fillet',
  kind: 'clip',
  async take(s) {
    const name = 'Small parts';
    await openDesigner(s, name, FILLET_BIN);
    const fillet = toggle(s, 'binDesigner.interiorFillet.label');
    const radius = (): Locator =>
      s.page.getByRole('slider', { name: label('binDesigner.interiorFillet.radius') }).first();
    const area = await dryRun(
      s,
      { anchor: fillet, y: 280 },
      [() => fillet],
      async () => union(await s.box(fillet), await s.box(radius())),
      () => setDesign(s, name, FILLET_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(fillet);
      await s.ui.hold(0.5);
      // The drag lands short of its target on the stepped clock; 11 ends near 7 mm.
      await slide(s, radius(), 11);
      await s.ui.hold(0.4);
    });
    // Higher than the default view, so the rounded floor of each compartment shows.
    await orbit(s, 150);
    await cutToPart(s);
  },
};

const CENTER_TAB_BIN: Params = {
  width: 4,
  depth: 3,
  height: 4,
  compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3] },
};

const centerTab: Shot = {
  id: 'designer-getting-things-out-center-tab',
  kind: 'clip',
  async take(s) {
    const name = 'Paint tray';
    await openDesigner(s, name, CENTER_TAB_BIN);
    const tabToggle = toggle(s, 'binDesigner.pullTab.title');
    const walls = s.page.getByRole('group', { name: label('binDesigner.pullTab.sideAria') });
    const wall = (key: Key): Locator =>
      walls.getByRole('switch', { name: label(key), exact: true });
    const axis = s.page
      .getByRole('group', { name: label('binDesigner.pullTab.centerAxis'), exact: true })
      .getByRole('button', { name: label('binDesigner.pullTab.centerAxis.width'), exact: true });
    const steps: Step[] = [
      () => tabToggle,
      () => wall('binDesigner.pullTab.side.center'),
      () => wall('binDesigner.pullTab.side.front'),
      () => axis,
    ];
    const area = await dryRun(
      s,
      { anchor: tabToggle, y: 220 },
      steps,
      async () => union(await s.box(tabToggle), await s.box(axis)),
      () => setDesign(s, name, CENTER_TAB_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.45);
      await s.ui.hold(0.3);
    });
    await cutToPart(s);
  },
};

const SOCKET_ON_BIN: Params = {
  width: 4,
  depth: 1,
  height: 4,
  compartments: { cols: 2, rows: 1, cells: [0, 1], compartmentTexts: ['M3', 'M4'] },
};

const labelStyle = (s: DocsSession, key: Key): Locator =>
  s.page
    .getByRole('group', { name: label('binDesigner.tabMode'), exact: true })
    .getByRole('button', { name: label(key), exact: true });

const socketsOn: Shot = {
  id: 'designer-label-plates-sockets',
  kind: 'clip',
  async take(s) {
    const name = 'M3 and M4 screws';
    await openDesigner(s, name, SOCKET_ON_BIN);
    const tabs = toggle(s, 'binDesigner.labelTabs');
    const socket = (): Locator => labelStyle(s, 'binDesigner.tabMode.socket');
    const steps: Step[] = [() => tabs, socket];
    const area = await dryRun(
      s,
      { anchor: tabs, y: 220 },
      steps,
      async () =>
        union(
          await s.box(tabs),
          await s.box(
            s.page.getByRole('button', {
              name: new RegExp(
                `^${label('binDesigner.plateIconAria', { owner: label('binDesigner.plateIconOwnerCompartment', { n: 2 }) })}`
              ),
            })
          )
        ),
      () => setDesign(s, name, SOCKET_ON_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await clickThrough(s, steps, 0.6);
      await s.ui.hold(0.4);
    });
    // Higher than the default view, so the plates in the tabs read.
    await orbit(s, 70);
    await cutToPart(s);
  },
};

const plateFit: Shot = {
  id: 'designer-label-plates-fit',
  kind: 'clip',
  async take(s) {
    await openDesigner(s, 'M3 and M4 screws', SOCKET_BIN);
    const group = s.page
      .getByRole('button', { name: label('binDesigner.plateFitGroup'), exact: true })
      .first();
    const card = (): Locator =>
      s.page
        .getByRole('button', { name: label('binDesigner.fitSample.button'), exact: true })
        .first();
    const offset = (): Locator =>
      s.page.getByRole('button', {
        name: label('common.increaseAria', { what: label('binDesigner.plateFitOffset') }),
      });
    const area = await dryRun(
      s,
      { anchor: group, y: 300 },
      [() => group],
      async () => union(await s.box(group), await s.box(card())),
      async () => {
        await group.click({ force: true });
        await s.ui.warm(12);
      }
    );
    const frame = await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(group);
      await s.ui.hold(0.5);
      await s.ui.click(card());
      await s.ui.hold(0.2);
    });
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    // The card's own instructions, large enough to read; the export options above them are not the step.
    const tips = union(
      await s.box(dialog.getByText(label('binDesigner.fitSample.tipsTitle'), { exact: true })),
      await s.box(dialog.getByRole('button', { name: /^Download/ }).first())
    );
    await s.ui.hideCursor();
    await s.take(frameAround(tips, 16, 4 / 3, WORKSPACE), async () => {
      s.poster();
      await s.ui.hold(3);
    });
    await s.page.keyboard.press('Escape');
    await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await s.ui.warm(20);
    await s.take(frame, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(offset());
      await s.ui.hold(1.2);
    });
  },
};

const iconPicker: Shot = {
  id: 'designer-label-plates-icon',
  kind: 'still',
  async take(s) {
    await openDesigner(s, 'M3 and M4 screws', SOCKET_BIN);
    const icon = s.page
      .getByRole('button', {
        name: new RegExp(
          `^${label('binDesigner.plateIconAria', { owner: label('binDesigner.plateIconOwnerCompartment', { n: 2 }) })}`
        ),
      })
      .first();
    await scrollPanel(s, icon, 260);
    await icon.click({ force: true });
    const search = s.page
      .getByPlaceholder(label('binDesigner.plateIcon.searchPlaceholder'))
      .first();
    await s.until(search);
    const popover = search.locator(
      'xpath=ancestor::*[@role="dialog" or @role="listbox" or @role="menu"][1]'
    );
    if ((await popover.count()) === 0) throw new Error('the icon picker has no popover');
    const caption = s.page.getByRole('textbox', {
      name: label('binDesigner.tabEngravedTextAriaLabel', { n: 2 }),
    });
    const area = union(await s.box(caption), await s.box(popover));
    await s.ui.hideCursor();
    // From the panel's left edge, so no caption or label in it is cut; the
    // top stops short of the row above.
    await s.still(
      { x: 0, y: area.y - 6, width: area.x + area.width + 12, height: area.height + 18 },
      1.25
    );
  },
};

const finishTabs = (s: DocsSession): Locator =>
  s.page.getByRole('button', { name: new RegExp(`^${label('binDesigner.tabTextGroup')}`) }).first();

const textFinish: Shot = {
  id: 'designer-labels-and-text-finish',
  kind: 'clip',
  async take(s) {
    const name = 'Hardware';
    await openDesigner(s, name, TYPE_BIN);
    const group = finishTabs(s);
    const finish = (key: Key): Locator =>
      s.page
        .getByRole('radiogroup', { name: label('binDesigner.textMode'), exact: true })
        .first()
        .getByRole('radio', { name: label(key), exact: true });
    const area = await dryRun(
      s,
      { anchor: group, y: 300 },
      [() => group],
      async () => union(await s.box(group), await s.box(finish('binDesigner.textMode.emboss'))),
      async () => {
        await group.click({ force: true });
        await s.ui.warm(12);
      }
    );
    // Higher than the default view, so the captions on the tabs read.
    await orbit(s, 140);
    for (const key of [
      'binDesigner.textMode.emboss',
      'binDesigner.textMode.through-cut',
    ] as const) {
      await closeUp(s, area, async () => {
        await s.ui.hold(0.4);
        if (key === 'binDesigner.textMode.emboss') {
          await s.ui.click(group);
          await s.ui.hold(0.4);
        }
        await s.ui.click(finish(key));
        await s.ui.hold(0.4);
      });
      await cutToPart(s, key === 'binDesigner.textMode.emboss' ? 1.4 : 2);
    }
  },
};

const FLOOR_TEXT_BIN: Params = { width: 2, depth: 2, height: 3 };

const floorText: Shot = {
  id: 'designer-labels-and-text-floor-text',
  kind: 'clip',
  async take(s) {
    const name = 'Spare screws';
    await openDesigner(s, name, FLOOR_TEXT_BIN);
    const floorToggle = toggle(s, 'binDesigner.floor.text.heading');
    const box = (): Locator =>
      s.page
        .getByRole('textbox', { name: label('binDesigner.floor.text.heading'), exact: true })
        .first();
    let boxY = 0;
    const area = await dryRun(
      s,
      { anchor: floorToggle, y: 240 },
      [() => floorToggle],
      async () => {
        boxY = (await s.box(box())).y;
        return union(await s.box(floorToggle), await s.box(box()));
      },
      () => setDesign(s, name, FLOOR_TEXT_BIN)
    );
    const frame = await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(floorToggle);
      await s.ui.hold(0.35);
      await s.ui.click(box());
      await s.type('M4 x 10');
      await s.ui.hold(0.1);
    });
    // The first text on a bin adds the Typography section above, which pushes
    // the floor text down; the panel is scrolled back before the take goes on.
    await s.until(text(s, 'binDesigner.type.heading'));
    await scrollPanel(s, box(), boxY);
    await s.take(frame, () => s.ui.hold(0.5));
    await s.ui.preClick(
      s.page.getByRole('button', {
        name: label('binDesigner.cameraPresetAria', { view: label('workshop.view.top'), key: '3' }),
      })
    );
    await s.ui.warm(40);
    await cutToPart(s);
  },
};

/** WORKBENCH with a new Fasteners bin, still unlabeled, so M6 comes next in the M3 to M5 set. */
const SUGGEST_LAYOUT = {
  ...WORKBENCH,
  bins: [...(WORKBENCH.bins ?? []), { x: 6, y: 5, w: 1, d: 1, h: 6, cat: 'Fasteners' }],
};

const labelSuggestions: Shot = {
  id: 'designer-labels-and-text-suggestions',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, SUGGEST_LAYOUT);
    const [x, y] = await cellCenter(s, 7, 6);
    const half = ((await cellCenter(s, 8, 6))[0] - x) / 2;
    const bin: Rect = { x: x - half, y: y - half, width: half * 2, height: half * 2 };
    await s.ui.clickAt(x, y);
    await s.ui.warm(20);
    await s.dismissToasts();
    const field = s.page.getByRole('combobox', { name: label('inspector.binLabel') }).first();
    await s.until(field);
    await s.ui.preReveal(field);
    await field.focus();
    const list = s.page.getByRole('listbox').first();
    await s.until(list);
    // With the bin on the grid, so its label shows as it is typed.
    const area = union(bin, await s.box(field), await s.box(list));
    await s.page.keyboard.press('Escape');
    await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await s.ui.warm(20);
    await s.page.waitForTimeout(500);
    await s.dismissToasts();
    const frame = frameAround(area, 24, 4 / 3, WORKSPACE);
    await s.ui.park(frame.x + frame.width * 0.6, frame.y + frame.height - 30);
    await s.take(
      frame,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(field);
        await s.ui.hold(0.6);
        await s.type('M');
        s.poster();
        await s.ui.hold(1.4);
        await s.keys('Tab');
        await s.ui.hold(1.2);
      },
      CLOSE_UP_WIDTH / frame.width
    );
  },
};

const SPLIT_LIP_BIN: Params = {
  width: 2,
  depth: 2,
  height: 3,
  featureColors: { enabled: true },
};

const splitLip: Shot = {
  id: 'designer-colors-split-lip',
  kind: 'clip',
  async take(s) {
    const name = 'Fasteners';
    await openDesigner(s, name, SPLIT_LIP_BIN);
    await dismissColorHint(s);
    const split = toggle(s, 'binDesigner.colors.lip.splitZones');
    const corners = (): Locator =>
      s.page
        .getByRole('radiogroup', { name: label('binDesigner.colors.lip.cornersLabel') })
        .getByRole('radio', { name: '4', exact: true });
    const cell = (key: Key): Locator =>
      s.page.getByRole('button', { name: new RegExp(`^${label(key)}: #`) }).first();
    const lip = (): Locator => cell('binDesigner.colors.lip');
    const area = await dryRun(
      s,
      { anchor: lip(), y: 260 },
      [() => split, corners],
      async () =>
        union(
          await s.box(cell('binDesigner.colors.body')),
          await s.box(cell('binDesigner.colors.lip.backLeft')),
          await s.box(split)
        ),
      () => setDesign(s, name, SPLIT_LIP_BIN)
    );
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(split);
      await s.ui.hold(0.4);
      await s.ui.click(corners());
      await s.ui.hold(0.5);
      await s.ui.click(cell('binDesigner.colors.lip.frontLeft'));
      await s.ui.hold(0.2);
    });
    await pickColor(s, cell('binDesigner.colors.lip.frontLeft'), 'colors.filament.orange');
    await closeUp(s, area, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(cell('binDesigner.colors.lip.backRight'));
      await s.ui.hold(0.2);
    });
    await pickColor(s, cell('binDesigner.colors.lip.backRight'), 'colors.filament.orange');
    await cutToPart(s);
  },
};

/** Flat captions in the label tab color: the clash the panel warns about. */
const FLAT_BIN: Params = {
  ...TYPE_BIN,
  textDefaults: { mode: 'flat' },
  featureColors: { enabled: true },
};

const flatText: Shot = {
  id: 'designer-colors-flat-text',
  kind: 'clip',
  async take(s) {
    const name = 'Hardware';
    await openDesigner(s, name, FLAT_BIN);
    await dismissColorHint(s);
    const group = finishTabs(s);
    const fix = (): Locator =>
      s.page
        .getByRole('button', { name: label('binDesigner.textColor.useContrasting'), exact: true })
        .first();
    const area = await dryRun(
      s,
      { anchor: group, y: 260 },
      [() => group],
      async () => union(await s.box(group), await s.box(fix())),
      async () => {
        await group.click({ force: true });
        await s.ui.warm(12);
      }
    );
    // Higher than the default view, so the captions on the tabs read.
    await orbit(s, 140);
    await cutToPart(s, 1.2);
    await closeUp(s, area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(group);
      await s.ui.hold(0.8);
      await s.ui.click(fix());
      await s.ui.hold(0.5);
    });
    await cutToPart(s);
  },
};

export const DESIGNER_BODY: readonly Shot[] = [
  baseMounting,
  halfSockets,
  detachableFeet,
  baseLightweight,
  colorZones,
  splitLip,
  accentBands,
  flatText,
  savePalette,
  compartmentGrid,
  diagonalDividers,
  bentoDraw,
  bento,
  floorRaise,
  removableDividers,
  scoop,
  interiorFillet,
  pullTab,
  centerTab,
  socketsOn,
  socketList,
  iconPicker,
  plateFit,
  plateExport,
  tabList,
  typography,
  textFinish,
  wallText,
  floorText,
  labelSuggestions,
];
