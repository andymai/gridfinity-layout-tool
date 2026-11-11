import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { label } from '../labels';
import { DESKTOP, frameAround, pad } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { designerReady, openDesigner } from './apps';
import type { Params } from './apps';

/**
 * The editor takes 62% of the window: at half, its header wraps Clear all and
 * the pointer readout runs into Duplicate.
 */
const CUT_EDITOR_STORAGE = {
  'gridfinity-cutout-quickstart-seen': 'true',
  'gridfinity-cutout-inspector-collapsed': '0',
  'gridfinity-cutout-split': '0.62',
};

interface CutoutSpec {
  id: string;
  shape: 'rectangle' | 'circle' | 'polygon' | 'slot';
  /** mm from the inside left wall to the left edge. */
  x: number;
  /** mm from the inside front wall to the front edge. */
  y: number;
  width: number;
  depth: number;
  acrossFlats?: number;
  [field: string]: unknown;
}

const doneButton = (page: Page): Locator =>
  page.getByRole('button', { name: label('binDesigner.cutoutEditor.done'), exact: true }).first();

async function openCutEditor(
  s: DocsSession,
  name: string,
  params: Params,
  cutouts: readonly CutoutSpec[]
): Promise<void> {
  // A solid body needs both flags, or the cutouts cut nothing.
  await openDesigner(s, name, {
    ...params,
    style: 'solid',
    base: { ...(params.base as Params | undefined), solid: true },
  });
  await s.page.evaluate(async (specs) => {
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as {
      useDesignerStore: {
        getState(): {
          setParams(p: object): void;
          setCutoutEditorOpen(open: boolean): void;
        };
      };
    };
    const { createDefaultCutout } = (await import(
      '/src/features/bin-designer/components/panel/CutoutsSection/cutoutHelpers.ts' as string
    )) as {
      createDefaultCutout(
        id: string,
        shape: string,
        x: number,
        y: number,
        w: number,
        d: number
      ): object;
    };
    const { polygonBoxFromAcrossFlats } = (await import(
      '/src/shared/utils/cutoutPolygon.ts' as string
    )) as {
      polygonBoxFromAcrossFlats(sides: number, af: number): { width: number; depth: number };
    };
    const store = useDesignerStore.getState();
    store.setParams({
      cutouts: specs.map(({ id, shape, x, y, width, depth, acrossFlats, ...rest }) => {
        const box =
          typeof acrossFlats === 'number'
            ? polygonBoxFromAcrossFlats(6, acrossFlats)
            : { width, depth };
        return { ...createDefaultCutout(id, shape, x, y, box.width, box.depth), ...rest };
      }),
    });
    store.setCutoutEditorOpen(true);
  }, cutouts);
  await s.until(doneButton(s.page), 60000);
  await s.ui.waitBuilt();
  await s.page.waitForTimeout(800);
  await s.ui.warm(20);
  await s.dismissToasts();
}

/** Reads the rulers' tick labels, so it follows the editor's own zoom and pan. */
async function boardToScreen(page: Page): Promise<(mm: [number, number]) => [number, number]> {
  const m = await page.evaluate(() => {
    const rulers = [...document.querySelectorAll('svg')].filter((svg) => {
      const r = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll('text')].filter((t) =>
        /^\d+$/.test(t.textContent ?? '')
      );
      return Math.min(r.width, r.height) === 24 && labels.length >= 2;
    });
    const wide = (svg: SVGSVGElement): boolean =>
      svg.getBoundingClientRect().width > svg.getBoundingClientRect().height;
    const across = rulers.find(wide);
    const down = rulers.find((svg) => !wide(svg));
    if (!across || !down) throw new Error('no rulers');
    // Labels sit 2 px past their tick, along the ruler.
    const ticks = (svg: SVGSVGElement, axis: 'x' | 'y'): [number, number][] => {
      const r = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('text')].map((t) => [
        Number(t.textContent),
        axis === 'x'
          ? r.left + Number(t.getAttribute('x')) - 2
          : r.top + Number(t.getAttribute('y')) + 2,
      ]);
    };
    const span = (pairs: [number, number][]): { mm0: number; px0: number; perMm: number } => {
      const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (!first || !last || first[0] === last[0]) throw new Error('a ruler shows one label');
      return { mm0: first[0], px0: first[1], perMm: (last[1] - first[1]) / (last[0] - first[0]) };
    };
    return { x: span(ticks(across, 'x')), y: span(ticks(down, 'y')) };
  });
  return ([x, y]) => [m.x.px0 + (x - m.x.mm0) * m.x.perMm, m.y.px0 + (y - m.y.mm0) * m.y.perMm];
}

function boardRect(
  toScreen: (mm: [number, number]) => [number, number],
  x: number,
  y: number,
  width: number,
  depth: number
): Rect {
  const [x0, y1] = toScreen([x, y]);
  const [x1, y0] = toScreen([x + width, y + depth]);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

async function interior(s: DocsSession): Promise<{ innerW: number; innerD: number }> {
  return s.page.evaluate(async () => {
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as { useDesignerStore: { getState(): { params: object } } };
    const { cutoutInterior } = (await import(
      '/src/features/bin-designer/utils/binDimensions.ts' as string
    )) as { cutoutInterior(p: object): { innerW: number; innerD: number } };
    const { innerW, innerD } = cutoutInterior(useDesignerStore.getState().params);
    return { innerW, innerD };
  });
}

async function dockBox(s: DocsSession): Promise<Rect> {
  const tab = await s.page
    .getByRole('tab', { name: label('binDesigner.shapeList.tabProperties') })
    .first()
    .elementHandle();
  return s.page
    .getByRole('button', { name: label('binDesigner.cutoutEditor.inspectorCollapse') })
    .first()
    .evaluate((el, t) => {
      let n: HTMLElement | null = el as HTMLElement;
      while (n && !(t && n.contains(t))) n = n.parentElement;
      if (!n) throw new Error('no dock');
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, tab);
}

/**
 * scrollIntoView would also nudge the editor pane, leaving measured board
 * positions stale.
 */
async function dockReveal(s: DocsSession, target: Locator): Promise<void> {
  await target.evaluate((el) => {
    let n = el.parentElement;
    while (
      n &&
      !(n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))
    )
      n = n.parentElement;
    if (!n) return;
    const r = el.getBoundingClientRect();
    const box = n.getBoundingClientRect();
    n.scrollTop += r.top + r.height / 2 - (box.top + box.height / 2);
  });
  await s.ui.warm(10);
}

async function selectAt(s: DocsSession, mm: [number, number]): Promise<void> {
  const [x, y] = (await boardToScreen(s.page))(mm);
  await s.page.mouse.click(x, y);
  const view = s.page.viewportSize() ?? DESKTOP;
  await s.page.mouse.move(view.width - 20, view.height - 20);
  await s.ui.warm(20);
  await s.page.waitForTimeout(400);
  await s.ui.warm(20);
}

async function boardBox(s: DocsSession): Promise<Rect> {
  const { innerW, innerD } = await interior(s);
  return boardRect(await boardToScreen(s.page), 0, 0, innerW, innerD);
}

/** Short enough that the board, centred in its canvas, sits close under the editor header. */
const EDITOR_VIEW = { width: DESKTOP.width, height: 760 };

const basicsEditor: Shot = {
  id: 'cutouts-basics-editor',
  kind: 'still',
  viewport: EDITOR_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Driver kit', { width: 3, depth: 2, height: 4 }, [
      { id: 'driver', shape: 'slot', x: 8, y: 8, width: 104, depth: 20 },
      { id: 'bits', shape: 'rectangle', x: 76, y: 34, width: 36, depth: 40 },
      { id: 'key', shape: 'polygon', x: 34, y: 49, width: 0, depth: 0, acrossFlats: 10 },
    ]);
    await selectAt(s, [40, 54]);
    const dock = await dockBox(s);
    await s.still({ x: 0, y: 48, width: dock.x + dock.width, height: EDITOR_VIEW.height - 48 });
  },
};

/** Short, so the board sits up beside the checks list. */
const CHECKS_VIEW = { width: DESKTOP.width, height: 640 };

const printChecksList: Shot = {
  id: 'cutouts-print-checks-list',
  kind: 'still',
  viewport: CHECKS_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    // A socket base counts toward the floor, so only a flat base lets a pocket floor run thin.
    await openCutEditor(
      s,
      'Socket tray',
      { width: 2, depth: 1, height: 3, base: { style: 'flat' } },
      [
        { id: 'socket', shape: 'circle', x: 13, y: 11.5, width: 16, depth: 16 },
        // Tucked into a corner, where the rounded wall runs thinnest.
        { id: 'bit', shape: 'rectangle', x: 0, y: 30, width: 12, depth: 9.1 },
        {
          id: 'adapter',
          shape: 'rectangle',
          x: 38,
          y: 8,
          width: 36,
          depth: 23,
          depthMode: 'floor',
          floorMm: 0.8,
        },
      ]
    );
    const dock = await dockBox(s);
    const board = await boardBox(s);
    // Down past the bin size row, which the board's bottom edge would otherwise cut through.
    const sizeRow = await s.box(
      s.page
        .getByRole('button', {
          name: label('common.increaseAria', { what: label('common.depth') }),
        })
        .first()
    );
    const bottom = Math.max(board.y + board.height + 16, sizeRow.y + sizeRow.height + 14);
    const left = board.x - 14;
    await s.still({
      x: left,
      y: dock.y,
      width: dock.x + dock.width - left,
      height: bottom - dock.y,
    });
  },
};

type Pt = [number, number];

function arc(c: Pt, r: number, a0: number, a1: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

/** The outline runs counterclockwise, as `triangulate` needs. */
function wrenchOutline(): Pt[] {
  const shaft = 5.5;
  // How far a jaw's lips stand out from the head's centre, along the wrench.
  const rim = (r: number, jaw: number): number => Math.sqrt(r * r - (jaw / 2) ** 2);
  const head = (c: Pt, r: number, jaw: number, reach: number, dir: 1 | -1): Pt[] => {
    const meet = Math.asin(shaft / r);
    const lip = Math.asin(jaw / 2 / r);
    const bottom = c[0] + dir * (rim(r, jaw) - reach);
    // The jaw opens away from the shaft; the outline crosses it from one lip to the other.
    return dir === -1
      ? [
          ...arc(c, r, meet, Math.PI - lip, 24),
          [bottom, jaw / 2],
          [bottom, -jaw / 2],
          ...arc(c, r, Math.PI + lip, 2 * Math.PI - meet, 24),
        ]
      : [
          ...arc(c, r, Math.PI + meet, 2 * Math.PI - lip, 24),
          [bottom, -jaw / 2],
          [bottom, jaw / 2],
          ...arc(c, r, lip, Math.PI - meet, 24),
        ];
  };
  // Each head's centre sits that far in from its end, so the lips span 150 mm.
  return [
    ...head([rim(17, 13), 0], 17, 13, 15, -1),
    ...head([150 - rim(14, 10), 0], 14, 10, 12, 1),
  ];
}

/** The polygon must be simple and counterclockwise. */
function triangulate(poly: readonly Pt[]): [number, number, number][] {
  const idx = poly.map((_, i) => i);
  const tris: [number, number, number][] = [];
  const at = (i: number): Pt => poly[i] ?? [0, 0];
  const cross = (a: Pt, b: Pt, c: Pt): number =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  while (idx.length > 3) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length] ?? 0;
      const i1 = idx[k] ?? 0;
      const i2 = idx[(k + 1) % idx.length] ?? 0;
      const [a, b, c] = [at(i0), at(i1), at(i2)];
      if (cross(a, b, c) <= 1e-9) continue;
      const inside = idx.some(
        (j) =>
          j !== i0 &&
          j !== i1 &&
          j !== i2 &&
          cross(a, b, at(j)) >= 0 &&
          cross(b, c, at(j)) >= 0 &&
          cross(c, a, at(j)) >= 0
      );
      if (inside) continue;
      tris.push([i0, i1, i2]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error('wrench outline does not triangulate');
  }
  tris.push([idx[0] ?? 0, idx[1] ?? 0, idx[2] ?? 0]);
  return tris;
}

function wrenchStl(): Buffer {
  const outline = wrenchOutline();
  const thick = 6;
  type V = [number, number, number];
  const tris: [V, V, V][] = [];
  const at = (i: number): Pt => outline[i] ?? [0, 0];
  for (const [a, b, c] of triangulate(outline)) {
    tris.push([
      [...at(a), thick],
      [...at(b), thick],
      [...at(c), thick],
    ]);
    tris.push([
      [...at(a), 0],
      [...at(c), 0],
      [...at(b), 0],
    ]);
  }
  for (let i = 0; i < outline.length; i++) {
    const p = at(i);
    const q = at((i + 1) % outline.length);
    tris.push([
      [...p, 0],
      [...q, 0],
      [...q, thick],
    ]);
    tris.push([
      [...p, 0],
      [...q, thick],
      [...p, thick],
    ]);
  }
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.writeUInt32LE(tris.length, 80);
  tris.forEach((tri, n) => {
    const o = 84 + n * 50;
    const [a, b, c] = tri;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0);
    const ny = (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0);
    const nz = (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0);
    const len = Math.hypot(nx, ny, nz) || 1;
    [nx / len, ny / len, nz / len, ...a, ...b, ...c].forEach((f, k) =>
      buf.writeFloatLE(f, o + k * 4)
    );
  });
  return buf;
}

const importStlDialog: Shot = {
  id: 'cutouts-import-stl-dialog',
  kind: 'still',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Wrench tray', { width: 4, depth: 2, height: 3 }, []);
    const chooser = s.page.waitForEvent('filechooser');
    await s.ui.preClick(
      s.page
        .getByRole('button', { name: label('binDesigner.cutouts.importStl'), exact: true })
        .first()
    );
    await (
      await chooser
    ).setFiles({ name: 'wrench-13-10.stl', mimeType: 'model/stl', buffer: wrenchStl() });
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    const dialog = s.page.getByRole('dialog', {
      name: label('binDesigner.cutouts.stlImport.title'),
    });
    await s.until(
      dialog.getByRole('button', { name: label('binDesigner.cutouts.stlImport.place') })
    );
    await s.page.waitForTimeout(1500);
    await s.ui.warm(40);
    await s.still(pad(await s.box(dialog), 12, DESKTOP));
  },
};

/** The scan dialog's two endpoints need Redis; the session waits for a photo that never comes. */
async function pendingScan(page: Page): Promise<void> {
  const token = 'docs-scan-session';
  await page.route('**/api/scan-session', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        token,
        url: `https://gridfinitylayouttool.com/scan/${token}`,
        expiresInSeconds: 600,
      }),
    })
  );
  await page.route('**/api/scan-session/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'pending' }),
    })
  );
}

const DESK = { light: '#e7e5e4', dark: '#27272a' };

const phoneScanSheet: Shot = {
  id: 'cutouts-phone-scan-sheet',
  kind: 'still',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await pendingScan(s.page);
    await openCutEditor(s, 'Wrench tray', { width: 4, depth: 2, height: 3 }, []);
    const scan = label('binDesigner.cutouts.scanImport.title');
    await s.ui.preClick(s.page.getByRole('button', { name: scan, exact: true }).first());
    const dialog = s.page.getByRole('dialog').first();
    await s.ui.preClick(
      dialog.getByRole('button', {
        name: new RegExp(`^${label('binDesigner.cutouts.scanImport.routePhone')}`),
      })
    );
    const sheetButton = dialog.getByRole('button', {
      name: label('binDesigner.cutouts.scanImport.calibrationSheet'),
    });
    await s.until(sheetButton);
    const download = s.page.waitForEvent('download');
    await sheetButton.click({ force: true });
    await s.ui.warm(6);
    const svg = readFileSync(await (await download).path(), 'utf8');
    // Inline, so its Helvetica falls back to the app's own sans: headless
    // Chromium has no Helvetica or Arial and would set the text in a monospace face.
    await s.page.evaluate(
      ([markup, desk]) => {
        const layer = document.createElement('div');
        layer.style.cssText = `position:fixed;inset:0;z-index:2147483640;background:${desk};display:flex;align-items:center;justify-content:center;`;
        const sheet = document.createElement('div');
        sheet.id = 'docs-sheet';
        sheet.style.cssText = `width:${210 * 2.3}px;height:${297 * 2.3}px;box-shadow:0 6px 24px rgba(0,0,0,.3);`;
        const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
        const svgEl = document.importNode(parsed, true) as unknown as SVGSVGElement;
        svgEl.style.cssText = 'width:100%;height:100%;display:block;';
        sheet.appendChild(svgEl);
        const font = getComputedStyle(document.body).fontFamily;
        for (const el of sheet.querySelectorAll<SVGElement>('svg, g, text'))
          el.style.fontFamily = font;
        layer.appendChild(sheet);
        document.body.appendChild(layer);
      },
      [svg, DESK[s.theme]] as const
    );
    await s.ui.warm(10);
    await s.still(pad(await s.box(s.page.locator('#docs-sheet')), 24, DESKTOP));
  },
};

const workshopBuild: Shot = {
  id: 'cutouts-workshop-build',
  kind: 'still',
  async take(s) {
    await s.open('/designer', designerReady);
    await s.page.evaluate(async () => {
      const { useDesignerStore } = (await import(
        '/src/features/bin-designer/store/designer.ts' as string
      )) as {
        useDesignerStore: {
          getState(): {
            newDesign(kind: string): void;
            updateEnvelope(patch: object): void;
          };
        };
      };
      useDesignerStore.getState().newDesign('assembly');
      useDesignerStore.getState().updateEnvelope({ width: 3, depth: 2 });
    });
    await s.ui.warm(20);
    await s.page.waitForTimeout(1000);
    await s.ui.preClick(
      s.page
        .getByRole('button', { name: label('workshop.template.screwdriverStation'), exact: true })
        .first()
    );
    await s.page.evaluate(async () => {
      const { useDesignerStore } = (await import(
        '/src/features/bin-designer/store/designer.ts' as string
      )) as {
        useDesignerStore: {
          getState(): {
            setDesignName(name: string): void;
            setSelectedAssemblyPartId(id: string | null): void;
            structure: { parts: { children: { id: string }[] }[] } | null;
          };
        };
      };
      const st = useDesignerStore.getState();
      st.setDesignName('Driver stand');
      const bank = st.structure?.parts[0]?.children[0];
      if (!bank) throw new Error('the template built no bit bank');
      st.setSelectedAssemblyPartId(bank.id);
    });
    await s.ui.waitBuilt();
    await s.page.waitForTimeout(2000);
    await s.ui.warm(40);
    await s.dismissToasts();
    await s.still({ x: 0, y: 48, width: DESKTOP.width, height: DESKTOP.height - 48 });
  },
};

/**
 * `partBox` reads the first canvas, which here is the board's, so this frame
 * assumes that the preview centres the bin.
 */
async function previewFrame(s: DocsSession): Promise<Rect> {
  const canvas = await s.page.evaluate(() => {
    const boxes = [...document.querySelectorAll('canvas')].map((c) => c.getBoundingClientRect());
    const right = boxes.reduce((a, b) => (b.x > a.x ? b : a));
    return { x: right.x, y: right.y, width: right.width, height: right.height };
  });
  const height = (canvas.width * 3) / 4;
  return { x: canvas.x, y: canvas.y + (canvas.height - height) / 2, width: canvas.width, height };
}

async function typeInto(s: DocsSession, field: Locator, value: string): Promise<void> {
  await s.ui.click(field);
  await s.page.keyboard.press('ControlOrMeta+a');
  await s.type(value);
  await s.keys('Enter');
}

/** A 3x1 tray: interior 123.1 x 39.1 mm. */
const SCREWDRIVER = { x: 6.55, y: 7.55, width: 110, depth: 24 };

const basicsSplit: Shot = {
  id: 'cutouts-basics-split',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    const slot = SCREWDRIVER;
    await openCutEditor(s, 'Screwdriver tray', { width: 3, depth: 1, height: 5 }, [
      { id: 'driver', shape: 'slot', ...slot },
    ]);
    await selectAt(s, [slot.x + slot.width / 2, slot.y + slot.depth / 2]);
    const dock = await dockBox(s);
    const split = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.split.add'), exact: true })
      .first();
    const finger = s.page
      .getByRole('switch', { name: label('binDesigner.cutouts.finger.name'), exact: true })
      .first();
    await dockReveal(s, finger);
    // The side B fields take the split button's place, so one frame shows both in turn.
    const splitArea = async (): Promise<Rect> => {
      // Just under the Scoop radius slider, whose knob would peek in at the top edge.
      const top = (await s.box(finger)).y - 8;
      return { x: dock.x, y: top, width: dock.width, height: (dock.width * 3) / 4 };
    };
    const closeUp = await splitArea();
    // Between the Finger access label and its switch, where nothing lights up on hover.
    const idle = (r: Rect): [number, number] => [r.x + r.width * 0.6, r.y + r.height * 0.13];
    await s.ui.park(...idle(closeUp));
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(split);
        await s.ui.hold(0.5);
      },
      640 / closeUp.width
    );

    const toScreen = await boardToScreen(s.page);
    const third = slot.x + slot.width / 3;
    // Drawn from the back edge to the front, side B is the handle's third, on the left.
    const from = toScreen([third, slot.y + slot.depth + 4]);
    const to = toScreen([third, slot.y - 4]);
    const board = frameAround(
      boardRect(toScreen, slot.x, slot.y, slot.width, slot.depth),
      24,
      4 / 3,
      { x: 0, y: 88, width: dock.x, height: DESKTOP.height - 88 }
    );
    await s.ui.park(from[0] + 60, from[1] - 50);
    await s.take(board, async () => {
      await s.ui.hold(0.3);
      await s.ui.drag(from, to, 16);
      await s.ui.hold(0.8);
    });

    const sideB = s.page
      .getByRole('spinbutton', { name: label('binDesigner.cutouts.split.sideBDepth') })
      .first();
    const fields = await splitArea();
    await s.ui.park(...idle(fields));
    await s.take(fields, async () => {
      await s.ui.hold(0.3);
      await typeInto(s, sideB, '12');
      await s.ui.hold(0.4);
    });

    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.take(await previewFrame(s), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

/** A 2x2 tray: interior 81.1 mm square. Six 1/4" bits at a 12 mm pitch fill it. */
const BIT = { x: 6.9, y: 7.4 };

const arrangingRepeat: Shot = {
  id: 'cutouts-arranging-repeat',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Hex bit tray', { width: 2, depth: 2, height: 3 }, [
      { id: 'bit', shape: 'polygon', ...BIT, width: 0, depth: 0, acrossFlats: 6.35 },
    ]);
    await selectAt(s, [BIT.x + 3.6, BIT.y + 3.2]);
    const dock = await dockBox(s);
    const add = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.repeat.create'), exact: true })
      .first();
    await dockReveal(s, add);
    const heading = await s.box(
      s.page
        .getByRole('button', { name: label('binDesigner.cutouts.section.repeat'), exact: true })
        .first()
    );
    // Room for the grid controls that Add repeat opens, down to Fill bin.
    const closeUp = frameAround(
      { x: dock.x, y: heading.y - 6, width: dock.width, height: 222 },
      0,
      4 / 3,
      dock
    );
    // Right of the preset chips, clear of any control that lights up on hover.
    await s.ui.park(closeUp.x + closeUp.width * 0.88, closeUp.y + closeUp.height * 0.3);
    const field = (
      key: 'binDesigner.cutouts.repeat.pitchX' | 'binDesigner.cutouts.repeat.pitchY'
    ) => s.page.getByRole('spinbutton', { name: label(key) }).first();
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(add);
        await s.ui.hold(0.4);
        await typeInto(s, field('binDesigner.cutouts.repeat.pitchX'), '12');
        await typeInto(s, field('binDesigner.cutouts.repeat.pitchY'), '12');
        await s.ui.hold(0.2);
        await s.ui.click(
          s.page
            .getByRole('button', { name: label('binDesigner.cutouts.repeat.fillBin'), exact: true })
            .first()
        );
        await s.ui.hold(0.8);
      },
      640 / closeUp.width
    );

    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    // One step out, so the square board and a margin fit the 4:3 frame.
    await editorZoom(s, 'binDesigner.cutoutEditor.zoomOut', 1);
    const board = frameAround(await boardBox(s), 16, 4 / 3, {
      x: 0,
      y: 88,
      width: dock.x,
      height: DESKTOP.height - 88,
    });
    await s.take(board, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

async function editorZoom(
  s: DocsSession,
  key: 'binDesigner.cutoutEditor.zoomIn' | 'binDesigner.cutoutEditor.zoomOut',
  steps: number
): Promise<void> {
  const button = s.page.getByRole('button', { name: label(key), exact: true }).first();
  for (let i = 0; i < steps; i++) {
    await button.click({ force: true });
    await s.ui.warm(4);
  }
  await s.page.waitForTimeout(300);
  await s.ui.warm(20);
}

/** Short, so the board sits close under the top ruler. */
const RULER_VIEW = { width: DESKTOP.width, height: 600 };

const arrangingRuler: Shot = {
  id: 'cutouts-arranging-ruler',
  kind: 'clip',
  viewport: RULER_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    const gauge = { x: 10, y: 8.5, width: 30, depth: 22 };
    const pliers = { x: 48, y: 8.5, width: 24, depth: 22 };
    await openCutEditor(s, 'Caliper tray', { width: 2, depth: 1, height: 3 }, [
      { id: 'gauge', shape: 'rectangle', ...gauge },
      { id: 'pliers', shape: 'rectangle', ...pliers },
    ]);
    const mid = gauge.y + gauge.depth * 0.7;
    // The gap must be wider than the distance label, which sits on the line's
    // midpoint and would hide the line's ticks.
    const gap = (await boardToScreen(s.page))([(gauge.x + gauge.width + pliers.x) / 2, mid]);
    await s.page.mouse.move(...gap);
    for (let i = 0; i < 11; i++) {
      await s.page.mouse.wheel(0, -120);
      await s.ui.warm(4);
    }
    await s.page.waitForTimeout(300);
    await s.ui.warm(20);
    const toScreen = await boardToScreen(s.page);
    const dock = await dockBox(s);
    const from = toScreen([gauge.x + gauge.width, mid]);
    const to = toScreen([pliers.x, mid]);
    // The top and left rulers are 24 px deep, along the board canvas's top and left edges.
    const corner = await s.page.evaluate(() => {
      const r = document.querySelector('canvas')?.getBoundingClientRect();
      if (!r) throw new Error('no board canvas');
      return { x: r.x - 24, y: r.y - 24 };
    });
    const width = Math.min(to[0] + 80, dock.x) - corner.x;
    const area = { ...corner, width, height: (width * 3) / 4 };
    const rest: [number, number] = [to[0] + 30, Math.min(to[1] + 80, area.y + area.height - 40)];
    await s.ui.park(...rest);
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.keys('m', 'M');
      await s.ui.hold(0.2);
      await s.ui.drag(from, to, 14);
      await s.ui.moveTo(...rest);
      s.poster();
      await s.ui.hold(2);
    });
  },
};

/** The editor at half the window, so the board and the inspector share one readable frame. */
const FINGER_STORAGE = { ...CUT_EDITOR_STORAGE, 'gridfinity-cutout-split': '0.5' };

const printChecksFinger: Shot = {
  id: 'cutouts-print-checks-finger',
  kind: 'clip',
  storage: FINGER_STORAGE,
  async take(s) {
    const bar = { x: 12.5, y: 12, width: 140, depth: 22 };
    await openCutEditor(s, 'Pry bar tray', { width: 4, depth: 2, height: 4 }, [
      { id: 'bar', shape: 'rectangle', ...bar },
    ]);
    await selectAt(s, [bar.x + bar.width / 2, bar.y + bar.depth / 2]);
    const dock = await dockBox(s);
    const add = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.finger.add'), exact: true })
      .first();
    await dockReveal(s, add);
    const board = await boardBox(s);
    // The tool rail's edge to the inspector's, centred on the board.
    const width = dock.x + dock.width - 60;
    const height = (width * 3) / 4;
    const wide = {
      x: 60,
      y: Math.max(88, board.y + board.height / 2 - height / 2),
      width,
      height,
    };
    await s.ui.park(wide.x + wide.width * 0.55, wide.y + wide.height * 0.9);
    await s.take(wide, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(add);
      // The new scoop comes in selected, with its own Finger access settings.
      await s.ui.hold(0.8);
      await s.ui.click(
        s.page
          .getByRole('button', {
            name: label('binDesigner.cutouts.finger.form.circle'),
            exact: true,
          })
          .first()
      );
      await s.ui.hold(0.8);
    });

    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    // A zoom made off camera is gone by the time the take starts, so the wheel
    // turns on camera, after the rebuild's own camera moves have settled.
    await s.ui.warm(90);
    const preview = await previewFrame(s);
    await s.page.mouse.move(preview.x + preview.width * 0.15, preview.y + preview.height * 0.2);
    await s.take(preview, async () => {
      await s.ui.hold(0.3);
      for (let i = 0; i < 12; i++) {
        await s.page.mouse.wheel(0, -200);
        await s.ui.hold(0.08);
      }
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

export const CUTOUTS: readonly Shot[] = [
  basicsEditor,
  basicsSplit,
  arrangingRepeat,
  arrangingRuler,
  importStlDialog,
  phoneScanSheet,
  printChecksList,
  printChecksFinger,
  workshopBuild,
];
