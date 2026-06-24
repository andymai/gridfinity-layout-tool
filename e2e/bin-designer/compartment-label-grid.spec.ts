/**
 * Functional coverage for in-grid compartment labeling (the discoverability fix
 * for "I can only label ~10 of my 24 compartments").
 *
 * Verifies that with a 24-compartment grid you can:
 *  1. switch the 2D editor into "Add labels" mode,
 *  2. type a label and advance to the next compartment with Enter (no mouse),
 *  3. see those labels rendered directly on the grid cells (always-visible),
 *  4. reach all 24 via the counted bulk list, and enable label tabs from the
 *     inline prompt.
 */

import { test, expect, clearAllStorage } from '../fixtures';

test.describe('Bin Designer — compartment label grid', () => {
  test.beforeEach(async ({ page }) => {
    // Isolate from any autosaved design (the designer persists to localStorage).
    await page.goto('/designer');
    await clearAllStorage(page);
    await page.reload();
    await page.getByRole('spinbutton', { name: 'Columns', exact: true }).first().waitFor();
  });

  async function setGrid(page: import('@playwright/test').Page, cols: number, rows: number) {
    const colsInput = page.getByRole('spinbutton', { name: 'Columns', exact: true }).first();
    const rowsInput = page.getByRole('spinbutton', { name: 'Rows', exact: true }).first();
    await colsInput.fill(String(cols));
    await colsInput.blur();
    await rowsInput.fill(String(rows));
    await rowsInput.blur();
  }

  test('labels all flow onto the grid via keyboard, and the list is counted', async ({ page }) => {
    await setGrid(page, 6, 4); // 24 compartments

    // Enter labeling mode.
    await page.getByRole('button', { name: 'Add labels' }).click();

    // The roomy editor starts on compartment 1; type and Enter to advance.
    const field = page.getByRole('textbox', { name: 'Engraved text for compartment 1' });
    await expect(field).toBeVisible();
    await field.fill('M3');
    await field.press('Enter');

    const field2 = page.getByRole('textbox', { name: 'Engraved text for compartment 2' });
    await expect(field2).toBeFocused();
    await field2.fill('M4');
    await field2.press('Enter');

    const field3 = page.getByRole('textbox', { name: 'Engraved text for compartment 3' });
    await field3.fill('M5');
    await field3.blur();

    // Labels render directly on the grid cells (always-visible, not hover-gated).
    const grid = page.locator('[role="application"]');
    await expect(grid.getByText('M3', { exact: true })).toBeVisible();
    await expect(grid.getByText('M4', { exact: true })).toBeVisible();
    await expect(grid.getByText('M5', { exact: true })).toBeVisible();

    // Labels print only on tabs — the inline prompt enables the feature, then
    // the status line flips to a positive confirmation (two-sided CTA).
    await expect(page.getByText('Labels print only on label tabs.')).toBeVisible();
    await page.getByRole('button', { name: 'Enable label tabs' }).click();
    await expect(page.getByText('Labels engrave on the label tabs.')).toBeVisible();

    // The bulk list is collapsed but its header announces all 24 compartments,
    // so the remaining labels are discoverable (the original bug was that they
    // weren't). The count lives in a badge beside the title.
    await expect(page.getByText(/Compartment labels\s*24/)).toBeVisible();
  });

  test('the Add labels toggle is hidden for slotted interiors', async ({ page }) => {
    await setGrid(page, 6, 4);
    await expect(page.getByRole('button', { name: 'Add labels' })).toBeVisible();

    // Switch the interior to removable dividers (slotted) — label tabs (and so
    // grid labeling) don't apply there.
    await page.getByRole('button', { name: 'Removable Dividers' }).click();
    await expect(page.getByRole('button', { name: 'Add labels' })).toHaveCount(0);
  });
});
