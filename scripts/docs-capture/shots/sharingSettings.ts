import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Locator, Route, WebSocketRoute } from '@playwright/test';
import { WORKBENCH, WORKSHOP_CATEGORIES, layoutFile } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, pad } from '../session';
import type { DocsSession, Shot } from '../session';
import { openDesigner } from './apps';
import { cellCenter, grid, openLayouts } from './layoutEditor';

interface Reply {
  status?: number;
  json: unknown;
}

type Handler = (path: string, url: URL, method: string) => Reply | undefined;

/**
 * The dev server has no API. Without an answer to /api/auth/me the session
 * stays unknown and the account button never renders, so every shot here
 * answers it as signed out.
 */
async function routeApi(s: DocsSession, ...handlers: Handler[]): Promise<void> {
  const signedOut: Handler = (path) =>
    path === '/api/auth/me' ? { json: { authenticated: false, user: null } } : undefined;
  const all = [...handlers, signedOut];
  // A predicate, not a glob: `**/api/**` would also catch app modules under src/core/api/.
  await s.page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route: Route) => {
      const url = new URL(route.request().url());
      for (const handle of all) {
        const reply = handle(url.pathname, url, route.request().method());
        if (reply) return route.fulfill({ status: reply.status ?? 200, json: reply.json });
      }
      return route.continue();
    }
  );
}

async function openEditor(s: DocsSession, ...fixtures: FixtureLayout[]): Promise<void> {
  await routeApi(s);
  await openLayouts(s, ...fixtures);
}

async function openSettings(s: DocsSession, tab: Parameters<typeof label>[0]): Promise<Locator> {
  await s.page
    .locator('header')
    .getByRole('button', { name: label('sidebar.openSettings'), exact: true })
    .first()
    .click({ force: true });
  const dialog = s.page.getByRole('dialog', { name: label('settings.title') });
  await s.until(dialog);
  await s.page.getByRole('tab', { name: label(tab), exact: true }).click({ force: true });
  await s.ui.warm(20);
  await s.page.waitForTimeout(600);
  await s.ui.warm(20);
  return dialog;
}

function pageExample(page: string, heading: string): string {
  const md = readFileSync(resolve(process.cwd(), 'apps/docs', page), 'utf8');
  const after = md.slice(md.indexOf(`## ${heading}`));
  const match = /```json\n([\s\S]*?)\n```/.exec(after);
  if (!match?.[1]) throw new Error(`no json example under "${heading}" in ${page}`);
  return match[1];
}

/** Just past a dialog's border: a wider crop catches cut-off text from the page behind it. */
const DIALOG_MARGIN = 3;

/** Tall enough that the dialog shows every tab group. */
const SETTINGS_VIEWPORT = { width: 1440, height: 1000 };

const settingsDialog: Shot = {
  id: 'settings-settings-dialog',
  kind: 'still',
  viewport: SETTINGS_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    const dialog = await openSettings(s, 'settings.tabs.appearance');
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, SETTINGS_VIEWPORT));
  },
};

/** Tall enough that the Labs tab shows every card without a scroll. */
const LABS_VIEWPORT = { width: 1440, height: 1400 };

const labsTab: Shot = {
  id: 'settings-labs-tab',
  kind: 'still',
  viewport: LABS_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    await openSettings(s, 'settings.tabs.labs');
    const panel = s.page.locator('#settings-tabpanel-labs');
    await s.still(pad(await s.box(panel), 8, LABS_VIEWPORT));
  },
};

const spaceMouse: Shot = {
  id: 'settings-spacemouse-general',
  kind: 'still',
  viewport: SETTINGS_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    await openSettings(s, 'settings.tabs.general');
    const section = s.page.locator('section[data-settings-section="spacemouse"]');
    await s.ui.preClick(
      section.getByRole('switch', { name: label('settings.spacemouseEnable') }).first()
    );
    // The app finds no driver here and no paired device, so it ends idle. The
    // state a paired device sets is then written over it, with the name WebHID
    // reports for that model. Until the search ends, it would write idle back.
    const connect = (): Promise<string> =>
      s.page.evaluate(async () => {
        const { useSpaceMouseStore } = (await import(
          '/src/shared/spacemouse/settingsStore.ts' as string
        )) as {
          useSpaceMouseStore: {
            getState(): {
              status: string;
              transport: string | null;
              setConnection(status: string, name: string): void;
            };
          };
        };
        const st = useSpaceMouseStore.getState();
        if (st.transport === 'webhid' && st.status === 'idle')
          st.setConnection('connected', 'SpaceMouse Compact');
        return useSpaceMouseStore.getState().status;
      });
    for (let i = 0, stable = 0; stable < 10; i++) {
      stable = (await connect()) === 'connected' ? stable + 1 : 0;
      if (i > 150) throw new Error('the SpaceMouse search did not settle');
      await s.ui.warm(2);
      await s.page.waitForTimeout(100);
    }
    await section.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await s.ui.warm(10);
    const sec = await s.box(section);
    const panel = await s.box(s.page.locator('#settings-tabpanel-general'));
    const bottom = Math.min(sec.y + sec.height + 4, panel.y + panel.height);
    await s.still(
      { x: sec.x - 12, y: sec.y - 8, width: sec.width + 24, height: bottom - (sec.y - 8) },
      1.25
    );
  },
};

const shortcutsPanel: Shot = {
  id: 'reference-shortcuts-panel',
  kind: 'still',
  async take(s) {
    await openEditor(s, WORKBENCH);
    await s.page.keyboard.press('?');
    const dialog = s.page.getByRole('dialog', { name: label('help.title') });
    await s.until(dialog);
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, DESKTOP));
  },
};

/** Where the kit's clock starts (EPOCH in session.ts): the app's Date.now() in every take. */
const CLOCK = Date.UTC(2026, 10, 2, 16, 30);
const HOUR = 3600 * 1000;

/** Gives the Recent group something to rank. */
const PALETTE_HISTORY = Object.fromEntries(
  (
    [
      ['open-layout-manager', 9, 1],
      ['toggle-preview', 6, 0.5],
      ['fill-gaps', 5, 3],
      ['align-left', 3, 20],
      ['match-height', 2, 26],
      ['duplicate-selected', 4, 6],
      ['add-layer', 1, 70],
    ] as const
  ).map(([commandId, useCount, hoursAgo]) => [
    commandId,
    { commandId, useCount, lastUsedAt: CLOCK - hoursAgo * HOUR },
  ])
);

const palette: Shot = {
  id: 'settings-keyboard-palette',
  kind: 'still',
  storage: { 'gridfinity-command-palette-frecency-v2': JSON.stringify(PALETTE_HISTORY) },
  async take(s) {
    await openEditor(s, WORKBENCH);
    const ids = await Promise.all(
      ['M3', 'M4'].map((name) =>
        s.page.locator('[data-bin-id]', { hasText: name }).first().getAttribute('data-bin-id')
      )
    );
    await s.page.evaluate(async (binIds) => {
      const { useSelectionStore } = (await import('/src/core/store/selection.ts' as string)) as {
        useSelectionStore: { getState(): { setSelectedBins(ids: unknown[]): void } };
      };
      useSelectionStore.getState().setSelectedBins(binIds);
    }, ids);
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.page.keyboard.press('ControlOrMeta+k');
    const root = s.page.locator('[cmdk-root]').first();
    await s.until(root);
    await s.still(pad(await s.box(root), 20, DESKTOP));
  },
};

/** The import dialogs are 80% of the window high, and overlap their own parts below this. */
const IMPORT_VIEWPORT = { width: 1440, height: 1100 };

const layoutImport: Shot = {
  id: 'reference-layout-file-import',
  kind: 'still',
  viewport: IMPORT_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    await s.page.keyboard.press('ControlOrMeta+o');
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.page
      .getByRole('button', { name: label('common.import'), exact: true })
      .first()
      .click({ force: true });
    const box = s.page.getByLabel(label('layouts.layoutJson'));
    await s.until(box);
    await box.fill(pageExample('reference/layout-file.md', 'A minimal layout'));
    await s.until(s.page.getByText(label('layouts.readyToImport'), { exact: true }));
    await box.evaluate((el) => {
      el.scrollTo(0, 0);
      el.blur();
    });
    await s.ui.warm(10);
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, IMPORT_VIEWPORT));
  },
};

const designImport: Shot = {
  id: 'reference-design-file-import',
  kind: 'still',
  viewport: IMPORT_VIEWPORT,
  async take(s) {
    await routeApi(s);
    await openDesigner(s, 'Screw bin', {});
    await s.page
      .getByRole('button', { name: label('binDesigner.openDesignList') })
      .first()
      .click({ force: true });
    const dialog = s.page.getByRole('dialog').first();
    await s.until(dialog);
    await s.page
      .getByRole('button', { name: label('common.import'), exact: true })
      .first()
      .click({ force: true });
    const box = s.page.getByLabel(label('binDesigner.designJson'));
    await s.until(box);
    await box.fill(pageExample('reference/design-file.md', 'A minimal design'));
    await s.until(s.page.getByText(label('binDesigner.readyToImportDesign'), { exact: true }));
    await box.evaluate((el) => {
      el.scrollTo(0, 0);
      el.blur();
    });
    await s.ui.warm(10);
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, IMPORT_VIEWPORT));
  },
};

/** Three drawers, so the menu counts more than one layout on the device. */
const LIBRARY: FixtureLayout[] = [
  { ...WORKBENCH, name: 'Garage pegboard drawer', bins: WORKBENCH.bins?.slice(0, 6) },
  { ...WORKBENCH, name: 'Electronics bench', bins: WORKBENCH.bins?.slice(6) },
  WORKBENCH,
];

const signInMenu: Shot = {
  id: 'sharing-accounts-sign-in-menu',
  kind: 'still',
  async take(s) {
    await openEditor(s, ...LIBRARY);
    const button = s.page.getByRole('button', { name: label('dock.openMenu') }).first();
    await button.click({ force: true });
    await s.ui.warm(30);
    const menu = await s.box(s.page.getByLabel(label('dock.menuLabel')).first());
    const dock = await s.box(button);
    await s.still(
      { x: menu.x, y: menu.y, width: menu.width, height: dock.y + dock.height - menu.y },
      1.5
    );
  },
};

const TWO_LAYERS: FixtureLayout = {
  ...WORKBENCH,
  layers: [
    { name: 'Bottom', height: 6 },
    { name: 'Top tray', height: 3 },
  ],
  height: 12,
  bins: [
    ...(WORKBENCH.bins ?? []).slice(0, 7),
    { x: 0, y: 0, w: 3, d: 2, h: 3, label: 'Pencils', cat: 'Hand tools', layer: 1 },
    { x: 3, y: 0, w: 2, d: 2, h: 3, label: 'Tape', cat: 'Spares', layer: 1 },
    { x: 5, y: 0, w: 2, d: 2, h: 3, label: 'Glue sticks', cat: 'Spares', layer: 1 },
  ],
  categories: WORKSHOP_CATEGORIES,
};

const sharePopover: Shot = {
  id: 'sharing-share-links-popover',
  kind: 'still',
  async take(s) {
    await openEditor(s, TWO_LAYERS);
    const share = s.page.getByRole('button', { name: label('share.button.shareLayout') }).first();
    await share.click({ force: true });
    const popover = s.page.getByRole('dialog', { name: label('share.title') }).first();
    await s.until(popover);
    const header = await s.box(s.page.locator('header').first());
    const p = await s.box(popover);
    const b = await s.box(share);
    const find = await s.box(
      s.page.getByRole('button', { name: label('toolbar.findBins') }).first()
    );
    const left = find.x - 16;
    const right = b.x + b.width + 28;
    await s.still(
      { x: left, y: header.y, width: right - left, height: p.y + p.height + 28 - header.y },
      1.4
    );
  },
};

const reloadButton: Shot = {
  id: 'settings-offline-reload-button',
  kind: 'still',
  async take(s) {
    await openEditor(s, WORKBENCH);
    // What usePWAUpdate announces when a new service worker waits.
    await s.page.evaluate(async () => {
      const { usePWAUpdateStore } = (await import('/src/core/store/pwaUpdate.ts' as string)) as {
        usePWAUpdateStore: { getState(): { announceUpdate(apply: () => void): void } };
      };
      usePWAUpdateStore.getState().announceUpdate(() => undefined);
    });
    const version = s.page.getByRole('button', { name: label('pwaUpdate.reloadAria') }).first();
    await s.until(version);
    await s.ui.preReveal(version);
    const v = await s.box(version);
    const aside = await s.box(s.page.locator('aside').first());
    const learn = await s.box(
      s.page.getByRole('button', { name: new RegExp(`^${label('sidebar.learn')}`) }).first()
    );
    const top = learn.y - 12;
    // Ends on the version line: the credits below it name real people.
    await s.still({ x: aside.x, y: top, width: aside.width, height: v.y + v.height + 3 - top }, 2);
  },
};

/** A share id has twelve letters and digits (isValidLayoutId). */
const SHARE_ID = 'Kd7pQ2xVm9Ts';

const SHARED_DRAWER: FixtureLayout = {
  name: 'Kitchen utensil drawer',
  width: 8,
  depth: 6,
  height: 9,
  categories: [
    { name: 'Utensils', color: '#38bdf8' },
    { name: 'Baking', color: '#fbbf24' },
    { name: 'Gadgets', color: '#4ade80' },
  ],
  layers: [{ name: 'Layer 1', height: 6 }],
  bins: [
    { x: 0, y: 0, w: 2, d: 6, h: 6, label: 'Spatulas', cat: 'Utensils' },
    { x: 2, y: 0, w: 2, d: 6, h: 6, label: 'Ladles', cat: 'Utensils' },
    { x: 4, y: 0, w: 2, d: 3, h: 6, label: 'Measuring spoons', cat: 'Baking' },
    { x: 4, y: 3, w: 2, d: 3, h: 6, label: 'Cookie cutters', cat: 'Baking' },
    { x: 6, y: 0, w: 2, d: 2, h: 6, label: 'Peeler', cat: 'Gadgets' },
    { x: 6, y: 2, w: 2, d: 2, h: 6, label: 'Can opener', cat: 'Gadgets' },
    { x: 6, y: 4, w: 2, d: 2, h: 6, label: 'Thermometer', cat: 'Gadgets' },
  ],
};

const sharedLayout: Handler = (path, _url, method) =>
  path === `/api/share/${SHARE_ID}` && method === 'GET'
    ? {
        json: {
          layout: layoutFile(SHARED_DRAWER),
          metadata: { createdAt: new Date(CLOCK - 26 * HOUR).toISOString(), permission: 'view' },
        },
      }
    : undefined;

/** Narrower than DESKTOP, so the full-width banner reads larger in the docs column. */
const BANNER_VIEWPORT = { width: 1280, height: 800 };

const shareBanner: Shot = {
  id: 'sharing-share-links-banner',
  kind: 'still',
  viewport: BANNER_VIEWPORT,
  async take(s) {
    await routeApi(s, sharedLayout);
    const banner = (page: typeof s.page): Locator =>
      page.getByText(label('share.banner.viewingLayout', { name: SHARED_DRAWER.name }));
    await s.open(`/l/${SHARE_ID}/kitchen-utensil-drawer`, banner);
    await s.until(grid(s.page));
    await s.ui.warm(20);
    await s.dismissToasts();
    await s.still({ x: 0, y: 0, width: BANNER_VIEWPORT.width, height: 250 });
  },
};

/** Each entry must match the techniques and size of its built-in example. */
const EXAMPLES: Record<string, { techniques: string[]; size: number[]; workshop?: true }> = {
  'hero-multicolor-organizer': {
    techniques: ['compartments', 'labelTab', 'scoop'],
    size: [3, 2, 4],
  },
  'hero-engraved-tray': { techniques: ['compartments', 'labelTab'], size: [1, 4, 3] },
  'hero-handled-tote': { techniques: ['handles'], size: [3, 2, 10] },
  'scoop-2x3-ramp': { techniques: ['scoop'], size: [2, 3, 4] },
  'keyhole-tool-block': { techniques: ['workshop'], size: [3, 1, 5], workshop: true },
  'wall-cutout-2x4-cable': { techniques: ['wallCutouts'], size: [2, 4, 4] },
  'hero-u-shape': { techniques: ['customShape'], size: [3, 2, 4] },
  'knife-block-chef-trio': { techniques: ['knifeSlots'], size: [6, 2, 8] },
  'custom-l-shape': { techniques: ['customShape'], size: [2, 2, 4] },
  'corner-index-block': {
    techniques: ['workshop', 'customShape'],
    size: [2, 2, 3],
    workshop: true,
  },
  'fillet-2x2-bowls': { techniques: ['interiorFillet', 'compartments'], size: [2, 2, 3] },
  'hero-honeycomb-caddy': { techniques: ['wallPattern', 'scoop'], size: [2, 3, 5] },
  'slotted-2x2': { techniques: ['slotted'], size: [2, 2, 4] },
  'lid-2x2': { techniques: ['lid'], size: [2, 2, 4] },
  'toothpick-holder': { techniques: ['lid'], size: [1, 1, 3] },
};

type Card = [string, string, string, string, number, number, number, number];

/** Made-up gallery records, by makers with made-up handles. */
const CARDS: Card[] = [
  ['hero-multicolor-organizer', 'Screw and nut sorter', 'benchtop_wren', 'tools', 88, 12, 41, 60],
  ['hero-engraved-tray', 'Drill bit tray, 4 sizes', 'layerline_lab', 'tools', 61, 7, 33, 45],
  ['hero-handled-tote', 'Tool tote with handles', 'garage_grid', 'tools', 54, 4, 27, 38],
  ['scoop-2x3-ramp', 'Scoop bin for small parts', 'benchtop_wren', 'tools', 40, 9, 22, 52],
  ['keyhole-tool-block', 'Screwdriver block', 'pla_tinkerer', 'tools', 35, 2, 18, 20],
  ['wall-cutout-2x4-cable', 'Long bin with a side slot', 'drawer_tidy', 'tools', 23, 3, 14, 30],
  ['hero-u-shape', 'Drill charger cradle', 'garage_grid', 'tools', 19, 1, 11, 14],
  ['knife-block-chef-trio', 'Utility knife block', 'm3_maker', 'tools', 17, 2, 8, 25],
  ['custom-l-shape', 'L-shaped corner bin', 'layerline_lab', 'tools', 12, 0, 6, 9],
  ['corner-index-block', 'Corner tray for bits', 'pla_tinkerer', 'tools', 9, 1, 4, 6],
  ['fillet-2x2-bowls', 'Bead bowls', 'craft_corner', 'crafts', 30, 5, 16, 40],
  ['hero-honeycomb-caddy', 'Honeycomb pen caddy', 'drawer_tidy', 'office', 44, 6, 13, 33],
  ['slotted-2x2', 'Slotted card holder', 'm3_maker', 'office', 8, 0, 5, 12],
  ['lid-2x2', 'Bin with a lid for beads', 'craft_corner', 'crafts', 14, 1, 7, 18],
  ['toothpick-holder', 'Toothpick holder', 'benchtop_wren', 'kitchen', 6, 0, 3, 4],
];

function authorId(author: string): string {
  let hex = '';
  for (const ch of author.repeat(8)) hex += ch.charCodeAt(0).toString(16).slice(-1);
  return hex.slice(0, 32).padEnd(32, '0');
}

function communityCard(
  [example, name, author, category, likes, remixes, prints, daysAgo]: Card,
  i: number
): object {
  const ex = EXAMPLES[example];
  if (!ex) throw new Error(`no example ${example}`);
  const [w = 1, d = 1, h = 1] = ex.size;
  const created = CLOCK - daysAgo * 24 * HOUR;
  return {
    id: `cd${String(i + 1).padStart(10, '0')}`,
    name,
    authorName: author,
    authorPublicId: authorId(author),
    category,
    techniques: ex.techniques,
    ...(ex.workshop ? { kind: 'assembly' } : {}),
    metrics: { width: w * 42, depth: d * 42, height: h * 7, gridUnitMm: 42 },
    thumbnailUrl: `/src/features/bin-designer/data/examples/thumbnails/${example}.png`,
    isRemix: false,
    parentId: '',
    featured: false,
    counts: { likes, remixes, exports: likes * 3, prints },
    createdAt: created,
    updatedAt: created,
    status: 'live',
  };
}

const CAPABILITIES = { publishEnabled: true, printsEnabled: true, requireDescription: true };

const communityApi: Handler = (path, url, method) => {
  if (path !== '/api/community' || method !== 'GET') return undefined;
  if (url.searchParams.get('capabilities') === '1') return { json: CAPABILITIES };
  return {
    json: {
      items: CARDS.map(communityCard),
      nextCursor: null,
      likedIds: [],
      supporterAuthorIds: [],
      indexSlots: CARDS.length,
    },
  };
};

const communityGallery: Shot = {
  id: 'sharing-community-gallery',
  kind: 'still',
  async take(s) {
    await routeApi(s, communityApi);
    const card = (page: typeof s.page): Locator =>
      page.getByRole('link', { name: CARDS[0]?.[1] ?? '' });
    // Most liked, not most printed: the gallery sorts "Most printed" by date.
    await s.open('/community?cat=tools&sort=likes', card);
    await s.page.waitForTimeout(1500);
    await s.ui.warm(30);
    const bottom = await s.page
      .getByTestId('community-card-link')
      .evaluateAll((els) =>
        Math.max(...els.map((e) => (e.closest('.group') ?? e).getBoundingClientRect().bottom))
      );
    await s.still({ x: 0, y: 48, width: DESKTOP.width, height: bottom + 20 - 48 });
  },
};

const publishDialog: Shot = {
  id: 'sharing-community-publish',
  kind: 'still',
  async take(s) {
    await routeApi(s, communityApi);
    await openDesigner(s, 'Hex key and bit organizer', {
      width: 2,
      depth: 3,
      height: 6,
      compartments: { cols: 1, rows: 3, cells: [0, 1, 2] },
      label: { enabled: true },
    });
    const publish = s.page.getByRole('button', { name: label('community.publishButtonAria') });
    for (let i = 0; !(await publish.first().isEnabled()); i++) {
      if (i > 100) throw new Error('the publish button stayed disabled');
      await s.ui.warm(2);
      await s.page.waitForTimeout(100);
    }
    await publish.first().click({ force: true });
    const dialog = s.page.getByRole('dialog').first();
    const name = s.page.locator('#community-publish-name');
    await s.until(name);
    await name.fill('Hex key and bit organizer');
    await s.page
      .locator('#community-publish-description')
      .fill(
        'Three compartments for hex keys, drill bits and driver bits.\nThe label tab takes a 12 mm label strip.'
      );
    await s.page
      .getByRole('radio', { name: label('community.category.tools') })
      .click({ force: true });
    await s.page.locator('#community-public-name').fill('benchtop_wren');
    await s.page.locator('#community-public-name').blur();
    // The preview renders from the live part a moment after the dialog opens.
    await s.page.waitForTimeout(3000);
    await s.ui.warm(40);
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, DESKTOP));
  },
};

const ROOM_SHARE_ID = 'Rm4kW8zTq2Lx';
const ROOM_ID = `gridfinity-${ROOM_SHARE_ID}`;
const SELF_UID = 'docs-guest-self';
const OWNER_UID = 'docs-link-owner';
const GUEST_UID = 'docs-guest-two';
const OWNER_ACTOR = 1;
const GUEST_ACTOR = 2;
const SELF_ACTOR = 3;

const editShare: Handler = (path, _url, method) =>
  path === `/api/share/${ROOM_SHARE_ID}` && method === 'GET'
    ? {
        json: {
          layout: layoutFile(WORKBENCH),
          metadata: { createdAt: new Date(CLOCK - 3 * HOUR).toISOString(), permission: 'edit' },
        },
      }
    : undefined;

const b64url = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');

/** The client reads the payload only; nothing checks the signature. */
const roomToken: Handler = (path, _url, method) => {
  if (path !== '/api/liveblocks-auth' || method !== 'POST') return undefined;
  const iat = Math.floor(CLOCK / 1000);
  const payload = {
    k: 'acc',
    pid: 'docs',
    uid: SELF_UID,
    perms: { [ROOM_ID]: ['room:write'] },
    iat,
    exp: iat + 24 * 3600,
  };
  return { json: { token: `${b64url({ alg: 'none' })}.${b64url(payload)}.docs` } };
};

/** The Liveblocks wire codes this room uses (ServerMsgCode and ClientMsgCode in @liveblocks/core). */
const WIRE = {
  UPDATE_PRESENCE: 100,
  ROOM_STATE: 104,
  FETCH_STORAGE: 200,
  UPDATE_STORAGE: 201,
  STORAGE_CHUNK: 210,
  STORAGE_STREAM_END: 211,
} as const;

interface Presence {
  cursor: { x: number; y: number } | null;
  name: string;
  color: string;
  interaction: object;
  selectedBinIds: string[];
}

interface Room {
  presence(actor: number, data: Partial<Presence>): void;
}

/**
 * The layout itself comes from this browser, which writes it into the empty
 * room as the app does on a first join.
 */
async function joinRoom(s: DocsSession): Promise<Room> {
  // Without a public key the app never opens a room, so nothing here is used.
  const configured = await s.page.evaluate(async () => {
    const { isLiveblocksConfigured } = (await import('/src/liveblocks.config.ts' as string)) as {
      isLiveblocksConfigured: boolean;
    };
    return isLiveblocksConfigured;
  });
  if (!configured) {
    throw new Error(
      'live room shots need VITE_LIVEBLOCKS_PUBLIC_KEY (any value) in the dev server env'
    );
  }
  let socket: WebSocketRoute | null = null;
  const send = (msg: object): void => socket?.send(JSON.stringify(msg));
  const service = (url: URL): boolean =>
    url.hostname === 'liveblocks.io' || url.hostname.endsWith('.liveblocks.io');
  await s.page.routeWebSocket(service, (ws) => {
    socket = ws;
    ws.onMessage((message) => {
      if (message === 'ping') return ws.send('pong');
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message));
      } catch {
        throw new Error(`the room got a message it cannot read: ${String(message)}`);
      }
      for (const m of (Array.isArray(parsed) ? parsed : [parsed]) as {
        type: number;
        ops?: unknown;
      }[]) {
        if (m.type === WIRE.FETCH_STORAGE) {
          const metadata = { ownerId: OWNER_UID, permission: 'edit', version: 1 };
          ws.send(
            JSON.stringify([
              { type: WIRE.STORAGE_CHUNK, nodes: [['root', { metadata }]] },
              { type: WIRE.STORAGE_STREAM_END },
            ])
          );
        } else if (m.type === WIRE.UPDATE_STORAGE) {
          // Echoed ops are how the server acknowledges a write.
          ws.send(JSON.stringify({ type: WIRE.UPDATE_STORAGE, ops: m.ops }));
        }
      }
    });
    const user = (id: string): object => ({ id, scopes: ['room:write'] });
    send({
      type: WIRE.ROOM_STATE,
      actor: SELF_ACTOR,
      nonce: 'docs',
      scopes: ['room:write'],
      users: { [OWNER_ACTOR]: user(OWNER_UID), [GUEST_ACTOR]: user(GUEST_UID) },
      meta: {},
    });
  });
  await s.page.route(service, (route) => route.abort());
  await routeApi(s, editShare, roomToken);
  const state = new Map<number, Presence>();
  return {
    presence(actor, data) {
      const next = { ...(state.get(actor) as Presence), ...data };
      state.set(actor, next);
      // A targetActor marks the full presence a newcomer gets, not a patch.
      send({ type: WIRE.UPDATE_PRESENCE, actor, targetActor: SELF_ACTOR, data: next });
    },
  };
}

async function openRoom(s: DocsSession): Promise<Room> {
  const room = await joinRoom(s);
  await s.open(`/l/${ROOM_SHARE_ID}/workbench`, grid);
  const people = await s.page.evaluate(
    async (ids) => {
      const { generateGuestName, generateGuestColor } = (await import(
        '/src/shared/utils/guestNames.ts' as string
      )) as {
        generateGuestName(id: string): string;
        generateGuestColor(id: string): string;
      };
      return ids.map((id) => ({ name: generateGuestName(id), color: generateGuestColor(id) }));
    },
    [OWNER_UID, GUEST_UID]
  );
  [OWNER_ACTOR, GUEST_ACTOR].forEach((actor, i) => {
    const who = people[i];
    if (!who) return;
    room.presence(actor, {
      ...who,
      cursor: null,
      interaction: { type: 'idle' },
      selectedBinIds: [],
    });
  });
  const avatars = s.page.getByTitle(label('collab.seeCollaborators_other', { count: 3 }));
  await s.until(avatars);
  await s.ui.warm(30);
  await s.dismissToasts();
  return room;
}

const ROOM_STORAGE = { 'gridfinity-user-id': SELF_UID };

const participants: Shot = {
  id: 'sharing-live-collaboration-participants',
  kind: 'still',
  storage: ROOM_STORAGE,
  async take(s) {
    await openRoom(s);
    const avatars = s.page.getByTitle(label('collab.seeCollaborators_other', { count: 3 }));
    await avatars.click({ force: true });
    const list = s.page.getByRole('dialog', { name: label('collab.participants') });
    await s.until(list);
    const header = await s.box(s.page.locator('header').first());
    const l = await s.box(list);
    const a = await s.box(avatars);
    const share = await s.box(
      s.page.getByRole('button', { name: label('share.button.manageShare') }).first()
    );
    const exportButton = await s.box(
      s.page.getByRole('button', { name: label('header.export') }).first()
    );
    const left = Math.min(l.x - 24, share.x - 24, exportButton.x - 16);
    const right = Math.max(l.x + l.width, a.x + a.width) + 24;
    await s.still(
      { x: left, y: header.y, width: right - left, height: l.y + l.height + 24 - header.y },
      1.4
    );
  },
};

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const roomGrid: Shot = {
  id: 'sharing-live-collaboration-grid',
  kind: 'clip',
  storage: ROOM_STORAGE,
  async take(s) {
    const room = await openRoom(s);
    const id = (name: string): Promise<string | null> =>
      s.page.locator('[data-bin-id]', { hasText: name }).first().getAttribute('data-bin-id');
    const fuses = await id('Fuses');
    const washers = await id('Washers');
    if (!fuses || !washers) throw new Error('no bin ids on the grid');
    const area = await s.box(grid(s.page));
    // Fuses covers columns 5 to 6 and rows 6 to 7; the hand holds its middle.
    const [ax, ay] = await cellCenter(s, 5, 7);
    const [bx, by] = await cellCenter(s, 6, 6);
    const cell = bx - ax;
    const hold = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    const start = { x: hold.x - cell * 1.6, y: hold.y + cell * 0.9 };
    const pointer = { ...start };
    const at = (x: number, y: number): { x: number; y: number } => ({
      x: (x - area.x) / area.width,
      y: (y - area.y) / area.height,
    });
    const glide = async (
      frames: number,
      to: { x: number; y: number },
      extra: (x: number) => object = () => ({})
    ): Promise<void> => {
      const from = { ...pointer };
      for (let i = 1; i <= frames; i++) {
        const t = easeInOut(i / frames);
        pointer.x = from.x + (to.x - from.x) * t;
        pointer.y = from.y + (to.y - from.y) * t;
        room.presence(GUEST_ACTOR, { cursor: at(pointer.x, pointer.y), ...extra(pointer.x) });
        await s.ui.hold(1 / 30);
      }
    };
    room.presence(OWNER_ACTOR, { selectedBinIds: [washers] });
    room.presence(GUEST_ACTOR, { cursor: at(start.x, start.y) });
    await s.ui.warm(30);
    await s.ui.hideCursor();
    await s.take(pad(area, 8, DESKTOP), async () => {
      await s.ui.hold(0.4);
      await glide(14, hold);
      room.presence(GUEST_ACTOR, {
        selectedBinIds: [fuses],
        interaction: { type: 'dragging', binIds: [fuses], delta: { x: 0, y: 0 } },
      });
      await s.ui.hold(0.3);
      await glide(24, { x: hold.x + 2 * cell, y: hold.y }, (x) => ({
        interaction: {
          type: 'dragging',
          binIds: [fuses],
          delta: { x: Math.round((x - hold.x) / cell), y: 0 },
        },
      }));
      s.poster();
      await s.ui.hold(1.8);
    });
  },
};

export const SHARING_SETTINGS: readonly Shot[] = [
  signInMenu,
  sharePopover,
  shareBanner,
  communityGallery,
  publishDialog,
  participants,
  roomGrid,
  palette,
  labsTab,
  reloadButton,
  settingsDialog,
  spaceMouse,
  designImport,
  layoutImport,
  shortcutsPanel,
];
