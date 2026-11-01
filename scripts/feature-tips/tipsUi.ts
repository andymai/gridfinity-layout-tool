import type { Locator, Page } from '@playwright/test';
import type { DesignerStoreModule, SettingsStoreModule } from './appModules';
import { FPS } from './encode';
import { CLIP_CAMERA } from './stage';
import type { ParamOverrides, Theme, ThemeFrames } from './stage';
import { easeInOut } from './tips3d';
import type { Tip } from './tips3d';
import { openUi } from './ui';
import type { Rect, UiSession } from './ui';

// Short enough that the board sits near the top of the tool rail, so the
// circle tool and the board's bottom-left corner share one close-up.
const VIEWPORT = { width: 1280, height: 500 };
/** The editor half of the split, below the app and editor headers. */
const EDITOR: Rect = { x: 0, y: 88, width: 640, height: 412 };
/**
 * The tool rail and the board's canvas, up to the inspector dock: a square
 * board in a 4:3 frame needs the rail's width too, or its top row is cut off.
 */
const BOARD_AREA: Rect = { x: 0, y: 88, width: 352, height: 412 };
/** The inspector dock at the editor's right edge, open at its default width. */
const DOCK: Rect = { x: 352, y: 88, width: 288, height: 412 };
const STORAGE = {
  'gridfinity-cutout-quickstart-seen': 'true',
  'gridfinity-cutout-inspector-collapsed': '0',
  'gridfinity-cutout-split': '0.5',
};
const BIN_MM = 84;
const POCKET_MM = 14;
/** Fill bin only counts copies to the right of and above the drawn pocket. */
const POCKET_CENTER_MM: [number, number] = [12, 12];

function frameAround(box: Rect, margin: number, within: Rect): Rect {
  let width = box.width + margin * 2;
  let height = box.height + margin * 2;
  if (width / height > 4 / 3) height = (width * 3) / 4;
  else width = (height * 4) / 3;
  const fit = Math.min(1, within.width / width, within.height / height);
  width *= fit;
  height *= fit;
  const x = Math.min(
    Math.max(box.x + box.width / 2 - width / 2, within.x),
    within.x + within.width - width
  );
  const y = Math.min(
    Math.max(box.y + box.height / 2 - height / 2, within.y),
    within.y + within.height - height
  );
  return { x, y, width, height };
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

async function boardToScreen(page: Page): Promise<(mm: [number, number]) => [number, number]> {
  const m = await page.evaluate(() => {
    const rulers = [...document.querySelectorAll('svg')].filter((svg) =>
      [...svg.querySelectorAll('text')].some((t) => t.textContent === '80')
    );
    const tick = (svg: SVGSVGElement, label: string, axis: 'x' | 'y'): number => {
      const text = [...svg.querySelectorAll('text')].find((t) => t.textContent === label);
      if (!text) throw new Error(`no ${label} mm label`);
      const r = svg.getBoundingClientRect();
      // Labels sit 2 px past their tick, along the ruler.
      return axis === 'x'
        ? r.left + Number(text.getAttribute('x')) - 2
        : r.top + Number(text.getAttribute('y')) + 2;
    };
    const wide = (s: SVGSVGElement): boolean =>
      s.getBoundingClientRect().width > s.getBoundingClientRect().height;
    const across = rulers.find(wide);
    const down = rulers.find((s) => !wide(s));
    if (!across || !down) throw new Error('no rulers');
    return {
      x0: tick(across, '0', 'x'),
      x80: tick(across, '80', 'x'),
      y0: tick(down, '0', 'y'),
      y80: tick(down, '80', 'y'),
    };
  });
  return ([x, y]) => [m.x0 + ((m.x80 - m.x0) * x) / 80, m.y0 + ((m.y80 - m.y0) * y) / 80];
}

async function boxOf(target: Locator): Promise<Rect> {
  const b = await target.boundingBox({ timeout: 8000 });
  if (!b) throw new Error(`no box for ${String(target)}`);
  return b;
}

async function openCutEditor(ui: UiSession, base: string, theme: Theme): Promise<void> {
  const { page } = ui;
  await page.goto(`${base}/designer`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Increase Height' }).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  await ui.warm(20);
  await page.evaluate(async (t) => {
    const { useSettingsStore } = (await import(
      '/src/core/store/settings.ts' as string
    )) as SettingsStoreModule;
    useSettingsStore.getState().updateSetting('theme', t);
    const { useDesignerStore } = (await import(
      '/src/features/bin-designer/store/designer.ts' as string
    )) as DesignerStoreModule;
    const s = useDesignerStore.getState();
    s.newDesign('bin');
    s.setParams({ width: 2, depth: 2, height: 4 });
  }, theme);
  await ui.waitBuilt();
  await ui.preClick(page.getByRole('radio', { name: 'Custom Cutouts' }).first());
  await ui.waitBuilt();
  await ui.preClick(page.getByText('Cut Editor').first());
  const circle = page.getByRole('button', { name: 'Circle', exact: true }).first();
  for (let i = 0; i < 90 && !(await circle.isVisible()); i++) {
    await ui.warm(1);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(2000);
  await ui.warm(30);
  // Toasts left by the setup would otherwise fade out on camera.
  await page
    .getByRole('button', { name: 'Dismiss notification' })
    .evaluateAll((els) => els.forEach((el) => (el as HTMLElement).click()));
  await ui.warm(30);
}

/**
 * One take in close-ups: the board while a pocket is drawn, the Repeat
 * controls while 3 x 2 and then Fill bin are clicked, then the whole board
 * full of pockets. The dock scrolls between shots, off camera.
 */
async function cutEditorTake(
  base: string,
  theme: Theme
): Promise<{ frames: Buffer[]; params: ParamOverrides }> {
  const ui = await openUi(VIEWPORT, theme, STORAGE);
  const { page } = ui;
  try {
    await openCutEditor(ui, base, theme);
    const toScreen = await boardToScreen(page);
    const circle = page.getByRole('button', { name: 'Circle', exact: true }).first();

    const center = POCKET_CENTER_MM;
    const from = toScreen([center[0] - POCKET_MM / 2, center[1] + POCKET_MM / 2]);
    const to = toScreen([center[0] + POCKET_MM / 2, center[1] - POCKET_MM / 2]);
    const pocket: Rect = {
      x: from[0],
      y: from[1],
      width: to[0] - from[0],
      height: to[1] - from[1],
    };

    const frames: Buffer[] = [];
    await ui.park(pocket.x + pocket.width * 2, pocket.y - pocket.height);
    await ui.record(frameAround(union(await boxOf(circle), pocket), 24, EDITOR));
    await ui.hold(0.25);
    await ui.click(circle);
    await ui.drag(from, to, 10);
    await ui.hold(0.3);
    frames.push(...ui.stop());

    await ui.waitBuilt();
    const preset = page.getByRole('button', { name: /^3 × 2$/ }).first();
    // Only the dock's own scroller: scrollIntoView would also nudge the editor
    // pane, leaving the board's measured position stale.
    await preset.evaluate((el) => {
      let n = el.parentElement;
      while (
        n &&
        !(
          n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)
        )
      )
        n = n.parentElement;
      if (!n) return;
      const r = el.getBoundingClientRect();
      const box = n.getBoundingClientRect();
      n.scrollTop += r.top + r.height / 2 - (box.top + box.height / 2);
    });
    await ui.warm(10);
    const button = await boxOf(preset);
    await ui.park(button.x - 40, button.y + button.height + 30);
    // Clicking 3 x 2 swaps the presets for the grid controls, with Fill bin
    // about 140 px further down, so the shot spans the dock from the presets down.
    await ui.record(
      frameAround({ x: DOCK.x, y: button.y - 30, width: DOCK.width, height: 200 }, 0, DOCK)
    );
    await ui.hold(0.15);
    await ui.click(preset);
    await ui.hold(0.2);
    await ui.click(page.getByRole('button', { name: 'Fill bin' }).first());
    await ui.hold(0.3);
    frames.push(...ui.stop());

    await ui.hideCursor();
    await ui.waitBuilt();
    const settled = await boardToScreen(page);
    const [sx0, sy0] = settled([0, BIN_MM]);
    const [sx1, sy1] = settled([BIN_MM, 0]);
    await ui.record(
      frameAround({ x: sx0, y: sy0, width: sx1 - sx0, height: sy1 - sy0 }, 12, BOARD_AREA)
    );
    await ui.hold(1);
    frames.push(...ui.stop());
    return { frames, params: (await ui.designerParams()) as ParamOverrides };
  } finally {
    await ui.close();
  }
}

/**
 * Two takes of the editor, one per theme, then a crossfade to the finished
 * bin on the 3D stage, and a crossfade back to the first frame so it loops.
 */
const cutEditor: Tip = {
  id: 'cutEditor',
  color: '#38bdf8',
  async capture({ stage, base }) {
    stage.setTint(this.color);
    const dark = await cutEditorTake(base, 'dark');
    const light = await cutEditorTake(base, 'light');
    if (dark.frames.length !== light.frames.length) {
      throw new Error(`takes differ: ${dark.frames.length} vs ${light.frames.length} frames`);
    }
    const editor: ThemeFrames[] = dark.frames.map((d, i) => ({
      dark: d,
      light: light.frames[i] ?? d,
    }));
    const first = editor[0];
    const last = editor[editor.length - 1];
    if (!first || !last) throw new Error('empty take');

    await stage.setParams(dark.params);
    const result = await stage.render(await stage.fit(CLIP_CAMERA, await stage.bounds()));
    const fade = Math.round(0.3 * FPS);
    const holdFrames = Math.round(1.3 * FPS);
    const out = [...editor];
    for (let i = 1; i <= fade; i++) out.push(await stage.blend(last, result, easeInOut(i / fade)));
    const poster = out.length + Math.floor(holdFrames / 2);
    for (let i = 0; i < holdFrames; i++) out.push(result);
    // Stops one step short: the loop's next frame is `first` itself.
    for (let i = 1; i < fade; i++) out.push(await stage.blend(result, first, easeInOut(i / fade)));
    return { frames: out, poster };
  },
};

export const TIPS_UI: readonly Tip[] = [cutEditor];
