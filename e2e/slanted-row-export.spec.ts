/**
 * A slanted row painted with the size brush reaches the layout export as the
 * parts that print it: bodies of the row's one design, and exactly one end
 * support beside the lead bin's body. The lead bin exports apart from the rest
 * of the row because only it carries the support.
 */

import fs from 'node:fs';
import { unzipSync } from 'fflate';
import {
  test,
  expect,
  clearAllStorage,
  getGridBounds,
  getSidebar,
  resetViewport,
  waitForAppReady,
  waitForBinCount,
} from './fixtures';

test.describe('Slanted row export', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'desktop pointer flow; the export runs the kernel, which other engines run far slower'
    );
    await page.addInitScript(() => {
      localStorage.setItem(
        'gridfinity-labs-v1',
        JSON.stringify({
          enabledFeatures: { slant: true },
          lastModified: new Date().toISOString(),
          version: 1,
        })
      );
    });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test('exports the row as its design and one end support', async ({ page }) => {
    test.setTimeout(240_000);

    await getSidebar(page)
      .getByRole('button', { name: /Size Brush/i })
      .click();
    await page.getByRole('checkbox', { name: 'Slanted row' }).click();
    await page.getByRole('button', { name: 'Select paint size: 1×1' }).click();
    await expect(page.getByText(/Slanted 1×1 rows \(45°, Back\)/)).toBeVisible();

    const grid = page.locator('[role="application"]');
    const label = (await grid.getAttribute('aria-label')) ?? '';
    const [, columns, rows] = /(\d+) columns by (\d+) rows/.exec(label) ?? [];
    const bounds = await getGridBounds(page);
    const pitch = (bounds.width + 1) / Number(columns);
    const cell = (x: number, y: number): { x: number; y: number } => ({
      x: bounds.x + (x + 0.5) * pitch,
      y: bounds.y + (Number(rows) - 1 - y + 0.5) * pitch,
    });

    // In the default 12u drawer a 45° row needs two cells behind its lead bin
    // for the support, so five cells hold three bins.
    const from = cell(0, 0);
    const to = cell(0, 4);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    await waitForBinCount(page, 3, 15_000);
    await expect(page.getByTestId('slant-support-cells')).toHaveCount(1);

    await page.locator('header').getByRole('button', { name: 'Export layout (3D)' }).click();
    const download = page.waitForEvent('download', { timeout: 200_000 });
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    const zip = unzipSync(fs.readFileSync(await (await download).path()));

    const bins = Object.keys(zip).filter((name) => name.startsWith('bins/'));
    const supports = bins.filter((name) => name.endsWith('_slant-support.stl'));
    const bodies = bins.filter((name) => !supports.includes(name));
    expect(supports).toHaveLength(1);
    expect(bodies).toHaveLength(2);
    expect(bodies).toContain(supports[0].replace('_slant-support.stl', '.stl'));
    for (const name of bins) expect(zip[name].byteLength).toBeGreaterThan(84);
  });
});
