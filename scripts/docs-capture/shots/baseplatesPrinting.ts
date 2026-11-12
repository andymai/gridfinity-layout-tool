import type { Locator } from '@playwright/test';
import { WORKBENCH, WORKSHOP_CATEGORIES, layoutFile } from '../fixtures';
import type { FixtureBin, FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { cornerCutVertices } from '../../../src/shared/utils/cornerCutOutline';
import { FPS } from '../../feature-tips/encode';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { baseplateReady, openDesigner, partBox, waitBaseplate } from './apps';
import type { Params } from './apps';
import { grid, openLayouts } from './layoutEditor';

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

/** The header and the library read the plate name from storage and the registry. */
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

async function panelCloseUp(s: DocsSession, target: Locator, above: number): Promise<Rect> {
  const p = await panel(s);
  const t = await s.box(target);
  return { x: p.x, y: t.y - above, width: p.width, height: (p.width * 3) / 4 };
}

async function plateFrame(s: DocsSession, margin = 28): Promise<Rect> {
  return frameAround(await partBox(s), margin, 4 / 3, await canvas(s));
}

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

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

const CLIP_WIDTH = 640;

interface BeforeAfter {
  closeUp: Rect;
  /** Put it on nothing that shows a hover state. */
  rest: [number, number];
  plate?: Rect;
  act(): Promise<void>;
}

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

const gridPosition: Shot = {
  id: 'baseplates-odd-shaped-grid-position',
  kind: 'still',
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
        gridShiftX: -6,
      }
    );
    const aside = s.page.locator('aside').first();
    const heading = await s.box(
      aside.getByText(label('baseplate.gridPosition'), { exact: true }).first()
    );
    const hint = await s.box(
      aside
        .getByText(label('drawerShape.gridAlignment.hint', { x: 0, y: 0 }).split(' (')[0])
        .first()
    );
    const p = await panel(s);
    await s.still(
      {
        x: p.x,
        y: heading.y - 12,
        width: p.width,
        height: hint.y + hint.height + 12 - (heading.y - 12),
      },
      1.5
    );
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

const DESK: FixtureLayout = { name: 'Desk drawer', width: 5, depth: 4, height: 8 };

const paddingField = (
  s: DocsSession,
  key: 'baseplate.paddingBack' | 'baseplate.paddingFront'
): Locator => s.page.locator('aside').first().getByLabel(label(key), { exact: true }).first();

const paddingHeading = (s: DocsSession): Locator =>
  s.page.locator('aside').first().getByText(label('baseplate.padding'), { exact: true }).first();

/**
 * The four padding steppers and the anchor buttons between them, 4:3. It
 * starts between the section heading and the label of the back stepper, so
 * neither shows cut in half; a crop a few px taller than 4:3 loses them from
 * its margins.
 */
async function paddingFrame(s: DocsSession): Promise<Rect> {
  const heading = await s.box(paddingHeading(s));
  const backLabel = await s.box(
    s.page
      .locator('aside')
      .first()
      .getByText(label('baseplate.paddingBack'), { exact: true })
      .first()
  );
  const front = await s.box(paddingField(s, 'baseplate.paddingFront'));
  const p = await panel(s);
  const top = (heading.y + heading.height + backLabel.y) / 2;
  const height = front.y + front.height + 10 - top;
  const width = Math.min(p.width, (height * 4) / 3);
  return { x: p.x + (p.width - width) / 2, y: top, width, height };
}

const sizeFromMm: Shot = {
  id: 'baseplates-basics-size-mm',
  kind: 'clip',
  async take(s) {
    await openPlate(s, VAN);
    const edit = s.page.getByRole('button', { name: label('baseplate.editDimensions') });
    const e = await s.box(edit);
    const sync = await s.box(toggle(s, label('baseplate.syncWithLayout')));
    const heading = await s.box(paddingHeading(s));
    const p = await panel(s);
    // The fields that open on the click push the padding heading down, so the
    // crop ends above where it rests: about 3:2, and the plate take matches.
    const top = sync.y - 7;
    const closeUp: Rect = { x: p.x, y: top, width: p.width, height: heading.y - 3 - top };
    const aside: [number, number] = [closeUp.x + closeUp.width + 60, e.y];
    await s.ui.park(closeUp.x + closeUp.width * 0.85, e.y + e.height / 2);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.5);
        await s.ui.click(edit);
        // Off the fields, so the cursor hides none of the numbers.
        await s.ui.moveTo(...aside);
        await s.ui.hold(0.2);
        await s.type('220');
        await s.page.keyboard.press('Tab');
        await s.ui.hold(0.3);
        await s.type('180');
        await s.ui.hold(0.3);
        await s.page.keyboard.press('Enter');
        await s.ui.hold(1.8);
      },
      CLIP_WIDTH / closeUp.width
    );
    await s.ui.hideCursor();
    await waitBaseplate(s);
    const plate = frameAround(
      await partBox(s),
      28,
      closeUp.width / closeUp.height,
      await canvas(s)
    );
    await s.take(plate, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const MARGINS: Params = { paddingLeft: 8, paddingRight: 8, paddingFront: 6, paddingBack: 6 };

const marginsAnchor: Shot = {
  id: 'baseplates-basics-margins',
  kind: 'clip',
  async take(s) {
    await openPlate(s, DESK, MARGINS);
    const closeUp = await paddingFrame(s);
    const anchor = s.page.getByRole('radio', {
      name: label('baseplate.paddingAnchor.bl'),
      exact: true,
    });
    await beforeAfter(s, {
      closeUp,
      rest: [closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.9],
      act: async () => {
        await s.ui.click(anchor);
        await s.ui.moveTo(closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.9);
        await s.ui.hold(1.2);
      },
    });
  },
};

/**
 * Top and bottom (CSS px) of each text, control and row that shows in the
 * settings panel. A collapsed group keeps its boxes, so an element counts only
 * where it is visible and the page hit-tests to it.
 */
async function panelRows(s: DocsSession): Promise<[number, number][]> {
  return s.page
    .locator('aside')
    .first()
    .evaluate((aside) =>
      [
        ...aside.querySelectorAll(
          'p, span, label, button, input, h2, h3, h4, [role="switch"], [role="status"]'
        ),
      ]
        // A slider's input is an invisible strip as thin as its track; the
        // drawn thumb overflows it, so the slider counts by the first box
        // around it that is as tall as the thumb.
        .map((el) => {
          if (!(el instanceof HTMLInputElement) || el.type !== 'range') return el;
          let box: Element = el;
          while (box.parentElement && box.getBoundingClientRect().height < 20)
            box = box.parentElement;
          return box;
        })
        .filter((el) => {
          // A section heading counts by its title: a crop may end inside the
          // empty band around it.
          if (el.tagName === 'H2' || el.parentElement?.tagName === 'H2') return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          // A closed group can sit at opacity 0, which hit-testing still finds.
          if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
            return false;
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit !== null && (hit === el || el.contains(hit) || hit.contains(el));
        })
        .map((el): [number, number] => {
          const r = el.getBoundingClientRect();
          return [r.top, r.bottom];
        })
    );
}

function clearLine(states: [number, number][][], from: number): number {
  let y = from;
  while (!isClear(states, y)) y++;
  return y;
}

function isClear(states: [number, number][][], y: number, margin = 4): boolean {
  return states.every((rows) =>
    rows.every(([top, bottom]) => y <= top - margin || y >= bottom + margin)
  );
}

/**
 * The warning and its button go away when clicked, and the panel moves up, so
 * the crop ends on a line that cuts no row before or after the click.
 */
const fitToDrawer: Shot = {
  id: 'baseplates-basics-fit-drawer',
  kind: 'clip',
  async take(s) {
    const drawer: FixtureLayout = { ...DESK, measuredMm: { width: 218, depth: 176 } };
    await openPlate(s, drawer, MARGINS);
    const fit = s.page.getByRole('button', { name: label('baseplate.fitPaddingToDrawer') });
    const front = await s.box(paddingField(s, 'baseplate.paddingFront'));
    const before = await panelRows(s);
    await fit.click({ force: true });
    await s.ui.warm(10);
    const after = await panelRows(s);
    // A fresh import puts the margins back.
    await openPlate(s, drawer, MARGINS);
    const size = await s.box(
      s.page.getByRole('button', { name: label('baseplate.editDimensions') })
    );
    const p = await panel(s);
    let top = size.y - 16;
    while (!isClear([before, after], top, 3)) top++;
    const bottom = clearLine([before, after], front.y + front.height + 8);
    const area: Rect = { x: p.x, y: top, width: p.width, height: bottom - top };
    const heading = await s.box(paddingHeading(s));
    const rest: [number, number] = [area.x + area.width * 0.8, heading.y + heading.height / 2];
    await s.ui.park(...rest);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.8);
        await s.ui.click(fit);
        await s.ui.moveTo(area.x + area.width + 60, rest[1]);
        s.poster();
        await s.ui.hold(2);
      },
      1.6
    );
  },
};

const magnetSettings: Shot = {
  id: 'baseplates-magnets-magnet-settings',
  kind: 'still',
  async take(s) {
    await openPlate(s, VAN, { magnetHoles: true });
    await s.ui.preClick(
      s.page.getByRole('button', { name: label('common.customize'), exact: true }).first()
    );
    await s.ui.warm(20);
    const magnets = await s.box(toggle(s, label('baseplate.magnetHoles')));
    // The fixture plate is lightweight, so the chamfer is off with its reason below it.
    const reason = await s.box(
      s.page.getByText(label('baseplate.magnetChamferLightweight')).first()
    );
    const p = await panel(s);
    await s.still(
      {
        x: p.x,
        y: magnets.y - 10,
        width: p.width,
        height: reason.y + reason.height + 14 - (magnets.y - 10),
      },
      1.5
    );
  },
};

async function lookFromBelow(s: DocsSession): Promise<void> {
  const c = await canvas(s);
  const [x, y] = [c.x + c.width / 2, c.y + c.height / 2];
  await s.page.mouse.move(x, y);
  await s.page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await s.page.mouse.move(x, y - i * 20);
    await s.ui.warm(1);
  }
  await s.page.mouse.up();
  await s.ui.warm(150);
}

/**
 * A close-up of the panel at `target`, as near 4:3 as its rows allow, with its
 * top and bottom edges on lines that cut no row before or after `flip`, which
 * runs twice, off camera. It reaches `below` px past the target. Takes cut to
 * after it must share its aspect.
 */
async function cleanCloseUp(
  s: DocsSession,
  target: Locator,
  below: number,
  flip: () => Promise<void>
): Promise<Rect> {
  const p = await panel(s);
  const before = await panelRows(s);
  await flip();
  const after = await panelRows(s);
  await flip();
  const t = await s.box(target);
  const ideal = Math.round((p.width * 3) / 4);
  for (let slack = 0; slack <= 50; slack++)
    for (const height of [ideal + slack, ideal - slack])
      for (let above = 16; above < 260; above++) {
        const top = t.y - above;
        if (top + height < t.y + t.height + below) continue;
        if (isClear([before, after], top, 3) && isClear([before, after], top + height, 3))
          return { x: p.x, y: top, width: p.width, height };
      }
  throw new Error('no clean crop around the target');
}

const undersideMagnets: Shot = {
  id: 'baseplates-magnets-underside',
  kind: 'clip',
  async take(s) {
    await openPlate(s, VAN);
    await lookFromBelow(s);
    const under = toggle(s, label('baseplate.mountMagnets.label'));
    await s.ui.preReveal(under);
    const t = await s.box(under);
    const closeUp = await cleanCloseUp(s, under, 20, async () => {
      await under.click({ force: true });
      await s.ui.warm(10);
    });
    await waitBaseplate(s);
    await beforeAfter(s, {
      closeUp,
      plate: frameAround(await partBox(s), 28, closeUp.width / closeUp.height, await canvas(s)),
      // On the divider above the row, clear of its label.
      rest: [t.x - 40, t.y - 14],
      act: async () => {
        await s.ui.click(under);
        await s.ui.hold(1.4);
      },
    });
  },
};

const bedInput = (s: DocsSession): Locator =>
  s.page.getByLabel(label('printBedInput.widthAriaLabel'), { exact: true }).first();

const bedSize: Shot = {
  id: 'baseplates-splitting-bed-size',
  kind: 'clip',
  async take(s) {
    await openPlate(s, KITCHEN);
    const bed = bedInput(s);
    const setBed = async (mm: string): Promise<Rect> => {
      await bed.fill(mm);
      await bed.press('Enter');
      await waitBaseplate(s);
      return partBox(s);
    };
    const apart = await setBed('180');
    const whole = await setBed('256');
    const plate = frameAround(union(apart, whole), 28, 4 / 3, await canvas(s));
    const header = s.page.getByRole('button', {
      name: new RegExp(`^${label('common.physicalUnits')}`),
    });
    await s.ui.preReveal(bed);
    const closeUp = await panelCloseUp(s, header.first(), 4);
    const b = await s.box(bed);
    await beforeAfter(s, {
      closeUp,
      plate,
      // Between the bed and nozzle rows, clear of the labels and their info icons.
      rest: [closeUp.x + closeUp.width * 0.55, b.y + b.height + 4],
      act: async () => {
        await s.ui.click(bed);
        await s.ui.moveTo(closeUp.x + closeUp.width + 60, b.y);
        await s.page.keyboard.press('ControlOrMeta+a');
        await s.type('180');
        await s.ui.hold(0.6);
        // The split adds the connector list above this section, which pushes
        // it down out of the crop, so the take ends on the press.
        await s.page.keyboard.press('Enter');
      },
    });
  },
};

async function zoomToCentre(s: DocsSession, steps: number): Promise<Rect> {
  const c = await canvas(s);
  const [x, y] = [c.x + c.width / 2, c.y + c.height / 2];
  await s.page.mouse.move(x, y);
  for (let i = 0; i < steps; i++) {
    await s.page.mouse.wheel(0, -200);
    await s.ui.warm(4);
  }
  await s.ui.warm(150);
  return frameAround({ x, y, width: 0, height: 0 }, 300, 4 / 3, c);
}

const connectors: Shot = {
  id: 'baseplates-splitting-connectors',
  kind: 'clip',
  async take(s) {
    await openPlate(s, { ...KITCHEN, printBedSize: 180 });
    await s.ui.preClick(view(s, 'baseplate.isoView'));
    await s.ui.warm(30);
    // Close enough that one tongue and its groove fill the frame.
    const seam = await zoomToCentre(s, 28);
    const none = s.page.getByRole('radio', {
      name: label('baseplate.connectors.none'),
      exact: true,
    });
    const dovetail = s.page.getByRole('radio', {
      name: label('baseplate.connectorStyle.dovetail'),
      exact: true,
    });
    await s.ui.preReveal(none);
    const closeUp = await panelCloseUp(s, none, 44);
    const rest: [number, number] = [closeUp.x + closeUp.width * 0.82, closeUp.y + 12];
    await beforeAfter(s, {
      closeUp,
      plate: seam,
      rest,
      act: async () => {
        await s.ui.click(dovetail);
        await s.ui.moveTo(closeUp.x + closeUp.width + 60, rest[1]);
        // Up, so the settings the card opens show below its title.
        await scrollPanelTo(s, dovetail, closeUp.y + 8);
        await s.ui.hold(1.6);
      },
    });
  },
};

const splitExport: Shot = {
  id: 'baseplates-splitting-export',
  kind: 'still',
  async take(s) {
    await openPlate(s, { name: 'Workbench', width: 10, depth: 7, height: 12 });
    await s.ui.preClick(s.page.getByRole('button', { name: label('common.export'), exact: true }));
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog.getByText(label('baseplate.export.enableSplit')));
    await s.dismissToasts();
    await s.still(await s.box(dialog));
  },
};

const ecoPlate: Shot = {
  id: 'baseplates-eco-plate',
  kind: 'clip',
  async take(s) {
    await openPlate(s, VAN);
    await s.ui.preClick(view(s, 'baseplate.isoView'));
    await s.ui.warm(30);
    const eco = toggle(s, label('baseplate.ecoPlate'));
    const t = await s.box(eco);
    await beforeAfter(s, {
      closeUp: await panelCloseUp(s, eco, 62),
      rest: [t.x - 100, t.y - 12],
      act: async () => {
        await s.ui.click(eco);
        await s.ui.hold(1.2);
      },
    });
  },
};

const stackCopies: Shot = {
  id: 'baseplates-eco-stack-copies',
  kind: 'clip',
  async take(s) {
    await openPlate(s, VAN);
    await s.ui.preClick(view(s, 'baseplate.isoView'));
    await s.ui.warm(30);
    const stack = toggle(s, label('baseplate.stackPrint.enable'));
    const copies = (dir: 'increaseAria' | 'decreaseAria'): Locator =>
      s.page.getByRole('button', {
        name: label(`common.${dir}`, { what: label('baseplate.stackPrint.copies.label') }),
      });
    const tips = s.page.getByText(label('baseplate.stackPrint.tips.heading'), { exact: true });
    // Off camera: the stack goes on, then the panel is measured with one set
    // and with four, as rows relative to the toggle, which the scroll moves.
    await s.ui.preClick(stack);
    await s.until(tips);
    await waitBaseplate(s);
    await s.ui.preReveal(stack);
    const relRows = async (): Promise<[number, number][]> => {
      const y = (await s.box(stack)).y;
      return (await panelRows(s)).map(([top, bottom]) => [top - y, bottom - y]);
    };
    const reach = async (): Promise<number> => (await s.box(tips)).y - (await s.box(stack)).y;
    const warned = await relRows();
    const warnedReach = await reach();
    for (let i = 0; i < 3; i++) await copies('increaseAria').click({ force: true });
    await s.ui.warm(30);
    const stacked = await relRows();
    const stackedReach = await reach();
    for (let i = 0; i < 3; i++) await copies('decreaseAria').click({ force: true });
    await s.ui.warm(10);
    await waitBaseplate(s);
    const st = await s.box(stack);
    const p = await panel(s);
    let top = -16;
    while (!isClear([warned, stacked], top, 3)) top--;
    const bottom = clearLine([warned, stacked], Math.max(warnedReach, stackedReach) + 20);
    const closeUp: Rect = { x: p.x, y: st.y + top, width: p.width, height: bottom - top };
    // Out of the frame between clicks, so the cursor covers no text.
    const away: [number, number] = [closeUp.x + closeUp.width + 60, st.y];
    await s.ui.park(...away);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(1.4);
        for (let i = 0; i < 3; i++) {
          await s.ui.click(copies('increaseAria'));
          await s.ui.hold(0.3);
        }
        await s.ui.moveTo(...away);
        await s.ui.hold(1.4);
      },
      CLIP_WIDTH / closeUp.width
    );
    await s.ui.hideCursor();
    await waitBaseplate(s);
    // The preview refits its camera to the tower.
    await s.ui.warm(150);
    const tower = frameAround(
      await partBox(s),
      24,
      closeUp.width / closeUp.height,
      await canvas(s)
    );
    await s.take(tower, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

/** On a 180 mm bed, the screwdriver bin must split. */
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

const splitRow: Shot = {
  id: 'printing-print-list-split-row',
  kind: 'still',
  viewport: TALL,
  async take(s) {
    await openLayouts(s, TOOL_DRAWER);
    const list = s.page.locator('aside').last();
    await s.ui.preClick(list.getByRole('row').filter({ hasText: 'Screwdrivers' }).first());
    // Deselects the bin, so the inspector gives the list its room back.
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    await s.dismissToasts();
    // Off the row, which would keep its hover shade.
    await s.ui.park(TALL.width - 140, 160);
    const into = list.getByText(label('rightPanel.splitInto').trim()).first();
    await s.until(into);
    const head = await s.box(binListHeader(s));
    const table = await s.box(list.getByRole('table').first());
    await s.still(
      {
        x: head.x,
        y: head.y - 4,
        width: TALL.width - head.x,
        height: table.y + table.height + 4 - (head.y - 4),
      },
      1.5
    );
  },
};

/** The menu opens where the button is clicked, so a still would hide the button. */
const findModels: Shot = {
  id: 'printing-print-list-find-models',
  kind: 'clip',
  async take(s) {
    await openLayouts(s, WORKBENCH);
    await s.ui.preClick(s.page.locator('[data-bin-id]', { hasText: 'Screwdrivers' }).first());
    await s.dismissToasts();
    const find = s.page
      .getByRole('button', { name: label('stlSearch.searchFor', { width: 4, depth: 2 }) })
      .first();
    await s.ui.preReveal(find);
    const right = await s.box(s.page.locator('aside').last());
    const f = await s.box(find);
    const area: Rect = {
      x: right.x,
      y: f.y - 8,
      width: right.width,
      height: (right.width * 3) / 4,
    };
    await s.ui.park(area.x + area.width * 0.9, f.y + f.height + 22);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.6);
        await s.ui.click(find);
        // Past the click ring, so the poster shows the open menu alone.
        await s.ui.hold(0.4);
        s.poster();
        await s.ui.hold(1.8);
      },
      CLIP_WIDTH / area.width
    );
  },
};

const paperPrint: Shot = {
  id: 'printing-print-list-paper',
  kind: 'still',
  // Tall enough that the dialog shows the page orientation without a scroll.
  viewport: { width: 1440, height: 1250 },
  async take(s) {
    await openLayouts(s, WORKBENCH);
    await s.ui.preClick(s.page.getByRole('button', { name: label('header.printLayout') }).first());
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog.getByRole('button', { name: label('print.printNow') }));
    await s.ui.preClick(
      dialog.getByRole('checkbox', { name: label('print.showBinList'), exact: true })
    );
    await s.page.waitForTimeout(800);
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.ui.park(6, 1244);
    await s.still(await s.box(dialog));
  },
};

/** The layout finds a design through the library index, so it goes in there too. */
async function saveDesign(s: DocsSession, name: string, params: Params): Promise<string> {
  return s.page.evaluate(
    async ([n, p]) => {
      type Saved = { ok: boolean; value?: { id: string; name: string; updatedAt: string } };
      const { getDesignStorePort } = (await import(
        '/src/core/storage/designStorePort.ts' as string
      )) as {
        getDesignStorePort(): {
          saveDesign(input: object): Promise<Saved>;
          registryEdgeFields(params: unknown): Promise<object>;
          registryPlacementFields(params: unknown): Promise<object>;
          upsertRegistryEntry(entry: object): Promise<{ ok: boolean }>;
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
      const params = deepMerge(DEFAULT_BIN_PARAMS, p) as Params;
      const res = await port.saveDesign({
        name: n,
        params,
        thumbnail: null,
        exportFileNameConfig: null,
      });
      if (!res.ok || !res.value) throw new Error(`could not save design ${n}`);
      const indexed = await port.upsertRegistryEntry({
        id: res.value.id,
        name: res.value.name,
        width: params.width,
        depth: params.depth,
        height: params.height,
        ...(await port.registryEdgeFields(params)),
        ...(await port.registryPlacementFields(params)),
        updatedAt: res.value.updatedAt,
      });
      if (!indexed.ok) throw new Error(`could not index design ${n}`);
      return res.value.id;
    },
    [name, params] as const
  );
}

async function openLinked(
  s: DocsSession,
  layout: FixtureLayout,
  designs: Record<string, { name: string; params: Params }>,
  linkOf: (bin: FixtureBin) => string | undefined
): Promise<void> {
  await s.open('/', grid);
  const ids: Record<string, string> = {};
  for (const [key, d] of Object.entries(designs)) ids[key] = await saveDesign(s, d.name, d.params);
  const file = layoutFile(layout) as { bins: object[] };
  const bins = layout.bins ?? [];
  await s.importLayouts(
    [
      {
        ...file,
        bins: file.bins.map((b, i) => {
          const fixture = bins[i];
          const key = fixture ? linkOf(fixture) : undefined;
          return key ? { ...b, linkedDesignId: ids[key] } : b;
        }),
      },
    ],
    grid
  );
}

const WORKBENCH_DESIGNS: Record<string, { name: string; params: Params }> = {
  '2x3': { name: 'Tall tool bin', params: { width: 2, depth: 3, height: 6 } },
  '1x1': { name: 'Screw bin', params: { width: 1, depth: 1, height: 6 } },
  '3x2': { name: 'Wide parts bin', params: { width: 3, depth: 2, height: 6 } },
  '4x2': { name: 'Screwdriver bin', params: { width: 4, depth: 2, height: 6 } },
  '2x2': { name: 'Bit bin', params: { width: 2, depth: 2, height: 6 } },
};

/** Two bins still wait for a design, so the dialog counts what it skips. */
const UNLINKED = new Set(['Tape measure', 'Fuses']);

const layoutExport: Shot = {
  id: 'printing-print-list-export',
  kind: 'still',
  async take(s) {
    await openLinked(s, WORKBENCH, WORKBENCH_DESIGNS, (b) =>
      UNLINKED.has(b.label ?? '') ? undefined : `${b.w}x${b.d}`
    );
    await s.ui.preClick(s.page.getByRole('button', { name: label('layoutExport.button') }).first());
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog.getByRole('button', { name: label('layoutExport.download') }));
    await s.page.waitForTimeout(800);
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.still(await s.box(dialog));
  },
};

const PARTS_DRAWER: FixtureLayout = {
  name: 'Parts drawer',
  width: 6,
  depth: 4,
  height: 8,
  categories: WORKSHOP_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 3 }],
  bins: [
    { x: 0, y: 0, w: 1, d: 1, h: 3, cat: 'Fasteners' },
    { x: 1, y: 0, w: 1, d: 1, h: 3, cat: 'Fasteners' },
    { x: 2, y: 0, w: 1, d: 1, h: 3, cat: 'Fasteners' },
    { x: 3, y: 0, w: 3, d: 2, h: 3, label: 'Wire nuts', cat: 'Electrical' },
    { x: 0, y: 1, w: 3, d: 3, h: 3, label: 'Hex keys', cat: 'Hand tools' },
    { x: 3, y: 2, w: 3, d: 2, h: 3, label: 'Fuses', cat: 'Spares' },
  ],
};

const blankLabels: Shot = {
  id: 'printing-troubleshooting-blank-labels',
  kind: 'still',
  viewport: TALL,
  async take(s) {
    await openLinked(
      s,
      PARTS_DRAWER,
      {
        screw: {
          name: 'Screw bin',
          params: { width: 1, depth: 1, height: 3, label: { enabled: true } },
        },
      },
      (b) => (b.w === 1 ? 'screw' : undefined)
    );
    const list = s.page.locator('aside').last();
    await s.until(list.getByText(label('print.row.blankLabelTabs')).first());
    const head = await s.box(binListHeader(s));
    const table = await s.box(list.getByRole('table').first());
    await s.still(
      {
        x: head.x,
        y: head.y - 4,
        width: TALL.width - head.x,
        height: table.y + table.height + 4 - (head.y - 4),
      },
      1.5
    );
  },
};

async function openSettingsTab(
  s: DocsSession,
  tab: 'settings.tabs.exports' | 'settings.tabs.print'
): Promise<void> {
  await openLayouts(s, WORKBENCH);
  await s.ui.preClick(s.page.getByRole('button', { name: label('sidebar.openSettings') }).first());
  const dialog = s.page.getByRole('dialog').first();
  await s.until(dialog);
  const button = dialog.getByRole('tab', { name: label(tab), exact: true });
  await s.ui.preClick(button);
  // The click scrolled the tab list; back to its top, as it opens.
  await button.evaluate((el) => {
    for (let n = el.parentElement; n; n = n.parentElement)
      if (n.scrollHeight > n.clientHeight + 4) n.scrollTop = 0;
  });
  await s.page.waitForTimeout(600);
  await s.ui.warm(20);
  await s.dismissToasts();
  await s.ui.park(6, DESKTOP.height - 6);
  const d = await s.box(dialog);
  const t = await s.box(button);
  const content = await dialog
    .getByRole('tabpanel')
    .first()
    .evaluate((el) =>
      Math.max(
        ...[...el.querySelectorAll('*')]
          .map((n) => n.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => r.bottom)
      )
    );
  // Down to the tab and the last setting: below them the dialog is empty. The
  // next tab starts right under this one, its label well inside its box.
  const bottom = Math.max(t.y + t.height + 4, content + 16);
  await s.still({ ...d, height: bottom - d.y });
}

const exportDestination: Shot = {
  id: 'printing-file-formats-destination',
  kind: 'still',
  take: (s) => openSettingsTab(s, 'settings.tabs.exports'),
};

const estimateSettings: Shot = {
  id: 'printing-estimates-settings',
  kind: 'still',
  take: (s) => openSettingsTab(s, 'settings.tabs.print'),
};

export const BASEPLATES_PRINTING: readonly Shot[] = [
  basicsPanel,
  basicsLibrary,
  stackSection,
  magnetsBaseSection,
  magnetsScrewSettings,
  shapedPlate,
  gridPosition,
  splittingMap,
  sizeFromMm,
  marginsAnchor,
  fitToDrawer,
  magnetSettings,
  undersideMagnets,
  bedSize,
  connectors,
  splitExport,
  ecoPlate,
  stackCopies,
  printList,
  estimatesSummary,
  formatsDialog,
  filamentMap,
  connectorTest,
  splitRow,
  findModels,
  paperPrint,
  layoutExport,
  blankLabels,
  exportDestination,
  estimateSettings,
];
