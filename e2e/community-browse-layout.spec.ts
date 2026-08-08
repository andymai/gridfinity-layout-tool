import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Layout guards for the /community browse grid.
 *
 * These live in e2e rather than beside the components because the defects they
 * cover are geometric: jsdom performs no layout, so scrollWidth, column tracks
 * and element overhang are all zero there and a unit test cannot see them.
 *
 * The corpus is seeded rather than taken from production. The blowout this
 * guards against is gated on the widest card's min-content, not on how many
 * cards there are, so it needs designs with ordinary-length names and a long
 * author handle to reproduce; the two designs live in production today happen
 * to stay under the threshold.
 */

const LONG_HANDLE = 'a_very_long_maker_handle_2024';

const NAMES = [
  'M3 Hex Driver Nest',
  'Sorting Tray for Resistors',
  'Coffee Pod Ladder',
  'Bit Holder',
  'Watchmaker Screw Cellar',
  'Deep Socket Rack',
];

// metrics are outer millimetres; cardDims divides by gridUnitMm.
function seedCorpus(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i).padStart(12, 'a'),
    name: `${NAMES[i % NAMES.length]} v${i}`,
    authorName: i % 2 === 0 ? LONG_HANDLE : 'nils',
    authorPublicId: 'f'.repeat(32),
    category: ['tools', 'hardware', 'kitchen', 'other'][i % 4],
    techniques: ['compartments'],
    metrics: {
      width: 42 * (1 + (i % 6)),
      depth: 42 * (1 + (i % 5)),
      height: 7 * (2 + (i % 7)),
      gridUnitMm: 42,
    },
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    // Three-digit likes plus a print count is the widest the footer gets.
    counts: { likes: 100 + i, remixes: i % 9, prints: 1 + (i % 3), exports: i },
    createdAt: 1735689600000 + i * 86400000,
    updatedAt: 1735689600000 + i * 86400000,
    status: 'live',
  }));
}

/**
 * Matched on pathname, not a glob: `**\/api/community**` also matches the dev
 * server's own module request for src/core/api/communityClient.ts, which then
 * gets served JSON and takes the whole app down.
 */
async function stubIndex(page: Page, items: readonly unknown[]) {
  await page.route(
    (url) => url.pathname === '/api/community',
    async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has('capabilities')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ publishEnabled: true }),
        });
        return;
      }
      const cursor = Number(url.searchParams.get('cursor') ?? 0);
      const page24 = items.slice(cursor, cursor + 24);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: page24,
          nextCursor:
            cursor + page24.length >= items.length ? null : String(cursor + page24.length),
          likedIds: [],
        }),
      });
    }
  );
}

async function openBrowse(page: Page, count = 30) {
  await stubIndex(page, seedCorpus(count));
  await page.goto('/community');
  await page.locator('[data-community-card]').first().waitFor({ timeout: 30000 });
}

/** The browse grid proper, as opposed to the shelf rails above it. */
function browseGrid(page: Page) {
  return page
    .getByRole('list', { name: /designs/i })
    .filter({ has: page.locator('li') })
    .last();
}

test.describe('community browse layout', () => {
  for (const viewport of [
    { name: 'phone', width: 390, height: 844 },
    { name: 'small phone', width: 320, height: 700 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`grid stays inside its scroller at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openBrowse(page);

      // The gallery body is a flex item. Without min-w-0 its automatic minimum
      // size is the widest card's min-content, so it refuses to shrink and the
      // grid sizes to that instead of to the viewport.
      //
      // Measured against the viewport, not against the scroller's own
      // scrollWidth: when the scroller is itself the element that blew out, its
      // scrollWidth equals its clientWidth and an overflow check reads clean
      // while the grid is three times the width of the screen.
      const scroller = page.getByTestId('community-gallery-scroll');
      const box = await scroller.evaluate((el) => ({
        client: el.clientWidth,
        scroll: el.scrollWidth,
      }));
      expect(box.client).toBeLessThanOrEqual(viewport.width);
      expect(box.scroll).toBeLessThanOrEqual(viewport.width);

      // And the document itself never pans sideways.
      const bodyOverflow = await page.evaluate(
        () => document.body.scrollWidth - document.documentElement.clientWidth
      );
      expect(bodyOverflow).toBeLessThanOrEqual(0);
    });
  }

  test('no card paints outside its own bounds', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await openBrowse(page);

    // The footer used to be a no-wrap flex row: at 320px the print count was
    // painted up to 43px past the card's right edge.
    const overhang = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-community-card]')];
      return Math.max(
        0,
        ...cards.flatMap((card) => {
          const right = card.getBoundingClientRect().right;
          return [...card.querySelectorAll('*')].map((el) =>
            Math.round(el.getBoundingClientRect().right - right)
          );
        })
      );
    });
    expect(overhang).toBe(0);
  });

  test('cards in the grid share one height', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBrowse(page);

    const heights = await browseGrid(page).evaluate((grid) => [
      ...new Set(
        [...grid.querySelectorAll('[data-community-card]')].map((c) =>
          Math.round(c.getBoundingClientRect().height)
        )
      ),
    ]);
    expect(heights).toHaveLength(1);
  });

  test('a long author handle truncates mid-name rather than to "by…"', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await openBrowse(page);

    // line-clamp breaks by line, so an unbreakable handle wraps to a line that
    // is then clamped away and the label renders as "by…", naming nobody. The
    // invariant is that a label too long to fit still uses the width it has,
    // rather than collapsing to the prefix plus an ellipsis.
    const truncated = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('[data-testid=community-card-author] span')];
      return spans
        .filter((s) => s.scrollWidth > s.clientWidth)
        .map((s) => ({
          used: Math.round(s.getBoundingClientRect().width),
          available: Math.round(
            (
              s.closest('[data-testid=community-card-author]') as HTMLElement
            ).getBoundingClientRect().width
          ),
        }));
    });

    expect(truncated.length).toBeGreaterThan(0);
    for (const { used, available } of truncated) {
      expect(used).toBeGreaterThanOrEqual(available * 0.9);
    }
  });

  test('a card is a real link to its design', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBrowse(page);

    // A gallery is a place people compare things, so opening a design in a new
    // tab and copying its address have to work.
    const link = page.getByTestId('community-card-link').first();
    await expect(link).toHaveAttribute('href', /^\/community\/d\/[a-z0-9]{12}$/);

    // The plain click still opens the overlay in place rather than navigating.
    await link.click();
    await expect(page).toHaveURL(/\/community\/d\//);
  });
});
