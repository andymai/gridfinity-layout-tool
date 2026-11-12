import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { designerReady, openDesigner, setDesign } from './apps';
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

/** A designer panel group, folded off camera so a switch below it does not shift the view. */
async function foldGroup(
  s: DocsSession,
  key: 'binDesigner.group.shape' | 'binDesigner.group.lid'
): Promise<void> {
  const head = s.page.getByRole('button', { name: new RegExp(`^${label(key)}`) }).first();
  if ((await head.getAttribute('aria-expanded')) === 'false') return;
  await s.ui.preClick(head);
  await s.ui.warm(10);
}

/** The window below the app header is 4:3, so the editor and the preview fill one frame. */
const OPEN_VIEW = { width: 1200, height: 948 };

const basicsOpen: Shot = {
  id: 'cutouts-basics-open',
  kind: 'clip',
  viewport: OPEN_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openDesigner(s, 'Wrench tray', { width: 3, depth: 2, height: 4 });
    await foldGroup(s, 'binDesigner.group.shape');
    await foldGroup(s, 'binDesigner.group.lid');
    const radio = (
      key: 'binDesigner.interior.solid.title' | 'binDesigner.interior.standard.title'
    ) => s.page.getByRole('radio', { name: label(key), exact: true }).first();
    const solid = radio('binDesigner.interior.solid.title');
    await s.ui.preReveal(solid);
    const editorCard = s.page
      .getByRole('button', { name: new RegExp(`^${label('binDesigner.editCutouts')}`) })
      .first();
    // Off camera, once, to frame the shot on where the editor card appears.
    await solid.click({ force: true });
    await s.until(editorCard);
    const card = await s.box(editorCard);
    await radio('binDesigner.interior.standard.title').click({ force: true });
    await s.ui.waitBuilt();
    const panel = await s.box(s.page.locator('aside').first());
    const top = await s.box(radio('binDesigner.interior.standard.title'));
    const closeUp = frameAround(union(top, card), 12, 4 / 3, {
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: OPEN_VIEW.height - panel.y,
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.55);
    const cardAt: [number, number] = [card.x + card.width * 0.4, card.y + card.height / 2];
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(solid);
        await s.ui.hold(0.6);
        await s.ui.moveTo(...cardAt);
        await s.ui.hold(0.2);
      },
      640 / closeUp.width
    );
    // The editor opens over the panel, so the click that opens it is in the wide frame.
    await s.take(
      { x: 0, y: 48, width: OPEN_VIEW.width, height: OPEN_VIEW.height - 48 },
      async () => {
        await s.ui.hold(0.3);
        await s.ui.clickAt(...cardAt);
        await s.until(doneButton(s.page), 60000);
        // Over the empty floor of the 3D preview, where nothing lights up on hover.
        await s.ui.moveTo(OPEN_VIEW.width * 0.85, OPEN_VIEW.height * 0.85);
        s.poster();
        await s.ui.hold(2);
      }
    );
  },
};

/** Left of the inspector, below the editor header. */
async function boardArea(s: DocsSession): Promise<Rect> {
  const dock = await dockBox(s);
  const view = s.page.viewportSize() ?? DESKTOP;
  return { x: 0, y: 88, width: dock.x, height: view.height - 88 };
}

/**
 * The board is a canvas, drawn for the window's own pixel density, so a frame
 * must not magnify it: the editor zooms in until the board nearly fills its
 * area, and the frame is cropped around that.
 */
async function boardFrame(s: DocsSession, margin = 20): Promise<Rect> {
  const area = await boardArea(s);
  for (let i = 0; i < 6; i++) {
    const board = await boardBox(s);
    const fits = (k: number): boolean =>
      board.width * k + margin * 2 <= area.width && board.height * k + margin * 2 <= area.height;
    if (!fits(1.3)) break;
    await editorZoom(s, 'binDesigner.cutoutEditor.zoomIn', 1);
  }
  return frameAround(await boardBox(s), margin, 4 / 3, area);
}

/** Wheel steps on camera; the preview zooms toward its own centre. */
async function previewZoom(s: DocsSession, frame: Rect, steps: number): Promise<void> {
  await s.page.mouse.move(frame.x + frame.width * 0.5, frame.y + frame.height * 0.5);
  for (let i = 0; i < steps; i++) {
    await s.page.mouse.wheel(0, -200);
    await s.ui.hold(0.08);
  }
}

const basicsDraw: Shot = {
  id: 'cutouts-basics-draw',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Pliers tray', { width: 3, depth: 2, height: 4 }, [
      { id: 'pliers', shape: 'slot', x: 70, y: 52, width: 46, depth: 18 },
    ]);
    const tool = (
      key:
        | 'binDesigner.cutouts.addRectangle'
        | 'binDesigner.cutouts.pointerTool'
        | 'binDesigner.cutouts.addSlot'
    ) => s.page.getByRole('button', { name: label(key), exact: true }).first();
    const frame = await boardFrame(s);
    const rail = union(
      await s.box(tool('binDesigner.cutouts.pointerTool')),
      await s.box(tool('binDesigner.cutouts.addSlot'))
    );
    const closeUp = { x: 0, y: rail.y - 8, width: 320, height: 240 };
    await s.ui.park(closeUp.x + 220, closeUp.y + 170);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(tool('binDesigner.cutouts.addRectangle'));
        await s.ui.hold(0.4);
      },
      640 / closeUp.width
    );

    const toScreen = await boardToScreen(s.page);
    const from = toScreen([8, 74]);
    const to = toScreen([58, 44]);
    await s.ui.park(from[0] + 40, from[1] - 30);
    await s.take(frame, async () => {
      await s.ui.hold(0.3);
      await s.ui.drag(from, to, 18);
      await s.ui.hold(0.6);
      await s.keys('s', 'S');
      const slot = toScreen([30, 20]);
      await s.ui.clickAt(...slot);
      await s.ui.moveTo(slot[0] + 120, slot[1] + 40);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const basicsWallOpening: Shot = {
  id: 'cutouts-basics-wall-opening',
  kind: 'clip',
  storage: FINGER_STORAGE,
  async take(s) {
    const square = { x: 14, y: 7.5, width: 64, depth: 24 };
    await openCutEditor(s, 'Square tray', { width: 2, depth: 1, height: 3 }, [
      { id: 'square', shape: 'rectangle', ...square },
    ]);
    await selectAt(s, [square.x + square.width / 2, square.y + square.depth / 2]);
    const dock = await dockBox(s);
    const right = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.openSide.rightAria') })
      .first();
    await dockReveal(s, right);
    const row = await s.box(right);
    // From the Open through wall row down to the channel fields it opens.
    const closeUp = { x: dock.x, y: row.y - 8, width: dock.width, height: (dock.width * 3) / 4 };
    // Beside the hint, clear of the Repeat controls below.
    await s.ui.park(closeUp.x + closeUp.width * 0.75, closeUp.y + closeUp.height * 0.32);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(right);
        await s.ui.hold(1);
      },
      640 / closeUp.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.ui.warm(90);
    const preview = await previewFrame(s);
    await s.take(preview, async () => {
      await s.ui.hold(0.3);
      await previewZoom(s, preview, 3);
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const basicsLabel: Shot = {
  id: 'cutouts-basics-label',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    const keys = { x: 10, y: 12, width: 100, depth: 16 };
    await openCutEditor(s, 'Hex key tray', { width: 3, depth: 1, height: 3 }, [
      { id: 'keys', shape: 'slot', ...keys },
    ]);
    await selectAt(s, [keys.x + keys.width / 2, keys.y + keys.depth / 2]);
    const dock = await dockBox(s);
    const field = s.page
      .getByRole('textbox', { name: label('binDesigner.cutoutEngraveLabel') })
      .first();
    await dockReveal(s, field);
    const head = await s.box(
      s.page
        .getByRole('button', { name: label('binDesigner.cutouts.section.label'), exact: true })
        .first()
    );
    const closeUp = { x: dock.x, y: head.y - 10, width: dock.width, height: (dock.width * 3) / 4 };
    await s.ui.park(closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.45);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(field);
        await s.type('Hex keys');
        await s.keys('Enter');
        await s.ui.hold(0.4);
      },
      640 / closeUp.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.take(await boardFrame(s), async () => {
      await s.ui.hold(1.2);
    });
    await s.ui.warm(90);
    const preview = await previewFrame(s);
    await s.take(preview, async () => {
      await s.ui.hold(0.2);
      await previewZoom(s, preview, 4);
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

/**
 * Wide enough that the selection toolbar under the editor header shows every
 * button, and short enough that the board sits close under it.
 */
const TOOLBAR_VIEW = { width: 1680, height: 620 };
/** The header, the selection toolbar and the board, left of the inspector. */
const TOOLBAR_FRAME = { x: 0, y: 48, width: 760, height: 570 };

/** The selection toolbar's own button: the inspector repeats some of its names. */
async function toolbarButton(s: DocsSession, name: string): Promise<Locator> {
  for (const b of await s.page.getByRole('button', { name, exact: true }).all()) {
    const box = await b.boundingBox();
    if (box && box.y < 140) return b;
  }
  throw new Error(`no ${name} in the selection toolbar`);
}

const arrangingAlign: Shot = {
  id: 'cutouts-arranging-align',
  kind: 'clip',
  viewport: TOOLBAR_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Socket rail', { width: 4, depth: 2, height: 4 }, [
      { id: 's10', shape: 'circle', x: 14, y: 38, width: 16, depth: 16 },
      { id: 's13', shape: 'circle', x: 46, y: 20, width: 19, depth: 19 },
      { id: 's17', shape: 'circle', x: 104, y: 44, width: 23, depth: 23 },
    ]);
    const toScreen = await boardToScreen(s.page);
    const from = toScreen([4, 76]);
    const to = toScreen([140, 6]);
    await s.ui.park(from[0] + 30, from[1] - 40);
    await s.take(
      TOOLBAR_FRAME,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.drag(from, to, 20);
        await s.ui.hold(0.5);
        await s.ui.click(await toolbarButton(s, label('binDesigner.cutouts.alignBottom')));
        await s.ui.hold(0.7);
        await s.ui.click(await toolbarButton(s, label('binDesigner.cutouts.distributeH')));
        await s.ui.moveTo(TOOLBAR_FRAME.width * 0.6, TOOLBAR_FRAME.y + TOOLBAR_FRAME.height * 0.9);
        s.poster();
        await s.ui.hold(1.8);
      },
      640 / TOOLBAR_FRAME.width
    );
  },
};

/** Short, so the board sits close under the selection toolbar. */
const ARRANGE_VIEW = { width: DESKTOP.width, height: 570 };

const arrangingAutoArrange: Shot = {
  id: 'cutouts-arranging-auto-arrange',
  kind: 'clip',
  viewport: ARRANGE_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Bench tools', { width: 4, depth: 2, height: 4 }, [
      { id: 'knife', shape: 'slot', x: 8, y: 40, width: 62, depth: 16, rotation: 24 },
      { id: 'tape', shape: 'rectangle', x: 86, y: 34, width: 34, depth: 30, rotation: -17 },
      { id: 'pencil', shape: 'slot', x: 40, y: 14, width: 70, depth: 9, rotation: -8 },
      { id: 'square', shape: 'rectangle', x: 128, y: 12, width: 22, depth: 50, rotation: 12 },
    ]);
    const area = await boardArea(s);
    // The header, the selection toolbar and the board, left of the inspector.
    const wide = { x: 0, y: 48, width: area.width, height: (area.width * 3) / 4 };
    await s.ui.park(wide.width * 0.55, wide.y + wide.height * 0.92);
    await s.take(
      wide,
      async () => {
        await s.ui.hold(0.4);
        await s.keys('ControlOrMeta+a', 'Ctrl A');
        await s.ui.hold(0.6);
      },
      640 / wide.width
    );

    const auto = await toolbarButton(s, label('binDesigner.cutouts.autoArrange'));
    // Off camera, once, to frame the close-up on where the box opens.
    await auto.click({ force: true });
    await s.ui.warm(20);
    const head = await s.box(auto);
    let go: Locator | null = null;
    for (const b of await s.page
      .getByRole('button', { name: label('binDesigner.cutouts.autoArrange'), exact: true })
      .all()) {
      const box = await b.boundingBox();
      if (box && box.y > head.y + head.height) go = b;
    }
    if (!go) throw new Error('no Auto-arrange button in the box');
    const pop = union(
      head,
      await s.box(go),
      await s.box(s.page.getByText(label('binDesigner.cutouts.turnToFit')).first())
    );
    // Escape would also clear the selection.
    await auto.click({ force: true });
    await s.ui.warm(20);
    if (await go.isVisible()) throw new Error('the Auto-arrange box stays open');
    const closeUp = frameAround(pop, 64, 4 / 3, { x: 0, y: 0, ...ARRANGE_VIEW });
    await s.ui.park(closeUp.x + closeUp.width * 0.3, closeUp.y + closeUp.height * 0.9);
    await s.take(closeUp, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(auto);
      await s.ui.hold(0.9);
      if (!go) return;
      await s.ui.click(go);
    });
    await s.ui.hideCursor();
    await s.take(wide, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const arrangingRepeatLabels: Shot = {
  id: 'cutouts-arranging-repeat-labels',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    const bit = { x: 10, y: 12, width: 9, depth: 9 };
    await openCutEditor(s, 'Drill bit index', { width: 3, depth: 1, height: 4 }, [
      {
        id: 'bit',
        shape: 'circle',
        ...bit,
        // The copies' own labels engrave only once the single label has text.
        label: 'Drill',
        engraveLabel: true,
        array: {
          mode: 'grid',
          cols: 6,
          rows: 1,
          pitchX: 19,
          pitchY: 19,
          count: 6,
          radius: 20,
          startAngle: 0,
          rotateToCenter: false,
        },
      },
    ]);
    await selectAt(s, [bit.x + bit.width / 2, bit.y + bit.depth / 2]);
    const dock = await dockBox(s);
    const enable = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.repeat.labels.enable') })
      .first();
    await dockReveal(s, enable);
    const single = await s.box(
      s.page.getByRole('textbox', { name: label('binDesigner.cutoutEngraveLabel') }).first()
    );
    const closeUp = {
      x: dock.x,
      y: single.y - 12,
      width: dock.width,
      height: (dock.width * 3) / 4,
    };
    await s.ui.park(closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.12);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(enable);
        await s.ui.hold(0.5);
        await s.ui.click(
          s.page.getByRole('textbox', { name: label('binDesigner.cutouts.repeat.labels.title') })
        );
        // The list starts with one blank line per copy; the typed list replaces it.
        await s.page.keyboard.press('ControlOrMeta+a');
        for (const [i, size] of ['3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm'].entries()) {
          if (i > 0) await s.page.keyboard.press('Enter');
          await s.type(size);
        }
        await s.ui.hold(0.5);
      },
      640 / closeUp.width
    );
    await s.page.keyboard.press('Tab');
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.take(await boardFrame(s), async () => {
      await s.ui.hold(1.2);
    });
    await s.ui.warm(90);
    const preview = await previewFrame(s);
    // No zoom: the long tray already fills the frame from end to end.
    await s.take(preview, async () => {
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const arrangingGroup: Shot = {
  id: 'cutouts-arranging-group',
  kind: 'clip',
  viewport: TOOLBAR_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    // A roll of tape: the front circle keeps a post of plastic inside the ring.
    await openCutEditor(s, 'Tape roll holder', { width: 2, depth: 2, height: 4 }, [
      { id: 'roll', shape: 'circle', x: 8.05, y: 8.05, width: 65, depth: 65 },
      { id: 'core', shape: 'circle', x: 25.55, y: 25.55, width: 30, depth: 30 },
    ]);
    await s.ui.park(TOOLBAR_FRAME.width * 0.8, TOOLBAR_FRAME.y + TOOLBAR_FRAME.height * 0.9);
    await s.take(
      TOOLBAR_FRAME,
      async () => {
        await s.ui.hold(0.4);
        await s.keys('ControlOrMeta+a', 'Ctrl A');
        await s.ui.hold(0.3);
        await s.keys('ControlOrMeta+g', 'Ctrl G');
        await s.ui.hold(0.5);
        // The tooltip names each way to combine as the cursor rests on it.
        await s.ui.click(await toolbarButton(s, label('binDesigner.cutouts.pathfinder.subtract')));
        await s.ui.hold(1.2);
      },
      640 / TOOLBAR_FRAME.width
    );
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.ui.warm(90);
    const preview = await previewFrame(s);
    await s.take(preview, async () => {
      await s.ui.hold(0.2);
      await previewZoom(s, preview, 3);
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

/** Short, so the board sits up beside the warning. */
const CLIPPED_VIEW = { width: DESKTOP.width, height: 540 };

const arrangingOffBoard: Shot = {
  id: 'cutouts-arranging-off-board',
  kind: 'still',
  viewport: CLIPPED_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Socket rail', { width: 3, depth: 1, height: 4 }, [
      { id: 'pliers', shape: 'slot', x: 6, y: 9, width: 50, depth: 20 },
      {
        id: 'socket',
        shape: 'circle',
        x: 66,
        y: 9,
        width: 20,
        depth: 20,
        array: {
          mode: 'grid',
          cols: 4,
          rows: 1,
          pitchX: 24,
          pitchY: 24,
          count: 6,
          radius: 20,
          startAngle: 0,
          rotateToCenter: false,
        },
      },
    ]);
    const dock = await dockBox(s);
    const warning = await s.box(s.page.getByRole('alert').first());
    const board = await boardBox(s);
    const left = board.x - 14;
    const top = Math.min(board.y, warning.y) - 16;
    const bottom = Math.max(board.y + board.height, warning.y + warning.height) + 16;
    await s.still({ x: left, y: top, width: dock.x + dock.width - left, height: bottom - top });
  },
};

/** A ratchet, three sockets and an extension bar, drawn in mm as a vector app saves them. */
const RATCHET_SET_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="150mm" height="75mm" viewBox="0 0 150 75">',
  '<path d="M 31 17 L 136 18 A 4 4 0 0 1 136 26 L 31 27 A 13 13 0 1 1 31 17 Z"/>',
  '<circle cx="20" cy="58" r="8"/><circle cx="45" cy="58" r="9.5"/><circle cx="72" cy="58" r="11"/>',
  '<rect x="95" y="53" width="50" height="10" rx="5"/>',
  '</svg>',
].join('');

const railButton = (
  s: DocsSession,
  key: 'binDesigner.cutouts.importSvg' | 'binDesigner.cutouts.importStl'
): Locator => s.page.getByRole('button', { name: label(key), exact: true }).first();

/** The tool rail around `button`, with a strip of the board beside it. */
async function railCloseUp(s: DocsSession, button: Locator): Promise<Rect> {
  const b = await s.box(button);
  return { x: 0, y: b.y + b.height / 2 - 120, width: 320, height: 240 };
}

const importSvg: Shot = {
  id: 'cutouts-import-svg',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Ratchet set', { width: 4, depth: 2, height: 4 }, []);
    const button = railButton(s, 'binDesigner.cutouts.importSvg');
    const closeUp = await railCloseUp(s, button);
    await s.ui.park(closeUp.x + 230, closeUp.y + 200);
    const chooser = s.page.waitForEvent('filechooser');
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(button);
        await (
          await chooser
        ).setFiles({
          name: 'ratchet-set.svg',
          mimeType: 'image/svg+xml',
          buffer: Buffer.from(RATCHET_SET_SVG),
        });
      },
      640 / closeUp.width
    );
    const thickness = s.page
      .getByRole('textbox', { name: label('binDesigner.cutouts.depthPrompt.thickness') })
      .or(
        s.page.getByRole('spinbutton', {
          name: label('binDesigner.cutouts.depthPrompt.thickness'),
        })
      )
      .first();
    await s.until(thickness);
    await s.dismissToasts();
    const apply = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.depthPrompt.apply'), exact: true })
      .first();
    const prompt = pad(
      union(
        await s.box(
          s.page
            .getByText(label('binDesigner.cutouts.depthPrompt.titleMany_other', { count: 5 }))
            .first()
        ),
        await s.box(apply)
      ),
      18,
      DESKTOP
    );
    const area = await boardArea(s);
    // Below the prompt, which floats over the top of the board area.
    const below = {
      ...area,
      y: prompt.y + prompt.height,
      height: area.y + area.height - (prompt.y + prompt.height),
    };
    const board = frameAround(await boardBox(s), 20, 4 / 3, below);
    await s.ui.park(board.x + board.width * 0.5, board.y + board.height * 0.95);
    await s.ui.hideCursor();
    await s.take(board, async () => {
      await s.ui.hold(1);
    });
    const promptFrame = frameAround(prompt, 0, 4 / 3, await boardArea(s));
    const field = await s.box(thickness);
    await s.ui.park(field.x + field.width * 0.7, field.y + field.height + 40);
    await s.take(promptFrame, async () => {
      await s.ui.hold(0.3);
      await s.ui.click(thickness);
      await s.type('12');
      await s.ui.hold(0.3);
      const at = await s.box(apply);
      await s.ui.moveTo(at.x + at.width / 2, at.y + at.height / 2);
      await s.ui.hold(0.3);
    });
    // Off camera: the prompt closes at once, and the next take shows the result.
    await apply.click({ force: true });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.ui.warm(90);
    const preview = await previewFrame(s);
    await s.take(preview, async () => {
      await s.ui.hold(0.2);
      await previewZoom(s, preview, 2);
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const importStlResult: Shot = {
  id: 'cutouts-import-stl-result',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Wrench tray', { width: 4, depth: 2, height: 3 }, []);
    const chooser = s.page.waitForEvent('filechooser');
    await s.ui.preClick(railButton(s, 'binDesigner.cutouts.importStl'));
    await (
      await chooser
    ).setFiles({ name: 'wrench-13-10.stl', mimeType: 'model/stl', buffer: wrenchStl() });
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    const dialog = s.page.getByRole('dialog', {
      name: label('binDesigner.cutouts.stlImport.title'),
    });
    const place = dialog.getByRole('button', {
      name: label('binDesigner.cutouts.stlImport.place'),
    });
    await s.until(place);
    await s.page.waitForTimeout(1500);
    await s.ui.warm(40);
    const closeUp = frameAround(await s.box(dialog), 12, 4 / 3, { x: 0, y: 0, ...DESKTOP });
    const at = await s.box(place);
    await s.ui.park(at.x - 60, at.y - 50);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.5);
        await s.ui.moveTo(at.x + at.width / 2, at.y + at.height / 2);
        await s.ui.hold(0.4);
      },
      640 / closeUp.width
    );
    // Off camera: the dialog closes at once, and the next take shows the result.
    await place.click({ force: true });
    await s.ui.hideCursor();
    await s.ui.waitBuilt();
    await s.dismissToasts();
    await s.take(await boardFrame(s), async () => {
      await s.ui.hold(1.2);
    });
    await s.ui.warm(90);
    const preview = await previewFrame(s);
    await s.take(preview, async () => {
      await s.ui.hold(0.2);
      await previewZoom(s, preview, 2);
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

const importExportSvg: Shot = {
  id: 'cutouts-import-export-svg',
  kind: 'still',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    const knife = { x: 12, y: 46, width: 96, depth: 16 };
    const gouge = { x: 12, y: 18, width: 84, depth: 12 };
    await openCutEditor(s, 'Carving tools', { width: 3, depth: 2, height: 3 }, [
      { id: 'knife', shape: 'slot', ...knife },
      { id: 'gouge', shape: 'slot', ...gouge },
    ]);
    await s.page.keyboard.press('ControlOrMeta+a');
    await s.ui.warm(10);
    const [x, y] = (await boardToScreen(s.page))([gouge.x + 56, gouge.y + gouge.depth / 2]);
    await s.page.mouse.click(x, y, { button: 'right' });
    await s.ui.warm(20);
    const exportButton = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.exportSvg'), exact: true })
      .first();
    await s.until(exportButton);
    const menu = await exportButton.evaluate((el) => {
      let n: HTMLElement | null = el as HTMLElement;
      while (n && getComputedStyle(n).position !== 'fixed') n = n.parentElement;
      const r = (n ?? (el as HTMLElement)).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    await exportButton.hover({ force: true });
    await s.ui.warm(10);
    // Down to the divider under Delete: the rest of the menu is not this step.
    const del = await s.box(
      exportButton
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]')
        .getByRole('button', { name: new RegExp(`^${label('common.delete')}`) })
        .first()
    );
    const board = await boardBox(s);
    const left = board.x - 16;
    const top = board.y - 16;
    await s.still(
      {
        x: left,
        y: top,
        width: menu.x + menu.width + 16 - left,
        height: del.y + del.height + 6 - top,
      },
      1.25
    );
  },
};

/**
 * Runs in the page: a made-up desk photo of a wrench, a screwdriver and pliers
 * on the printed calibration sheet, as a JPEG data URL. Sheet millimetres map
 * to photo pixels through one scale and a slight turn, as a photo from above.
 */
function drawToolPhoto(): string {
  const W = 1600;
  const H = 2000;
  const PX = 6.4;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const desk = g.createLinearGradient(0, 0, W, H);
  desk.addColorStop(0, '#9c7a55');
  desk.addColorStop(1, '#7f6142');
  g.fillStyle = desk;
  g.fillRect(0, 0, W, H);
  // Faint grain along the desk.
  for (let i = 0; i < 90; i++) {
    const y = (i * 997) % H;
    g.strokeStyle = `rgba(60,40,20,${0.05 + ((i * 37) % 10) / 200})`;
    g.lineWidth = 2 + ((i * 13) % 5);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(W * 0.3, y + 18, W * 0.6, y - 14, W, y + 8);
    g.stroke();
  }
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate((-2.5 * Math.PI) / 180);
  g.scale(PX, PX);
  g.translate(-105, -148.5);
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 6;
  g.fillStyle = '#f7f6f2';
  g.fillRect(0, 0, 210, 297);
  g.shadowColor = 'transparent';
  g.fillStyle = '#111';
  const nodes: [number, number][] = [];
  for (let cIdx = 0; cIdx < 5; cIdx++)
    for (let r = 0; r < 6; r++)
      if (cIdx === 0 || cIdx === 4 || r === 0 || r === 5) nodes.push([21 + cIdx * 42, 21 + r * 42]);
  for (const [x, y] of nodes) g.fillRect(x - 7, y - 7, 14, 14);
  g.lineWidth = 0.4;
  g.strokeStyle = '#111';
  g.beginPath();
  g.moveTo(21, 254);
  g.lineTo(121, 254);
  for (let mm = 0; mm <= 100; mm += 10) {
    const tall = mm === 0 || mm === 100;
    g.moveTo(21 + mm, 254 - (tall ? 3 : 1.6));
    g.lineTo(21 + mm, 254 + (tall ? 3 : 1.6));
  }
  g.stroke();
  const font = getComputedStyle(document.body).fontFamily;
  // Text set at its final pixel size: a tiny font scaled up loses its spacing.
  const text = (str: string, x: number, y: number, size: number, weight: string): void => {
    g.save();
    g.scale(1 / PX, 1 / PX);
    g.font = `${weight} ${size * PX}px ${font}`;
    g.fillText(str, x * PX, y * PX);
    g.restore();
  };
  text('Gridfinity Layout Tool: scan calibration sheet', 21, 246, 4.2, '600');
  text('100 mm', 125, 255.4, 3.6, '400');

  const tool = (
    paint: string | CanvasGradient,
    draw: (p: Path2D) => void,
    holes?: (p: Path2D) => void
  ): void => {
    const p = new Path2D();
    draw(p);
    holes?.(p);
    g.save();
    g.shadowColor = 'rgba(0,0,0,.16)';
    g.shadowBlur = 3;
    g.shadowOffsetX = 0.6;
    g.shadowOffsetY = 0.9;
    g.fillStyle = paint;
    g.fill(p, holes ? 'evenodd' : 'nonzero');
    g.restore();
  };
  const circle = (p: Path2D, x: number, y: number, r: number): void => {
    p.moveTo(x + r, y);
    p.arc(x, y, r, 0, Math.PI * 2);
  };
  const steel = (x0: number, y0: number, x1: number, y1: number): CanvasGradient => {
    const s = g.createLinearGradient(x0, y0, x1, y1);
    s.addColorStop(0, '#5d646c');
    s.addColorStop(0.5, '#8a929b');
    s.addColorStop(1, '#4a5058');
    return s;
  };

  // Combination wrench, 13 mm: open jaw at the top, closed ring at the bottom.
  const wx = 56;
  tool(
    steel(wx - 16, 0, wx + 16, 0),
    (p) => {
      const top = 52;
      const ring = 192;
      p.moveTo(wx - 5.5, top + 14);
      p.arc(wx, top, 15, Math.PI / 2 + 0.38, Math.PI * 1.5 - 0.47, false);
      p.lineTo(wx - 6.5, top - 4);
      p.lineTo(wx + 6.5, top - 4);
      p.arc(wx, top, 15, Math.PI * 1.5 + 0.47, Math.PI / 2 - 0.38, false);
      p.lineTo(wx + 5.5, top + 14);
      p.lineTo(wx + 4.5, ring - 12);
      p.arc(wx, ring, 12.5, -Math.PI / 2 + 0.37, -Math.PI / 2 - 0.37 + Math.PI * 2, false);
      p.lineTo(wx - 4.5, ring - 12);
      p.closePath();
    },
    (p) => circle(p, wx, 192, 7)
  );

  // Screwdriver: red and yellow handle at the bottom, shaft up to a flat tip.
  const sx = 100;
  const shaft = g.createLinearGradient(sx - 3.5, 0, sx + 3.5, 0);
  shaft.addColorStop(0, '#3c4148');
  shaft.addColorStop(0.5, '#6a7179');
  shaft.addColorStop(1, '#353a40');
  tool(shaft, (p) => {
    p.moveTo(sx - 1.5, 44);
    p.lineTo(sx + 1.5, 44);
    p.lineTo(sx + 3.5, 52);
    p.lineTo(sx + 3.5, 130);
    p.lineTo(sx - 3.5, 130);
    p.lineTo(sx - 3.5, 52);
    p.closePath();
  });
  const grip = g.createLinearGradient(sx - 13, 0, sx + 13, 0);
  grip.addColorStop(0, '#9e1b1b');
  grip.addColorStop(0.45, '#d8352b');
  grip.addColorStop(1, '#8a1616');
  tool(grip, (p) => {
    p.moveTo(sx - 6, 126);
    p.lineTo(sx + 6, 126);
    p.quadraticCurveTo(sx + 13, 134, sx + 13, 146);
    p.lineTo(sx + 13, 204);
    p.quadraticCurveTo(sx + 13, 214, sx, 214);
    p.quadraticCurveTo(sx - 13, 214, sx - 13, 204);
    p.lineTo(sx - 13, 146);
    p.quadraticCurveTo(sx - 13, 134, sx - 6, 126);
    p.closePath();
  });

  // Pliers: pointed jaws at the top, a pivot, then two handles in blue grips.
  const px = 146;
  tool(steel(px - 10, 0, px + 10, 0), (p) => {
    p.moveTo(px - 1.5, 44);
    p.lineTo(px + 1.5, 44);
    p.lineTo(px + 7, 92);
    p.lineTo(px + 10, 104);
    p.lineTo(px + 14, 126);
    p.lineTo(px + 8, 128);
    p.lineTo(px, 112);
    p.lineTo(px - 8, 128);
    p.lineTo(px - 14, 126);
    p.lineTo(px - 10, 104);
    p.lineTo(px - 7, 92);
    p.closePath();
    circle(p, px, 100, 10);
  });
  const blue = g.createLinearGradient(px - 22, 0, px + 22, 0);
  blue.addColorStop(0, '#1d4f91');
  blue.addColorStop(0.5, '#2f6fc0');
  blue.addColorStop(1, '#1a457f');
  tool(blue, (p) => {
    p.moveTo(px + 8, 124);
    p.lineTo(px + 14, 122);
    p.lineTo(px + 22, 206);
    p.quadraticCurveTo(px + 22, 214, px + 16, 213);
    p.lineTo(px + 11, 210);
    p.closePath();
    p.moveTo(px - 8, 124);
    p.lineTo(px - 14, 122);
    p.lineTo(px - 22, 206);
    p.quadraticCurveTo(px - 22, 214, px - 16, 213);
    p.lineTo(px - 11, 210);
    p.closePath();
  });
  g.restore();
  // A soft light falloff toward one corner, as from a desk lamp.
  const lamp = g.createRadialGradient(W * 0.35, H * 0.3, 100, W * 0.5, H * 0.5, H * 0.85);
  lamp.addColorStop(0, 'rgba(255,250,235,0.06)');
  lamp.addColorStop(1, 'rgba(0,0,0,0.16)');
  g.fillStyle = lamp;
  g.fillRect(0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.9);
}

/** The tools photo as the file a maker would choose. */
async function toolPhoto(
  s: DocsSession
): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const url = await s.page.evaluate(drawToolPhoto);
  const data = url.split(',')[1];
  if (!data) throw new Error('the tools photo did not render');
  return {
    name: 'tools-on-sheet.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(data, 'base64'),
  };
}

const addTools = (page: Page): Locator =>
  page
    .getByRole('button', { name: label('binDesigner.cutouts.traceView.addMany', { count: 3 }) })
    .first();

const scanButton = (page: Page): Locator =>
  page
    .getByRole('button', { name: label('binDesigner.cutouts.scanImport.title'), exact: true })
    .first();

const photoRoute = (page: Page): Locator =>
  page
    .getByRole('button', { name: new RegExp(`^${label('binDesigner.cutouts.traceView.open')}`) })
    .first();

/** Off camera: Trace a photo, with the tools photo traced. */
async function openTraceView(s: DocsSession): Promise<void> {
  await openCutEditor(s, 'Tool tray', { width: 4, depth: 5, height: 4 }, []);
  const photo = await toolPhoto(s);
  await s.ui.preClick(scanButton(s.page));
  await s.ui.preClick(photoRoute(s.page));
  const chooser = s.page.waitForEvent('filechooser');
  await s.ui.preClick(
    s.page
      .getByRole('button', {
        name: label('binDesigner.cutouts.traceView.drop.choose'),
        exact: true,
      })
      .first()
  );
  await (await chooser).setFiles(photo);
  await traced(s);
}

/** Waits off camera for the three outlines; the tracer runs in real time. */
async function traced(s: DocsSession): Promise<void> {
  await s.until(addTools(s.page), 60000);
  await s.page.waitForTimeout(800);
  await s.ui.warm(30);
  await s.page.mouse.move(5, 5);
  await s.ui.warm(10);
}

/** The photo as shown, under the outlines the tracer draws over it. */
async function tracePhotoBox(s: DocsSession): Promise<Rect> {
  return s.box(
    s.page
      .getByRole('application', { name: label('binDesigner.cutouts.traceView.canvasLabel') })
      .locator('img')
      .first()
  );
}

/** Small enough that the Trace a photo window reads at the docs column width. */
const TRACE_VIEW = { width: 1280, height: 800 };

const photoTraceView: Shot = {
  id: 'cutouts-photo-trace-view',
  kind: 'still',
  viewport: TRACE_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openTraceView(s);
    await s.still({ x: 0, y: 0, ...TRACE_VIEW });
  },
};

/** 4:3, so the whole Trace a photo window is one frame of the clip. */
const TRACE_CLIP_VIEW = { width: 1200, height: 900 };

const photoTraceOpen: Shot = {
  id: 'cutouts-photo-trace-open',
  kind: 'clip',
  viewport: TRACE_CLIP_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Tool tray', { width: 4, depth: 5, height: 4 }, []);
    const photo = await toolPhoto(s);
    const scan = scanButton(s.page);
    // Off camera, once, to frame the close-up on where the choice opens.
    await s.ui.preClick(scan);
    const choice = s.page.getByRole('dialog').first();
    await s.until(photoRoute(s.page));
    const dialogBox = await s.box(choice);
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    const closeUp = frameAround(union(await s.box(scan), dialogBox), 16, 4 / 3, {
      x: 0,
      y: 0,
      ...TRACE_CLIP_VIEW,
    });
    await s.ui.park(closeUp.x + closeUp.width * 0.5, closeUp.y + closeUp.height * 0.95);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(scan);
        await s.ui.hold(0.6);
        const route = await s.box(photoRoute(s.page));
        await s.ui.moveTo(route.x + route.width / 2, route.y + route.height / 2);
        await s.ui.hold(0.3);
      },
      640 / closeUp.width
    );
    // Off camera: the window opens over everything, and the next take starts in it.
    await photoRoute(s.page).click({ force: true });
    const choose = s.page
      .getByRole('button', {
        name: label('binDesigner.cutouts.traceView.drop.choose'),
        exact: true,
      })
      .first();
    await s.until(choose);
    const window = { x: 0, y: 0, ...TRACE_CLIP_VIEW };
    const at = await s.box(choose);
    await s.ui.park(at.x + at.width / 2 + 90, at.y + at.height / 2 + 120);
    const chooser = s.page.waitForEvent('filechooser');
    await s.take(window, async () => {
      await s.ui.hold(0.8);
      await s.ui.click(choose);
      await s.ui.hold(0.2);
    });
    await (await chooser).setFiles(photo);
    await traced(s);
    await s.ui.hideCursor();
    await s.take(window, async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const photoTraceIslands: Shot = {
  id: 'cutouts-photo-trace-islands',
  kind: 'clip',
  viewport: TRACE_CLIP_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openTraceView(s);
    const keep = s.page
      .getByRole('switch', { name: label('scan.review.keepHoles'), exact: true })
      .first();
    await s.ui.preReveal(keep);
    const sw = await s.box(keep);
    const panel = { x: sw.x + sw.width + 16 - 360, width: 360 };
    const closeUp = { x: panel.x, y: sw.y - 100, width: panel.width, height: 270 };
    await s.ui.park(closeUp.x + closeUp.width * 0.4, closeUp.y + closeUp.height * 0.2);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(keep);
        await s.ui.hold(0.6);
      },
      640 / closeUp.width
    );
    await traced(s);
    await s.ui.hideCursor();
    // The wrench's closed ring, where drawToolPhoto puts it: 31% across, 65% down.
    const photo = await tracePhotoBox(s);
    const ring = {
      x: photo.x + photo.width * 0.31 - 160,
      y: photo.y + photo.height * 0.65 - 120,
      width: 320,
      height: 240,
    };
    await s.take(ring, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const photoTraceCleanup: Shot = {
  id: 'cutouts-photo-trace-cleanup',
  kind: 'clip',
  viewport: TRACE_CLIP_VIEW,
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openTraceView(s);
    const simplify = s.page
      .getByRole('slider', { name: label('binDesigner.cutouts.outline.simplify'), exact: true })
      .first();
    const curves = s.page
      .getByRole('switch', { name: label('binDesigner.cutouts.outline.curves'), exact: true })
      .first();
    await s.ui.preReveal(curves);
    const sw = await s.box(curves);
    const track = await s.box(simplify);
    const photo = await tracePhotoBox(s);
    // The screwdriver and the pliers beside the panel: each outline changes as the controls move.
    const left = photo.x + photo.width * 0.36;
    const right = sw.x + sw.width + 12;
    const frame = frameAround(
      { x: left, y: track.y - 40, width: right - left, height: 1 },
      0,
      4 / 3,
      { x: 0, y: 0, ...TRACE_CLIP_VIEW }
    );
    const y = track.y + track.height / 2;
    await s.ui.park(track.x + track.width * 0.4, y + 60);
    await s.take(
      frame,
      async () => {
        await s.ui.hold(0.5);
        await s.ui.drag([track.x + 2, y], [track.x + track.width * 0.35, y], 18);
        await s.ui.hold(0.8);
        await s.ui.click(curves);
        await s.ui.moveTo(sw.x - 40, sw.y + 60);
        s.poster();
        await s.ui.hold(2);
      },
      640 / frame.width
    );
  },
};

/** A traced tool outline, as a phone sends it: the feature-tips fixture. */
const SCAN_OUTLINE = readFileSync(
  resolve(process.cwd(), 'scripts/feature-tips/fixtures/scan-outline.svg'),
  'utf8'
);

/**
 * The scan handoff needs Redis, so its two endpoints are answered here: the
 * session starts at once, and the poll stays pending until `deliver`.
 */
async function relayScan(page: Page): Promise<{ deliver(): void }> {
  let ready = false;
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
      body: JSON.stringify(
        ready
          ? { status: 'ready', svg: SCAN_OUTLINE, createdAt: '2026-11-01T12:00:00.000Z' }
          : { status: 'pending' }
      ),
    })
  );
  return {
    deliver() {
      ready = true;
    },
  };
}

const phoneRoute = (page: Page): Locator =>
  page
    .getByRole('button', {
      name: new RegExp(`^${label('binDesigner.cutouts.scanImport.routePhone')}`),
    })
    .first();

const waitingForPhoto = (page: Page): Locator =>
  page.getByText(label('binDesigner.cutouts.scanImport.waiting')).first();

const phoneScanStart: Shot = {
  id: 'cutouts-phone-scan-start',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await relayScan(s.page);
    await openCutEditor(s, 'Pry bar tray', { width: 2, depth: 4, height: 4 }, []);
    const scan = scanButton(s.page);
    // Off camera, once, to frame the shot on the dialog at its tallest, with the code.
    await s.ui.preClick(scan);
    await s.ui.preClick(phoneRoute(s.page));
    await s.until(waitingForPhoto(s.page));
    const tall = await s.box(s.page.getByRole('dialog').first());
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    const frame = frameAround(union(await s.box(scan), tall), 16, 4 / 3, {
      x: 0,
      y: 0,
      ...DESKTOP,
    });
    await s.ui.park(frame.x + frame.width * 0.9, frame.y + frame.height * 0.5);
    await s.take(
      frame,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(scan);
        await s.ui.hold(0.6);
        await s.ui.click(phoneRoute(s.page));
        await s.until(waitingForPhoto(s.page));
        await s.ui.moveTo(frame.x + frame.width * 0.92, frame.y + frame.height * 0.5);
        s.poster();
        await s.ui.hold(2);
      },
      640 / frame.width
    );
  },
};

const phoneScanArrives: Shot = {
  id: 'cutouts-phone-scan-arrives',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    const relay = await relayScan(s.page);
    await openCutEditor(s, 'Pry bar tray', { width: 2, depth: 4, height: 4 }, []);
    await s.ui.preClick(scanButton(s.page));
    await s.ui.preClick(phoneRoute(s.page));
    await s.until(waitingForPhoto(s.page));
    const dialog = s.page.getByRole('dialog').first();
    // Room for the note the dialog grows by when the outline arrives.
    const frame = frameAround(await s.box(dialog), 40, 4 / 3, { x: 0, y: 0, ...DESKTOP });
    await s.ui.hideCursor();
    await s.take(
      frame,
      async () => {
        await s.ui.hold(1);
      },
      640 / frame.width
    );
    relay.deliver();
    // The dialog polls in real time, which the virtual clock does not advance,
    // so the wait is off camera and both themes record the same frames.
    await s.until(
      s.page.getByText(label('binDesigner.cutouts.scanImport.added_one', { count: 1 })).first()
    );
    // The dialog's own note says the same; the toast would sit cut off at the frame's edge.
    await s.dismissToasts();
    await s.take(frame, async () => {
      await s.ui.hold(1.4);
    });
    await s.ui.preClick(
      dialog.getByRole('button', {
        name: label('binDesigner.cutouts.scanImport.done'),
        exact: true,
      })
    );
    await s.ui.waitBuilt();
    await s.dismissToasts();
    await s.page.mouse.move(5, DESKTOP.height - 5);
    await s.ui.warm(20);
    const prompt = pad(
      union(
        await s.box(s.page.getByText(label('binDesigner.cutouts.depthPrompt.titleSingle')).first()),
        await s.box(
          s.page
            .getByRole('button', {
              name: label('binDesigner.cutouts.depthPrompt.apply'),
              exact: true,
            })
            .first()
        )
      ),
      18,
      DESKTOP
    );
    const area = await boardArea(s);
    // The prompt, and below it the top of the new cutout: the whole board is too tall for one frame.
    const board = { x: area.x, y: prompt.y - 12, width: area.width, height: (area.width * 3) / 4 };
    await s.take(board, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const printChecksFitTest: Shot = {
  id: 'cutouts-print-checks-fit-test',
  kind: 'clip',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Socket tray', { width: 3, depth: 1, height: 3 }, [
      { id: 's10', shape: 'circle', x: 8, y: 11, width: 16, depth: 16 },
      { id: 's13', shape: 'circle', x: 32, y: 10, width: 19, depth: 19 },
      { id: 's17', shape: 'circle', x: 60, y: 8, width: 23, depth: 23 },
      { id: 'bar', shape: 'slot', x: 90, y: 13, width: 26, depth: 12 },
    ]);
    const dock = await dockBox(s);
    const button = s.page
      .getByRole('button', { name: label('binDesigner.cutouts.fitTest.button'), exact: true })
      .first();
    await dockReveal(s, button);
    const b = await s.box(button);
    const closeUp = { x: dock.x, y: b.y - 150, width: dock.width, height: (dock.width * 3) / 4 };
    await s.ui.park(closeUp.x + closeUp.width * 0.8, closeUp.y + closeUp.height * 0.9);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.moveTo(b.x + b.width / 2, b.y + b.height / 2);
        await s.ui.hold(0.3);
      },
      640 / closeUp.width
    );
    // Off camera: the dialog covers the panel, and the next take starts in it.
    await button.click({ force: true });
    const outline = s.page
      .getByRole('radio', { name: label('binDesigner.cutouts.fitTest.modeOutline'), exact: true })
      .first();
    await s.until(outline);
    const title = await s.box(
      s.page.getByText(label('binDesigner.cutouts.fitTest.dialogTitle'), { exact: true }).first()
    );
    const mode = await s.box(outline);
    // From the dialog's subtitle down past the size fields the mode opens.
    const frame = frameAround(
      { x: title.x - 8, y: title.y - 8, width: 440, height: mode.y + 200 - title.y },
      12,
      4 / 3,
      { x: 0, y: 0, ...DESKTOP }
    );
    // Right of the format buttons, where nothing lights up on hover.
    await s.ui.park(title.x + 360, title.y + 120);
    await s.take(
      frame,
      async () => {
        await s.ui.hold(0.6);
        await s.ui.click(outline);
        await s.ui.moveTo(title.x + 360, title.y + 120);
        s.poster();
        await s.ui.hold(2);
      },
      640 / frame.width
    );
  },
};

const workshopShadowBoard: Shot = {
  id: 'cutouts-workshop-shadow-board',
  kind: 'still',
  storage: CUT_EDITOR_STORAGE,
  async take(s) {
    await openCutEditor(s, 'Caliper drawer', { width: 4, depth: 2, height: 3 }, [
      { id: 'caliper', shape: 'rectangle', x: 8, y: 40, width: 150, depth: 30 },
      { id: 'square', shape: 'rectangle', x: 8, y: 10, width: 70, depth: 22 },
      { id: 'scribe', shape: 'slot', x: 90, y: 14, width: 66, depth: 12 },
    ]);
    const button = s.page
      .getByRole('button', { name: label('binDesigner.shadowBoard.button'), exact: true })
      .first();
    await dockReveal(s, button);
    await button.click({ force: true });
    const download = s.page
      .getByRole('button', { name: label('binDesigner.shadowBoard.download.svg'), exact: true })
      .first();
    await s.until(download);
    await s.page.mouse.move(5, DESKTOP.height - 5);
    await s.ui.warm(10);
    const dock = await dockBox(s);
    const top = await s.box(button);
    const bottom = await s.box(download);
    await s.still(
      {
        x: dock.x,
        y: top.y - 4,
        width: dock.width,
        height: Math.max(top.y + top.height, bottom.y + bottom.height) + 14 - (top.y - 4),
      },
      1.5
    );
  },
};

/** Off camera: renames the open design through the name in the app header, which saves it. */
async function renameDesign(s: DocsSession, name: string): Promise<void> {
  const current = await s.page.evaluate(async () => {
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as { useDesignerStore: { getState(): { designName: string } } };
    return useDesignerStore.getState().designName;
  });
  await s.page.getByRole('button', { name: current, exact: true }).first().click({ force: true });
  await s.ui.warm(10);
  // The click opens the name for editing, with the cursor in it.
  await s.page.keyboard.press('ControlOrMeta+a');
  await s.page.keyboard.type(name);
  await s.page.keyboard.press('Enter');
  await s.page.waitForTimeout(1500);
  await s.ui.warm(20);
}

/** Wide enough that the header names its Designs button in words. */
const NEW_DESIGN_VIEW = { width: 1600, height: 960 };
/** Narrow enough that the panel and the whole 3D view below the header are one 4:3 frame. */
const BUILD_VIEW = { width: 1200, height: 948 };

const workshopStart: Shot = {
  id: 'cutouts-workshop-start',
  kind: 'clip',
  viewport: NEW_DESIGN_VIEW,
  async take(s) {
    await s.open('/designer', designerReady);
    // Both designs show in the list, so each gets a real name the way a maker gives it.
    await renameDesign(s, 'Screw bin');
    await setDesign(s, 'Pliers tray', { width: 2, depth: 2, height: 4 });
    await renameDesign(s, 'Pliers tray');
    const designs = s.page
      .getByRole('button', { name: label('binDesigner.openDesignList'), exact: true })
      .first();
    const workshop = s.page
      .getByRole('button', { name: label('binDesigner.newWorkshop'), exact: true })
      .first();
    // Off camera, once, to frame the close-up on the dialog's header row.
    await s.ui.preClick(designs);
    await s.until(workshop);
    const list = s.page.getByRole('dialog', { name: label('binDesigner.savedDesigns') });
    const row = union(
      await s.box(workshop),
      await s.box(list.getByRole('heading', { name: label('binDesigner.savedDesigns') }).first()),
      await s.box(
        list.getByRole('button', { name: label('binDesigner.newDesign'), exact: true }).first()
      )
    );
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    const view = { x: 0, y: 0, ...NEW_DESIGN_VIEW };
    const closeUp = frameAround(union(await s.box(designs), row), 16, 4 / 3, view);
    await s.ui.park(closeUp.x + closeUp.width * 0.3, closeUp.y + closeUp.height * 0.4);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(designs);
        await s.ui.hold(0.6);
        await s.ui.click(workshop);
        await s.ui.hold(0.2);
      },
      640 / closeUp.width
    );
    const confirm = s.page.getByRole('dialog', { name: label('binDesigner.newDesign') });
    const go = confirm.getByRole('button', { name: label('binDesigner.newDesign'), exact: true });
    await s.until(go);
    const ask = frameAround(await s.box(confirm), 40, 4 / 3, view);
    await s.take(ask, async () => {
      await s.ui.hold(0.6);
      const at = await s.box(go);
      await s.ui.moveTo(at.x + at.width / 2, at.y + at.height / 2);
      await s.ui.hold(0.3);
    });
    // Off camera: the build replaces the dialog at once, and the next take shows it.
    await go.click({ force: true });
    await s.until(
      s.page
        .getByRole('button', { name: label('workshop.template.screwdriverStation'), exact: true })
        .first(),
      60000
    );
    await s.ui.waitBuilt();
    // The 3D view centres the base in its own width, so the window narrows to frame it whole.
    await s.page.setViewportSize(BUILD_VIEW);
    await s.page.waitForTimeout(1000);
    await s.ui.warm(90);
    await s.dismissToasts();
    await s.ui.hideCursor();
    await s.take(
      { x: 0, y: 48, width: BUILD_VIEW.width, height: BUILD_VIEW.height - 48 },
      async () => {
        s.poster();
        await s.ui.hold(2);
      }
    );
  },
};

const workshopPlace: Shot = {
  id: 'cutouts-workshop-place',
  kind: 'clip',
  viewport: NEW_DESIGN_VIEW,
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
            setDesignName(name: string): void;
          };
        };
      };
      const st = useDesignerStore.getState();
      st.newDesign('assembly');
      st.updateEnvelope({ width: 2, depth: 2 });
      st.setDesignName('Screwdriver stand');
    });
    await s.ui.waitBuilt();
    await s.page.waitForTimeout(1500);
    await s.ui.warm(150);
    await s.dismissToasts();
    const post = s.page
      .getByRole('button', { name: new RegExp(`^${label('workshop.part.post')}`) })
      .first();
    await s.ui.preReveal(post);
    const at = await s.box(post);
    const panel = await s.box(s.page.locator('aside').first());
    const closeUp = { x: panel.x, y: at.y - 96, width: panel.width, height: (panel.width * 3) / 4 };
    await s.ui.park(closeUp.x + closeUp.width * 0.85, closeUp.y + closeUp.height * 0.1);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(post);
        await s.ui.hold(0.4);
      },
      640 / closeUp.width
    );
    // The build view centres the base, so the frame and the click go by the canvas.
    const canvas = await s.box(s.page.locator('canvas').first());
    const view = frameAround(
      {
        x: canvas.x + canvas.width * 0.2,
        y: canvas.y + canvas.height * 0.2,
        width: canvas.width * 0.6,
        height: canvas.height * 0.6,
      },
      0,
      4 / 3,
      canvas
    );
    await s.ui.park(view.x + view.width * 0.85, view.y + view.height * 0.2);
    await s.take(view, async () => {
      await s.ui.hold(0.3);
      await s.ui.clickAt(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
      // Off the base, where the next post's preview does not follow the cursor.
      await s.ui.moveTo(view.x + view.width * 0.85, view.y + view.height * 0.12);
      s.poster();
      await s.ui.hold(2);
    });
  },
};

export const CUTOUTS: readonly Shot[] = [
  basicsEditor,
  basicsOpen,
  basicsDraw,
  basicsWallOpening,
  basicsLabel,
  basicsSplit,
  arrangingAlign,
  arrangingRepeat,
  arrangingRepeatLabels,
  arrangingGroup,
  arrangingAutoArrange,
  arrangingOffBoard,
  arrangingRuler,
  importSvg,
  importStlDialog,
  importStlResult,
  importExportSvg,
  photoTraceOpen,
  photoTraceView,
  photoTraceIslands,
  photoTraceCleanup,
  phoneScanSheet,
  phoneScanStart,
  phoneScanArrives,
  printChecksList,
  printChecksFitTest,
  printChecksFinger,
  workshopStart,
  workshopPlace,
  workshopBuild,
  workshopShadowBoard,
];
