import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Locator, Route, WebSocketRoute } from '@playwright/test';
import { WORKBENCH, WORKSHOP_CATEGORIES, layoutFile } from '../fixtures';
import type { FixtureLayout } from '../fixtures';
import { label } from '../labels';
import { DESKTOP, frameAround, pad, union } from '../session';
import type { DocsSession, Rect, Shot } from '../session';
import { openDesigner } from './apps';
import { cellCenter, grid, gridArea, openLayouts } from './layoutEditor';

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

const WINDOW: Rect = { x: 0, y: 0, ...DESKTOP };

/** Steps the clock in real time, for work that lands from a routed request. */
async function settle(s: DocsSession, tenths = 15): Promise<void> {
  for (let i = 0; i < tenths; i++) {
    await s.ui.warm(2);
    await s.page.waitForTimeout(100);
  }
}

const OWN_SHARE_ID = 'Wb3nT6qLx8Pa';

const shareServer: Handler = (path, _url, method) => {
  if (path === '/api/share' && method === 'POST') {
    return {
      json: {
        id: OWN_SHARE_ID,
        url: `/l/${OWN_SHARE_ID}/workbench`,
        deleteToken: 'docs-delete-token',
        permission: 'view',
      },
    };
  }
  if (path === `/api/share/${OWN_SHARE_ID}` && method === 'PUT') {
    return { json: { id: OWN_SHARE_ID, url: `/l/${OWN_SHARE_ID}/workbench`, permission: 'view' } };
  }
  return undefined;
};

const shareButton = (s: DocsSession, key: 'shareLayout' | 'manageShare'): Locator =>
  s.page.getByRole('button', { name: label(`share.button.${key}`) }).first();

const sharePopoverOf = (s: DocsSession): Locator =>
  s.page.getByRole('dialog', { name: label('share.title') }).first();

/** The header from "Find bins that fit" to the share button, down to `bottom`. */
async function headerStrip(s: DocsSession, bottom: number): Promise<Rect> {
  const header = await s.box(s.page.locator('header').first());
  const find = await s.box(s.page.getByRole('button', { name: label('toolbar.findBins') }).first());
  const share = await s.box(s.page.locator('header button[aria-haspopup="true"]').first());
  const left = find.x - 16;
  const right = share.x + share.width + 28;
  return { x: left, y: header.y, width: right - left, height: bottom - header.y };
}

/** Empty toolbar space right of "Find bins that fit": over the grid, the pointer lights up bins. */
async function toolbarRest(s: DocsSession): Promise<[number, number]> {
  const find = await s.box(s.page.getByRole('button', { name: label('toolbar.findBins') }).first());
  return [find.x + find.width + 18, find.y + find.height / 2];
}

/** A key press leaves a focus ring on the control that held the focus. */
async function blurFocus(s: DocsSession): Promise<void> {
  await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await s.ui.warm(20);
}

/** Off camera: makes the share link, so the button reads "Manage share". */
async function makeShareLink(s: DocsSession): Promise<void> {
  await shareButton(s, 'shareLayout').click({ force: true });
  await s.until(sharePopoverOf(s));
  await s.page
    .getByRole('button', { name: label('share.createShareLink') })
    .first()
    .click({ force: true });
  await s.until(shareButton(s, 'manageShare'));
  await settle(s, 10);
  await s.dismissToasts();
}

const shareCreate: Shot = {
  id: 'sharing-share-links-popover',
  kind: 'clip',
  async take(s) {
    await openEditor(s, TWO_LAYERS);
    await routeApi(s, shareServer);
    const share = shareButton(s, 'shareLayout');
    await share.click({ force: true });
    await s.until(sharePopoverOf(s));
    const p = await s.box(sharePopoverOf(s));
    await s.page.keyboard.press('Escape');
    await blurFocus(s);
    const area = await headerStrip(s, p.y + p.height + 28);
    const create = s.page.getByRole('button', { name: label('share.createShareLink') }).first();
    const header = await s.box(s.page.locator('header').first());
    const b = await s.box(share);
    await s.ui.park(...(await toolbarRest(s)));
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(share);
        await s.ui.hold(0.9);
        await s.ui.click(create);
        await s.ui.hold(1.2);
      },
      1.1
    );
    await s.ui.hideCursor();
    await s.until(shareButton(s, 'manageShare'));
    await s.dismissToasts();
    const closeUp = frameAround(b, 20, area.width / area.height, header);
    await s.take(closeUp, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const shareManage: Shot = {
  id: 'sharing-share-links-manage',
  kind: 'clip',
  async take(s) {
    await openEditor(s, TWO_LAYERS);
    await routeApi(s, shareServer);
    await makeShareLink(s);
    const manage = shareButton(s, 'manageShare');
    const remove = s.page.getByRole('button', { name: label('share.deleteShareLink') }).first();
    // Off camera, open it to the delete step once, for the frame.
    await manage.click({ force: true });
    await s.until(sharePopoverOf(s));
    await remove.click({ force: true });
    await s.ui.warm(20);
    const p = await s.box(sharePopoverOf(s));
    await s.page
      .getByRole('button', { name: label('common.cancel') })
      .first()
      .click({ force: true });
    await s.page.keyboard.press('Escape');
    await blurFocus(s);
    const area = await headerStrip(s, p.y + p.height + 24);
    const rest = await toolbarRest(s);
    await s.ui.park(...rest);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(manage);
        await s.ui.hold(1.4);
        await s.ui.click(remove);
        await s.ui.moveTo(...rest);
        s.poster();
        await s.ui.hold(2);
      },
      1.1
    );
  },
};

const MANAGER_VIEWPORT = { width: 1440, height: 960 };

const shareWithoutServer: Shot = {
  id: 'sharing-share-links-without-server',
  kind: 'clip',
  viewport: MANAGER_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    // Loaded again from the root, so the address names the open layout, as the link tab copies it.
    await s.open('/', grid);
    const manager = s.page.getByRole('dialog').first();
    const more = s.page
      .getByRole('button', { name: label('layouts.moreActionsFor', { name: WORKBENCH.name }) })
      .first();
    // Off camera, open the manager and its menu once, for the frame.
    await s.page.keyboard.press('ControlOrMeta+o');
    await s.until(more);
    await more.click({ force: true });
    const copy = s.page.getByRole('menuitem', { name: label('share.copyLink') }).first();
    await s.until(copy);
    const area = pad(union(await s.box(manager), await s.box(copy)), 14, MANAGER_VIEWPORT);
    await s.page.keyboard.press('Escape');
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    await s.page.mouse.click(area.x + area.width / 2, area.y + 6);
    await s.page.keyboard.press('Escape');
    await s.ui.warm(30);
    if (await manager.isVisible()) throw new Error('the layout manager did not close');
    await s.ui.hideCursor();
    await s.ui.park(area.x + area.width * 0.8, area.y + area.height * 0.9);
    const tab = (key: 'link' | 'file' | 'json'): Locator =>
      s.page.getByRole('tab', { name: label(`share.tabs.${key}`), exact: true }).first();
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.keys('ControlOrMeta+o', 'Ctrl O');
      await s.ui.hold(0.6);
      await s.ui.click(more);
      await s.ui.hold(0.4);
      await s.ui.click(copy);
      await s.ui.hold(0.3);
      s.poster();
      await s.ui.hold(1.3);
      await s.ui.click(tab('file'));
      await s.ui.hold(1.2);
      await s.ui.click(tab('json'));
      // The dialog grows and moves up under the pointer, so it moves off.
      await s.ui.moveTo(area.x + area.width * 0.9, area.y + area.height * 0.95);
      await s.ui.hold(1.4);
    });
  },
};

/** One bin label holds a web address, which the server's content filter refuses. */
const BLOCKED_DRAWER: FixtureLayout = {
  ...TWO_LAYERS,
  bins: (TWO_LAYERS.bins ?? []).map((b) =>
    b.label === 'Fuses' ? { ...b, label: 'Fuses www.example.com' } : b
  ),
};

const blockedShare: Handler = (path, _url, method) =>
  path === '/api/share' && method === 'POST'
    ? {
        status: 400,
        json: { error: 'Content blocked', code: 'CONTENT_BLOCKED', field: 'binLabel' },
      }
    : undefined;

const shareBlocked: Shot = {
  id: 'sharing-share-links-blocked',
  kind: 'still',
  async take(s) {
    await openEditor(s, BLOCKED_DRAWER);
    await routeApi(s, blockedShare);
    const share = shareButton(s, 'shareLayout');
    await share.click({ force: true });
    await s.until(sharePopoverOf(s));
    await s.page
      .getByRole('button', { name: label('share.createShareLink') })
      .first()
      .click({ force: true });
    await settle(s, 10);
    // The popover closes on the click; opened again, it holds the server's answer.
    if (!(await sharePopoverOf(s).isVisible())) await share.click({ force: true });
    const message = s.page.getByText(label('cloudShare.error.blockedBinLabel'));
    await s.until(message);
    await s.page.mouse.move(DESKTOP.width - 20, DESKTOP.height - 20);
    await s.ui.warm(10);
    const p = await s.box(sharePopoverOf(s));
    await s.still(await headerStrip(s, p.y + p.height + 28), 1.4);
  },
};

const SIGNED_IN_USER = {
  userId: 'docs-signed-in-user',
  provider: 'github',
  email: 'robin@example.com',
  displayName: 'Robin Park',
};

/** The last account on this device, so a sign-in does not ask about someone else's data. */
const SIGNED_IN_STORAGE = { 'gflt-last-signed-in-user': SIGNED_IN_USER.userId };

/** A signed-in session over an empty account: every upload lands, nothing comes down. */
const signedIn: Handler = (path, _url, method) => {
  if (path === '/api/auth/me') return { json: { authenticated: true, user: SIGNED_IN_USER } };
  if (path === '/api/auth/logout') return { json: {} };
  if (path === '/api/sync/manifest') {
    return {
      json: {
        indexUpdatedAt: CLOCK - HOUR,
        layouts: {},
        designs: {},
        baseplates: {},
        designVersions: {},
        folders: {},
      },
    };
  }
  if (path.startsWith('/api/sync/') && (method === 'PUT' || method === 'DELETE')) {
    return { json: { ok: true } };
  }
  return undefined;
};

/** A Settings tab's content with the dialog's own margin around it, down to `bottom`. */
function panelCrop(panel: Rect, bottom: number): Rect {
  return {
    x: panel.x - 24,
    y: panel.y - 20,
    width: panel.width + 48,
    height: bottom - (panel.y - 20),
  };
}

const signOut: Shot = {
  id: 'sharing-accounts-sign-out',
  kind: 'clip',
  storage: SIGNED_IN_STORAGE,
  async take(s) {
    await routeApi(s, signedIn);
    await openLayouts(s, ...LIBRARY);
    const dock = s.page.getByRole('button', { name: label('dock.openMenu') }).first();
    await s.until(s.page.getByText(SIGNED_IN_USER.displayName).first());
    await settle(s, 20);
    await s.dismissToasts();
    // Off camera, open the menu once, for the frame.
    await dock.click({ force: true });
    const item = s.page.getByRole('button', { name: label('auth.signOut'), exact: true }).first();
    await s.until(item);
    const menu = await s.box(s.page.getByLabel(label('dock.menuLabel')).first());
    await dock.click({ force: true });
    await s.ui.warm(20);
    const d = await s.box(dock);
    const area: Rect = {
      x: 0,
      y: menu.y - 1,
      width: d.x + d.width,
      height: d.y + d.height - (menu.y - 1),
    };
    // On the button it clicks next: elsewhere, the pointer lights up a panel card.
    await s.ui.park(d.x + d.width * 0.6, d.y + d.height * 0.5);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(dock);
        await s.ui.hold(1.2);
        await s.ui.click(item);
      },
      1.4
    );
    await s.ui.hideCursor();
    const dialog = s.page.getByRole('dialog', { name: label('syncDialog.signOut.title') });
    await s.until(dialog);
    await s.take(
      frameAround(await s.box(dialog), 20, area.width / area.height, WINDOW),
      async () => {
        s.poster();
        await s.ui.hold(2.2);
      }
    );
  },
};

const accountTab: Shot = {
  id: 'sharing-accounts-account-tab',
  kind: 'still',
  viewport: SETTINGS_VIEWPORT,
  storage: SIGNED_IN_STORAGE,
  async take(s) {
    await routeApi(s, signedIn);
    await openLayouts(s, WORKBENCH);
    await s.until(s.page.getByText(SIGNED_IN_USER.displayName).first());
    await settle(s, 20);
    await s.dismissToasts();
    await openSettings(s, 'settings.tabs.account');
    await s.until(s.page.getByText(label('dock.syncStatusIdle')).first());
    const panel = await s.box(s.page.locator('#settings-tabpanel-account'));
    const button = await s.box(
      s.page.getByRole('button', { name: label('account.deleteAccount.button') }).first()
    );
    await s.still(panelCrop(panel, button.y + button.height + 24), 1.2);
  },
};

const SORTER_ID = 'cd0000000001';
const SORTER_EXAMPLE = 'hero-multicolor-organizer';

/** The gallery's first card as the server returns it whole, built on the matching example. */
async function sorterDetail(s: DocsSession): Promise<object> {
  const params = await s.page.evaluate(async (id) => {
    const { HERO_EXAMPLES } = (await import(
      '/src/features/bin-designer/data/examples/heroes.ts' as string
    )) as { HERO_EXAMPLES: { id: string; params: unknown }[] };
    return HERO_EXAMPLES.find((e) => e.id === id)?.params;
  }, SORTER_EXAMPLE);
  if (!params) throw new Error(`no example ${SORTER_EXAMPLE}`);
  const card = CARDS[0];
  if (!card) throw new Error('no gallery cards');
  const created = CLOCK - card[7] * 24 * HOUR;
  return {
    design: {
      id: SORTER_ID,
      authorPublicId: authorId(card[2]),
      authorName: card[2],
      name: card[1],
      description:
        'Six cups for M2 to M5 screws and nuts.\nThe scoops make small parts easy to pick out.',
      category: card[3],
      techniques: EXAMPLES[SORTER_EXAMPLE]?.techniques ?? [],
      params,
      metrics: { width: 125.5, depth: 83.5, height: 28, gridUnitMm: 42 },
      lineage: null,
      thumbnails: [`/src/features/bin-designer/data/examples/thumbnails/${SORTER_EXAMPLE}.png`],
      meshUrl: `/src/features/bin-designer/data/examples/meshes/${SORTER_EXAMPLE}.glb`,
      photos: [],
      featured: false,
      createdAt: created,
      updatedAt: created,
      status: 'live',
    },
    isOwner: false,
    counts: { likes: card[4], remixes: card[5], exports: card[4] * 3 },
    likedByMe: false,
    authorIsSupporter: false,
    hiddenReason: null,
    hiddenReasonCategory: null,
  };
}

async function openSorter(s: DocsSession, ...handlers: Handler[]): Promise<Locator> {
  let detail: object | null = null;
  const designApi: Handler = (path, url, method) => {
    if (path === `/api/community/${SORTER_ID}` && method === 'GET' && detail) {
      return { json: detail };
    }
    if (path === '/api/community/prints' && method === 'GET') {
      return { json: { items: [], nextCursor: null, summary: null, mine: null } };
    }
    return communityApi(path, url, method);
  };
  await routeApi(s, ...handlers, designApi);
  await s.open('/designer', (page) => page.locator('header').first());
  detail = await sorterDetail(s);
  const dialog = s.page.getByRole('dialog').first();
  await s.open(`/community/d/${SORTER_ID}`, () =>
    s.page.getByRole('button', { name: label('community.detail.remix') })
  );
  await settle(s, 20);
  await s.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await s.ui.warm(10);
  return dialog;
}

/** A form that scrolls inside its dialog, back at its top, where its steps start. */
async function scrollToTop(s: DocsSession, dialog: Locator): Promise<void> {
  await dialog.evaluate((root) => {
    for (const n of root.querySelectorAll<HTMLElement>('*')) {
      if (
        n.scrollHeight > n.clientHeight + 4 &&
        /(auto|scroll)/.test(getComputedStyle(n).overflowY)
      )
        n.scrollTop = 0;
    }
  });
  await s.ui.warm(20);
}

const designPage: Shot = {
  id: 'sharing-community-design-page',
  kind: 'still',
  async take(s) {
    const dialog = await openSorter(s);
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, DESKTOP));
  },
};

const postPrint: Shot = {
  id: 'sharing-community-post-print',
  kind: 'still',
  storage: SIGNED_IN_STORAGE,
  async take(s) {
    await openSorter(s, signedIn);
    const cta = s.page.getByRole('button', { name: label('community.print.cta') }).first();
    await s.ui.preClick(cta);
    const form = s.page.getByRole('dialog', {
      name: new RegExp(`^${label('community.print.addTitle')}`),
    });
    const note = s.page.locator('#print-note');
    await s.until(note);
    await s.page
      .getByRole('radio', { name: label('community.print.fit.asDesigned') })
      .click({ force: true });
    await note.fill('Printed in PETG with no supports. M3 nuts drop in with room to spare.');
    await s.page.locator('#print-material').selectOption('PETG');
    await s.page.locator('#print-nozzle').fill('0.4');
    await s.page.locator('#print-layer-height').fill('0.2');
    await s.page.getByLabel(label('community.print.hoursLabel')).fill('2');
    await s.page.getByLabel(label('community.print.minutesLabel')).fill('45');
    await s.page.locator('#print-name').fill('robin_makes');
    await s.page.locator('#print-name').blur();
    await scrollToTop(s, form);
    await s.still(pad(await s.box(form), DIALOG_MARGIN, DESKTOP));
  },
};

const reportDesign: Shot = {
  id: 'sharing-community-report',
  kind: 'still',
  storage: SIGNED_IN_STORAGE,
  async take(s) {
    await openSorter(s, signedIn);
    await s.page
      .getByRole('button', { name: label('community.detail.report'), exact: true })
      .first()
      .click({ force: true });
    const reason = s.page.getByRole('radio', { name: label('community.report.reason.broken') });
    await s.until(reason);
    await reason.click({ force: true });
    await s.page
      .getByPlaceholder(label('community.report.notePlaceholder'))
      .fill('The scoops are missing in the 3D view.');
    await s.page.getByPlaceholder(label('community.report.notePlaceholder')).blur();
    const dialog = s.page.getByRole('dialog', {
      name: new RegExp(`^${label('community.report.title')}`),
    });
    await scrollToTop(s, dialog);
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, DESKTOP), 1.2);
  },
};

/** This account has published nothing yet. */
const noDesignsOfMine: Handler = (path, url, method) =>
  path === '/api/community' && method === 'GET' && url.searchParams.get('mine') === '1'
    ? { json: { items: [], nextCursor: null, likedIds: [], supporterAuthorIds: [], indexSlots: 0 } }
    : undefined;

const publishChecks: Shot = {
  id: 'sharing-community-publish-checks',
  kind: 'still',
  storage: SIGNED_IN_STORAGE,
  async take(s) {
    await routeApi(s, signedIn, noDesignsOfMine, communityApi);
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
    await s.page.locator('#community-publish-description').fill('Bits');
    await s.page
      .getByRole('radio', { name: label('community.category.tools') })
      .click({ force: true });
    await s.page.locator('#community-public-name').fill('benchtop_wren');
    await s.page.locator('#community-public-name').blur();
    await s.page.waitForTimeout(3000);
    await s.ui.warm(40);
    await s.until(s.page.getByText(label('community.publish.error.descriptionTooShort')).first());
    await s.still(pad(await s.box(dialog), DIALOG_MARGIN, DESKTOP));
  },
};

const galleryFromDesigner: Shot = {
  id: 'sharing-community-open-gallery',
  kind: 'clip',
  async take(s) {
    await routeApi(s, communityApi);
    await openDesigner(s, 'Screw bin', { width: 2, depth: 2, height: 4 });
    const entry = s.page
      .getByRole('button', { name: new RegExp(`^${label('binExamples.sidebarEntry')}`) })
      .first();
    await s.ui.preReveal(entry);
    const e = await s.box(entry);
    const closeUp = frameAround(e, 40, 4 / 3, WINDOW);
    await s.ui.park(closeUp.x + closeUp.width * 0.7, closeUp.y + closeUp.height * 0.85);
    await s.take(
      closeUp,
      async () => {
        await s.ui.hold(0.5);
        await s.ui.click(entry);
        await s.ui.hold(0.3);
      },
      640 / closeUp.width
    );
    await s.ui.hideCursor();
    const card = s.page.getByRole('link', { name: CARDS[0]?.[1] ?? '' }).first();
    await s.until(card);
    await settle(s, 15);
    const dialog = s.page.getByRole('dialog').first();
    await s.take(frameAround(await s.box(dialog), 6, 4 / 3, WINDOW), async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const settingsSearch: Shot = {
  id: 'settings-settings-search',
  kind: 'clip',
  viewport: SETTINGS_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    const dialog = await openSettings(s, 'settings.tabs.general');
    const d = await s.box(dialog);
    const search = s.page.getByPlaceholder(label('settings.search.placeholder')).first();
    const area: Rect = { x: d.x, y: d.y, width: d.width, height: d.width * 0.62 };
    // The dialog's empty title bar: over the language list, the pointer lights up a row.
    await s.ui.park(area.x + area.width * 0.5, area.y + 36);
    await s.take(area, async () => {
      await s.ui.hold(0.4);
      await s.ui.click(search);
      await s.type('dark');
      await s.ui.hold(0.9);
      await s.ui.click(s.page.getByRole('option').first());
      // The tab fades in, with a ring on the setting.
      await s.ui.hold(0.5);
      s.poster();
      await s.ui.hold(1.7);
    });
  },
};

const settingsDefaults: Shot = {
  id: 'settings-settings-defaults',
  kind: 'still',
  viewport: SETTINGS_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    await openSettings(s, 'settings.tabs.defaults');
    const panel = await s.box(s.page.locator('#settings-tabpanel-defaults'));
    const copy = await s.box(
      s.page.getByRole('button', { name: label('settings.copyFromCurrentLayout') }).first()
    );
    await s.still(panelCrop(panel, copy.y + copy.height + 20), 1.2);
  },
};

async function selectBins(s: DocsSession, ...names: string[]): Promise<void> {
  const ids = await Promise.all(
    names.map((name) =>
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
}

/** The palette's place on screen, from opening it once off camera. */
async function paletteBox(s: DocsSession): Promise<Rect> {
  await s.page.keyboard.press('ControlOrMeta+k');
  const root = s.page.locator('[cmdk-root]').first();
  await s.until(root);
  const box = await s.box(root);
  await s.page.keyboard.press('Escape');
  await s.ui.warm(20);
  return box;
}

const paletteRun: Shot = {
  id: 'settings-keyboard-palette-run',
  kind: 'clip',
  async take(s) {
    await openEditor(s, WORKBENCH);
    await selectBins(s, 'Fuses');
    const area = frameAround(await paletteBox(s), 28, 4 / 3, WINDOW);
    await s.ui.hideCursor();
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.keys('ControlOrMeta+k', 'Ctrl K');
      await s.ui.hold(0.3);
      await s.type('dupl');
      await s.ui.hold(0.8);
      // "Duplicate layout" ranks first; the arrow key skips the gray command below it.
      await s.keys('ArrowDown', '↓');
      await s.ui.hold(0.6);
      const picked = await s.page.locator('[cmdk-item][data-selected="true"]').first().innerText();
      if (!picked.includes(label('commandPalette.duplicateSelected'))) {
        throw new Error(`the arrow key picked "${picked}"`);
      }
      await s.keys('Enter');
      await s.ui.hold(0.2);
    });
    await s.dismissToasts();
    const cells = await gridArea(s, WORKBENCH.width, WORKBENCH.depth);
    await s.take(frameAround(cells, 12, 4 / 3, WINDOW), async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

const helpToPalette: Shot = {
  id: 'settings-keyboard-help-search',
  kind: 'clip',
  async take(s) {
    await openEditor(s, WORKBENCH);
    await selectBins(s, 'M3', 'M4');
    await s.page.keyboard.press('?');
    const help = s.page.getByRole('dialog', { name: label('help.title') });
    await s.until(help);
    const h = await s.box(help);
    await s.page.keyboard.press('Escape');
    await s.ui.warm(20);
    const area: Rect = { x: h.x, y: h.y, width: h.width, height: h.width * 0.75 };
    const search = s.page.getByPlaceholder(label('help.searchPlaceholder')).first();
    await s.ui.hideCursor();
    await s.take(area, async () => {
      await s.ui.hold(0.5);
      await s.keys('?', '?');
      await s.ui.hold(0.4);
      await s.ui.click(search);
      await s.type('align');
      await s.ui.hold(1);
      await s.ui.click(
        s.page.getByRole('button', { name: label('help.openCommandPaletteWithQuery') }).first()
      );
      await s.ui.hold(0.2);
    });
    await s.ui.hideCursor();
    const root = s.page.locator('[cmdk-root]').first();
    await s.until(root);
    await s.take(frameAround(await s.box(root), 28, 4 / 3, WINDOW), async () => {
      s.poster();
      await s.ui.hold(2.2);
    });
  },
};

const paletteDisabled: Shot = {
  id: 'settings-keyboard-palette-disabled',
  kind: 'still',
  async take(s) {
    await openEditor(s, WORKBENCH);
    await s.page.keyboard.press('ControlOrMeta+k');
    const root = s.page.locator('[cmdk-root]').first();
    await s.until(root);
    await s.page.keyboard.type('align');
    await s.ui.warm(20);
    await s.still(pad(await s.box(root), 20, DESKTOP), 1.2);
  },
};

const spaceMouseDriver: Shot = {
  id: 'settings-spacemouse-driver',
  kind: 'still',
  viewport: SETTINGS_VIEWPORT,
  async take(s) {
    await openEditor(s, WORKBENCH);
    await openSettings(s, 'settings.tabs.general');
    const section = s.page.locator('section[data-settings-section="spacemouse"]');
    await s.ui.preClick(
      section.getByRole('switch', { name: label('settings.spacemouseEnable') }).first()
    );
    // No driver answers here, so the search ends on the direct connection. The
    // state the driver sets is then written over it.
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
              setTransport(transport: string): void;
            };
          };
        };
        const st = useSpaceMouseStore.getState();
        // A late answer from the search writes idle again, so this repeats until it holds.
        if (st.transport !== null && st.status === 'idle') {
          st.setTransport('navlib');
          st.setConnection('connected', 'SpaceMouse Compact');
        }
        const now = useSpaceMouseStore.getState();
        return `${now.transport ?? ''}:${now.status}`;
      });
    for (let i = 0, stable = 0; stable < 10; i++) {
      stable = (await connect()) === 'navlib:connected' ? stable + 1 : 0;
      if (i > 150) throw new Error('the SpaceMouse search did not settle');
      await s.ui.warm(2);
      await s.page.waitForTimeout(100);
    }
    await s.until(s.page.getByText(label('spacemouse.driverManaged')).first());
    await section.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await s.ui.warm(10);
    const sec = await s.box(section);
    await s.still(
      { x: sec.x - 12, y: sec.y - 8, width: sec.width + 24, height: sec.height + 16 },
      1.25
    );
  },
};

const LABS_ON = {
  'gridfinity-labs-v1': JSON.stringify({
    enabledFeatures: { places: true },
    lastModified: new Date(CLOCK).toISOString(),
    version: 1,
  }),
};

/** What each labelled bin holds, as [name, qty] pairs. */
type Contents = Record<string, [string, number][]>;

const WORKBENCH_CONTENTS: Contents = {
  'Hex keys': [
    ['1.5 mm hex key', 2],
    ['2 mm hex key', 2],
    ['2.5 mm hex key', 3],
    ['3 mm hex key', 2],
    ['4 mm hex key', 1],
    ['5 mm hex key', 1],
  ],
  'Driver bits': [
    ['PH2 bit', 4],
    ['T20 bit', 2],
    ['Hex bit set', 1],
  ],
};

const BENCH_CONTENTS: Contents = {
  'Hex keys': [
    ['Ball-end hex key set', 1],
    ['T-handle hex key', 1],
  ],
};

function withContents(fixture: FixtureLayout, contents: Contents): object {
  const file = layoutFile(fixture) as { bins: { label: string; items?: object[] }[] };
  for (const bin of file.bins) {
    const items = contents[bin.label];
    if (!items) continue;
    bin.items = items.map(([name, qty], i) => ({ id: `item-${i + 1}`, name, qty }));
  }
  return file;
}

async function openContents(s: DocsSession): Promise<void> {
  await routeApi(s);
  await s.open('/', grid);
  await s.importLayouts(
    [
      withContents({ ...WORKBENCH, name: 'Garage bench' }, BENCH_CONTENTS),
      withContents(WORKBENCH, WORKBENCH_CONTENTS),
    ],
    grid
  );
}

const labsContents: Shot = {
  id: 'settings-labs-bin-contents',
  kind: 'still',
  storage: LABS_ON,
  async take(s) {
    await openContents(s);
    await s.page.locator('[data-bin-id]', { hasText: 'Hex keys' }).first().click({ force: true });
    await s.ui.warm(20);
    await s.dismissToasts();
    const title = s.page
      .locator('aside')
      .last()
      .getByText(label('inspector.contents.title'), { exact: true })
      .first();
    await s.until(title);
    await s.ui.preReveal(title);
    const input = s.page.getByPlaceholder(label('inspector.contents.addPlaceholder')).first();
    const head = await s.box(title);
    const last = await s.box(s.page.getByLabel('5 mm hex key', { exact: true }).first());
    const add = await s.box(input);
    const bottom = Math.max(last.y + last.height, add.y + add.height) + 16;
    await s.page.mouse.move(DESKTOP.width / 2, DESKTOP.height - 20);
    await s.ui.warm(10);
    const left = head.x - 16;
    await s.still(
      { x: left, y: head.y - 14, width: DESKTOP.width - left, height: bottom - (head.y - 14) },
      1.4
    );
  },
};

const labsFind: Shot = {
  id: 'settings-labs-find',
  kind: 'still',
  storage: LABS_ON,
  async take(s) {
    await openContents(s);
    await s.page.keyboard.press('ControlOrMeta+k');
    const root = s.page.locator('[cmdk-root]').first();
    await s.until(root);
    await s.page.keyboard.type('hex key');
    await settle(s, 20);
    await s.until(s.page.getByText('Garage bench').first());
    await s.still(pad(await s.box(root), 20, DESKTOP), 1.2);
  },
};

const designerSearch: Shot = {
  id: 'settings-keyboard-designer-search',
  kind: 'clip',
  async take(s) {
    await routeApi(s);
    await openDesigner(s, 'Screw bin', { width: 2, depth: 2, height: 4 });
    const search = s.page.getByPlaceholder(label('settings.search.placeholder')).first();
    const panel = await s.box(s.page.locator('aside').first());
    const box = await s.box(search);
    const area: Rect = {
      x: panel.x,
      y: box.y - 14,
      width: panel.width,
      height: Math.min(panel.width * 1.25, DESKTOP.height - (box.y - 14)),
    };
    await s.ui.park(area.x + area.width * 0.8, area.y + area.height * 0.95);
    await s.take(
      area,
      async () => {
        await s.ui.hold(0.4);
        await s.ui.click(search);
        await s.type('scoop');
        await s.ui.hold(0.9);
        await s.keys('Enter');
        await s.ui.hold(0.3);
      },
      1.4
    );
    await s.ui.hideCursor();
    await settle(s, 10);
    // The panel scrolls the setting into view: the cut frames it at the same size.
    const setting = await s.box(
      s.page
        .locator('aside')
        .first()
        .getByText(label('binDesigner.fingerScoop'), { exact: true })
        .first()
    );
    const result = frameAround(
      { x: panel.x, y: setting.y - 40, width: panel.width, height: setting.height + 80 },
      0,
      area.width / area.height,
      { ...panel, y: box.y - 14, height: DESKTOP.height - (box.y - 14) }
    );
    await s.take(result, async () => {
      s.poster();
      await s.ui.hold(2);
    });
  },
};

export const SHARING_SETTINGS: readonly Shot[] = [
  signInMenu,
  shareCreate,
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
  shareManage,
  shareWithoutServer,
  shareBlocked,
  signOut,
  accountTab,
  galleryFromDesigner,
  designPage,
  postPrint,
  reportDesign,
  publishChecks,
  settingsSearch,
  settingsDefaults,
  paletteRun,
  helpToPalette,
  designerSearch,
  paletteDisabled,
  spaceMouseDriver,
  labsContents,
  labsFind,
];
