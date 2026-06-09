/* eslint-disable no-console -- build script logs status to stdout */
/**
 * Generates the committed SEO/marketing images: in-page landing screenshots
 * (public/images/landing/) and per-page Open Graph cards (public/og/).
 *
 * App screenshots need the real app (WebGL + WASM kernels), so this drives a
 * dev server with Playwright — same workflow as gen-example-thumbnails:
 * run `pnpm run dev` separately, then `pnpm run gen:seo-images`.
 * Set BASE_URL if the dev server is not on the default port.
 *
 * Layout-planner shots are seeded through localStorage (library index +
 * layout payload) so the grid shows a realistic, labeled, color-coded drawer
 * instead of an empty grid. Designer renders go through the dev-only
 * `?devThumbnails=1` route, which accepts either a gallery `example` id or
 * arbitrary partial params as base64 JSON (`params=`).
 */

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const LANDING_OUT = resolve(process.cwd(), 'public/images/landing');
const OG_OUT = resolve(process.cwd(), 'public/og');

const SHOT_VIEWPORT = { width: 1200, height: 675 };
const OG_VIEWPORT = { width: 1200, height: 630 };

// ---------------------------------------------------------------------------
// Seeded layouts
// ---------------------------------------------------------------------------

interface SeedBin {
  x: number;
  y: number;
  width: number;
  depth: number;
  label: string;
  category: string;
}

interface SeedLayout {
  name: string;
  drawer: { width: number; depth: number; height: number };
  categories: Array<{ id: string; name: string; color: string }>;
  bins: SeedBin[];
}

const TOOL_DRAWER: SeedLayout = {
  name: 'Tool Drawer',
  drawer: { width: 11, depth: 9, height: 10 },
  categories: [
    { id: 'cat-drivers', name: 'Drivers & Bits', color: '#38bdf8' },
    { id: 'cat-cutting', name: 'Cutting', color: '#f87171' },
    { id: 'cat-measuring', name: 'Measuring', color: '#4ade80' },
    { id: 'cat-grip', name: 'Grip & Torque', color: '#fbbf24' },
    { id: 'cat-misc', name: 'Misc', color: '#e2e8f0' },
  ],
  bins: [
    { x: 0, y: 8, width: 6, depth: 1, label: 'Wrenches', category: 'cat-grip' },
    { x: 6, y: 8, width: 5, depth: 1, label: 'Files', category: 'cat-cutting' },
    { x: 0, y: 6, width: 4, depth: 2, label: 'Screwdrivers', category: 'cat-drivers' },
    { x: 4, y: 6, width: 4, depth: 2, label: 'Pliers', category: 'cat-grip' },
    { x: 8, y: 6, width: 3, depth: 2, label: 'Hex Bits', category: 'cat-drivers' },
    { x: 0, y: 4, width: 2, depth: 2, label: 'Tape', category: 'cat-misc' },
    { x: 2, y: 4, width: 3, depth: 2, label: 'Calipers', category: 'cat-measuring' },
    { x: 5, y: 4, width: 3, depth: 2, label: 'Sockets', category: 'cat-grip' },
    { x: 8, y: 4, width: 3, depth: 2, label: 'Hex Keys', category: 'cat-drivers' },
    { x: 0, y: 2, width: 4, depth: 2, label: 'Drill Bits', category: 'cat-drivers' },
    { x: 4, y: 2, width: 3, depth: 2, label: 'Cutters', category: 'cat-cutting' },
    { x: 7, y: 2, width: 4, depth: 2, label: 'Squares', category: 'cat-measuring' },
    { x: 0, y: 0, width: 3, depth: 2, label: 'Markers', category: 'cat-misc' },
    { x: 3, y: 0, width: 3, depth: 2, label: 'Utility Knives', category: 'cat-cutting' },
    { x: 6, y: 0, width: 5, depth: 2, label: 'Misc', category: 'cat-misc' },
  ],
};

const KITCHEN_DRAWER: SeedLayout = {
  name: 'Kitchen Drawer',
  drawer: { width: 10, depth: 6, height: 6 },
  categories: [
    { id: 'cat-serving', name: 'Serving', color: '#fbbf24' },
    { id: 'cat-cutlery', name: 'Cutlery', color: '#4ade80' },
    { id: 'cat-junk', name: 'Junk Drawer', color: '#f87171' },
    { id: 'cat-utensils', name: 'Utensils', color: '#38bdf8' },
  ],
  bins: [
    { x: 0, y: 4, width: 5, depth: 2, label: 'Serving Spoons', category: 'cat-serving' },
    { x: 5, y: 4, width: 5, depth: 2, label: 'Spatulas', category: 'cat-utensils' },
    { x: 0, y: 2, width: 2, depth: 2, label: 'Forks', category: 'cat-cutlery' },
    { x: 2, y: 2, width: 2, depth: 2, label: 'Knives', category: 'cat-cutlery' },
    { x: 4, y: 2, width: 2, depth: 2, label: 'Spoons', category: 'cat-cutlery' },
    { x: 6, y: 2, width: 2, depth: 2, label: 'Teaspoons', category: 'cat-cutlery' },
    { x: 8, y: 2, width: 2, depth: 2, label: 'Chopsticks', category: 'cat-utensils' },
    { x: 0, y: 0, width: 2, depth: 2, label: 'Clips', category: 'cat-junk' },
    { x: 2, y: 0, width: 2, depth: 2, label: 'Batteries', category: 'cat-junk' },
    { x: 4, y: 0, width: 2, depth: 2, label: 'Ties', category: 'cat-junk' },
    { x: 6, y: 0, width: 4, depth: 2, label: 'Openers', category: 'cat-junk' },
  ],
};

function buildLayoutPayload(seed: SeedLayout): object {
  return {
    version: '1.0',
    name: seed.name,
    drawer: seed.drawer,
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: seed.categories,
    layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
    bins: seed.bins.map((b, i) => ({
      id: `bin-${i + 1}`,
      layerId: 'layer-1',
      x: b.x,
      y: b.y,
      width: b.width,
      depth: b.depth,
      height: 3,
      category: b.category,
      label: b.label,
      notes: '',
    })),
  };
}

/**
 * Seed localStorage before the app boots: library index + layout payload +
 * settings + onboarding flags. IndexedDB is empty in a fresh context, so the
 * app falls back to these localStorage copies on init.
 */
async function seedPlannerPage(
  page: Page,
  seed: SeedLayout,
  theme: 'dark' | 'light'
): Promise<void> {
  const layoutId = 'seo-screenshot-layout';
  await page.addInitScript(
    ({ id, layout, themeName }) => {
      try {
        const now = Date.now();
        window.localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            version: '1.0',
            activeLayoutId: id,
            settings: {},
            entries: [
              { id, name: (layout as { name: string }).name, createdAt: now, modifiedAt: now },
            ],
          })
        );
        window.localStorage.setItem(`gridfinity-layout-${id}`, JSON.stringify(layout));
        window.localStorage.setItem('gridfinity-settings-v1', JSON.stringify({ theme: themeName }));
        window.localStorage.setItem('gridfinity-onboarding-welcome-seen', 'true');
        window.localStorage.setItem('gridfinity-onboarding-draw-tutorial-seen', 'true');
        window.localStorage.setItem('gridfinity-onboarding-sidebar-pulse-dismissed', 'true');
        window.localStorage.setItem('gridfinity-onboarding-chose-blank', 'true');
      } catch (e) {
        console.error('[gen-seo-images] localStorage seed failed', e);
      }
    },
    { id: layoutId, layout: buildLayoutPayload(seed), themeName: theme }
  );
}

async function capturePlanner(browser: Browser, seed: SeedLayout, outFile: string): Promise<void> {
  const page = await browser.newPage({ viewport: SHOT_VIEWPORT, deviceScaleFactor: 2 });
  try {
    await seedPlannerPage(page, seed, 'dark');
    await page.goto(BASE);
    await page.waitForSelector('[role="application"]', { timeout: 30000 });
    await page.waitForFunction(
      (count) => document.querySelectorAll('[data-bin-id]').length >= count,
      seed.bins.length,
      { timeout: 30000 }
    );
    // Let fonts, thumbnails, and layout transitions settle.
    await page.waitForTimeout(1500);
    writeFileSync(outFile, await page.screenshot({ type: 'png' }));
    console.log(`wrote ${outFile}`);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Designer renders (dev thumbnail route)
// ---------------------------------------------------------------------------

// Insert x/y are center-origin millimeters (binGenerator translates from the
// bin center), so the hex grid is laid out symmetrically around (0, 0).
const BIT_ORGANIZER_PARAMS = {
  width: 3,
  depth: 2,
  height: 3,
  inserts: Array.from({ length: 18 }, (_, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    return {
      id: `seo-hex-${i}`,
      templateId: null,
      shape: 'hexagon',
      x: -40 + col * 16,
      y: -19 + row * 19,
      width: 9,
      depth: 9,
      cutDepth: 10,
      rotation: 0,
      cornerRadius: 0,
      label: '',
    };
  }),
};

interface RenderSpec {
  outFile: string;
  query: string;
  theme: 'dark' | 'light';
  zoomSteps: number;
}

async function captureDesignerRender(browser: Browser, spec: RenderSpec): Promise<void> {
  const page = await browser.newPage({ viewport: SHOT_VIEWPORT, deviceScaleFactor: 2 });
  try {
    await page.addInitScript((themeName) => {
      try {
        window.localStorage.setItem('gridfinity-settings-v1', JSON.stringify({ theme: themeName }));
      } catch (e) {
        console.error('[gen-seo-images] settings seed failed', e);
      }
    }, spec.theme);
    await page.goto(`${BASE}/?devThumbnails=1&${spec.query}`);
    await page.waitForFunction(
      () => (window as unknown as { __thumbnailReady?: boolean }).__thumbnailReady === true,
      null,
      { timeout: 120000 }
    );
    // Zoom in so the bin fills the frame — the iso preset leaves wide margins.
    await page.mouse.move(SHOT_VIEWPORT.width / 2, SHOT_VIEWPORT.height / 2);
    for (let i = 0; i < spec.zoomSteps; i++) {
      await page.mouse.wheel(0, -240);
      await page.waitForTimeout(120);
    }
    // Let orbit-control damping settle before sampling.
    await page.waitForTimeout(900);
    const canvas = page.locator('#dev-thumbnail-route canvas');
    writeFileSync(spec.outFile, await canvas.screenshot({ type: 'png' }));
    console.log(`wrote ${spec.outFile}`);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Baseplate maker screenshot
// ---------------------------------------------------------------------------

async function captureBaseplate(browser: Browser, outFile: string): Promise<void> {
  const page = await browser.newPage({ viewport: SHOT_VIEWPORT, deviceScaleFactor: 2 });
  try {
    await seedPlannerPage(page, TOOL_DRAWER, 'dark');
    await page.goto(`${BASE}/baseplate`);
    await page.waitForSelector('canvas', { timeout: 60000 });
    // A 3D assembled iso view with magnet holes reads better than the
    // default top-down exploded view.
    const magnetSwitch = page.getByRole('switch', { name: /magnet/i });
    if ((await magnetSwitch.count()) > 0) await magnetSwitch.click();
    await page.getByRole('button', { name: 'Assembled' }).click();
    await page.getByRole('button', { name: /Iso/ }).click();
    // Baseplate preview generates via the worker; give it time to draw.
    await page.waitForTimeout(15000);
    writeFileSync(outFile, await page.screenshot({ type: 'png' }));
    console.log(`wrote ${outFile}`);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// OG cards
// ---------------------------------------------------------------------------

interface OgCard {
  slug: string;
  title: string;
  subtitle: string;
  style: 'dark' | 'light';
  /** Landing screenshot used as the inset, relative to LANDING_OUT */
  inset: string;
  /** CSS background-position for the inset; UI shots read best anchored left,
   * centered renders need `center`. */
  insetPosition?: string;
}

const OG_CARDS: OgCard[] = [
  {
    slug: 'home',
    title: 'Plan & Print Gridfinity Drawer Organizers',
    subtitle: 'Drag-and-drop planner · custom bin generator · STL, STEP & 3MF export',
    style: 'dark',
    inset: 'tool-drawer-layout.png',
  },
  {
    slug: 'designer',
    title: 'Gridfinity Bin Designer',
    subtitle: 'Custom bins with compartments, cutouts & label tabs — free, in your browser',
    style: 'dark',
    inset: 'multicolor-organizer-bin.png',
    insetPosition: 'center',
  },
  {
    slug: 'baseplate',
    title: 'Gridfinity Baseplate Maker',
    subtitle: 'Any drawer size · magnet holes · automatic print-bed splitting',
    style: 'dark',
    inset: 'baseplate-preview.png',
  },
  {
    slug: 'gridfinity-generator',
    title: 'Gridfinity Generator',
    subtitle: 'Bins and baseplates, generated in your browser — STL, STEP & 3MF',
    style: 'dark',
    inset: 'multicolor-organizer-bin.png',
    insetPosition: 'center',
  },
  {
    slug: 'gridfinity-bin-generator',
    title: 'Gridfinity Bin Generator',
    subtitle: 'Parametric bins with a real-time 3D preview — free, no account',
    style: 'dark',
    inset: 'honeycomb-caddy-bin.png',
    insetPosition: 'center',
  },
  {
    slug: 'gridfinity-baseplate-generator',
    title: 'Gridfinity Baseplate Generator',
    subtitle: 'Magnet holes, edge padding & print-bed splitting',
    style: 'dark',
    inset: 'baseplate-preview.png',
  },
  {
    slug: 'guide',
    title: 'Gridfinity Drawer Planning Guide',
    subtitle: 'Measure, plan, and print a drawer organizer that fits the first time',
    style: 'light',
    inset: 'tool-drawer-layout.png',
  },
  {
    slug: 'what-is-gridfinity',
    title: 'What is Gridfinity?',
    subtitle: 'The 42mm modular storage system for 3D printing, explained',
    style: 'light',
    inset: 'multicolor-organizer-bin.png',
    insetPosition: 'center',
  },
  {
    slug: 'gridfinity-sizes',
    title: 'Gridfinity Sizes Reference',
    subtitle: 'Bin and baseplate dimensions on the 42mm grid',
    style: 'light',
    inset: 'honeycomb-caddy-bin.png',
    insetPosition: 'center',
  },
  {
    slug: 'gridfinity-tool-drawer',
    title: 'Gridfinity Tool Drawer Organizer',
    subtitle: 'Plan the layout, print fitted bins for every tool',
    style: 'light',
    inset: 'tool-drawer-layout.png',
  },
  {
    slug: 'gridfinity-kitchen-drawer',
    title: 'Gridfinity Kitchen Drawer Organizer',
    subtitle: 'Utensils, cutlery, and the junk drawer — organized for good',
    style: 'light',
    inset: 'kitchen-drawer-layout.png',
  },
  {
    slug: 'gridfinity-calculator',
    title: 'Gridfinity Calculator',
    subtitle: 'Drawer millimeters → grid units, leftover space & max bin height',
    style: 'light',
    inset: 'tool-drawer-layout.png',
  },
  {
    slug: 'gridfinity-software',
    title: 'Gridfinity Software Compared',
    subtitle: 'Online generators vs OpenSCAD vs CAD plugins — what to use when',
    style: 'light',
    inset: 'bit-organizer-bin.png',
    insetPosition: 'center',
  },
];

function ogCardHtml(card: OgCard, insetDataUrl: string): string {
  const dark = card.style === 'dark';
  const bg = dark ? '#0f0f12' : '#f5f4f1';
  const fg = dark ? '#fafafa' : '#1a1a1f';
  const muted = dark ? '#a1a1aa' : '#52525b';
  const border = dark ? '#2a2a35' : '#d4d4d8';
  const surface = dark ? '#1a1a1f' : '#ffffff';
  return `<!doctype html>
<html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: ${bg}; color: ${fg};
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    display: flex; align-items: center; gap: 48px;
    padding: 56px 0 56px 64px;
  }
  .text { width: 460px; flex-shrink: 0; display: flex; flex-direction: column; height: 100%; }
  .logo { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 20px; }
  .logo svg { width: 32px; height: 32px; color: #3b82f6; }
  h1 { font-size: 46px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; margin-top: 40px; }
  .subtitle { font-size: 22px; line-height: 1.45; color: ${muted}; margin-top: 20px; }
  .domain { margin-top: auto; font-size: 18px; font-weight: 600; color: #f59e0b; }
  .shot {
    flex: 1; height: 100%;
    border: 1px solid ${border}; border-right: none;
    border-radius: 16px 0 0 16px;
    background: ${surface} url(${insetDataUrl}) ${card.insetPosition ?? 'left center'} / cover no-repeat;
    box-shadow: 0 24px 64px rgba(0,0,0,${dark ? '0.5' : '0.15'});
  }
</style>
</head><body>
  <div class="text">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span>Gridfinity Layout Tool</span>
    </div>
    <h1>${card.title}</h1>
    <div class="subtitle">${card.subtitle}</div>
    <div class="domain">GridfinityLayoutTool.com</div>
  </div>
  <div class="shot"></div>
</body></html>`;
}

async function renderOgCards(browser: Browser): Promise<void> {
  const page = await browser.newPage({ viewport: OG_VIEWPORT, deviceScaleFactor: 1 });
  try {
    for (const card of OG_CARDS) {
      const insetPath = resolve(LANDING_OUT, card.inset);
      const insetDataUrl = `data:image/png;base64,${readFileSync(insetPath).toString('base64')}`;
      await page.setContent(ogCardHtml(card, insetDataUrl), { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const outFile = resolve(OG_OUT, `${card.slug}.png`);
      writeFileSync(outFile, await page.screenshot({ type: 'png' }));
      console.log(`wrote ${outFile}`);
    }
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(LANDING_OUT, { recursive: true });
  mkdirSync(OG_OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const only = process.env.ONLY?.split(',').map((s) => s.trim());
    const want = (step: string): boolean => !only || only.includes(step);

    if (want('planner')) {
      await capturePlanner(browser, TOOL_DRAWER, resolve(LANDING_OUT, 'tool-drawer-layout.png'));
      await capturePlanner(
        browser,
        KITCHEN_DRAWER,
        resolve(LANDING_OUT, 'kitchen-drawer-layout.png')
      );
    }
    if (want('renders')) {
      await captureDesignerRender(browser, {
        outFile: resolve(LANDING_OUT, 'multicolor-organizer-bin.png'),
        query: 'example=hero-multicolor-organizer',
        theme: 'light',
        zoomSteps: 5,
      });
      await captureDesignerRender(browser, {
        outFile: resolve(LANDING_OUT, 'honeycomb-caddy-bin.png'),
        query: 'example=hero-honeycomb-caddy',
        theme: 'light',
        zoomSteps: 5,
      });
      await captureDesignerRender(browser, {
        outFile: resolve(LANDING_OUT, 'bit-organizer-bin.png'),
        query: `params=${encodeURIComponent(Buffer.from(JSON.stringify(BIT_ORGANIZER_PARAMS)).toString('base64'))}`,
        theme: 'light',
        zoomSteps: 5,
      });
    }
    if (want('baseplate')) {
      await captureBaseplate(browser, resolve(LANDING_OUT, 'baseplate-preview.png'));
    }
    if (want('og')) {
      await renderOgCards(browser);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
