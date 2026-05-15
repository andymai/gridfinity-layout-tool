/**
 * Pins the fix for the multi-color export regression: faces tagged via
 * `collectOrigins` must reach the final 3MF as distinct material indices.
 * Failure mode if this regresses: `<basematerials>` is missing, or every
 * `<triangle>` carries the same `p1` — i.e. one color for the whole bin.
 */

import { test, expect } from '../fixtures';
import { unzipSync, strFromU8 } from 'fflate';
import fs from 'node:fs';

const LABS_KEY = 'gridfinity-labs-v1';
const LAB_FLAG = 'multi_color_export';
const BODY_HEX = '#00aaff';
const LIP_HEX = '#ff0066';

test.describe('Bin Designer — multi-color 3MF export', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ key, flag }) => {
        const prefs = {
          enabledFeatures: { [flag]: true },
          lastModified: new Date().toISOString(),
          version: 1,
        };
        try {
          localStorage.setItem(key, JSON.stringify(prefs));
        } catch {
          // If storage is unavailable, the visibility assertion below fails
          // with a clearer signal than rethrowing here would give.
        }
      },
      { key: LABS_KEY, flag: LAB_FLAG }
    );
  });

  test('exports a 3MF with body + lip materials', async ({ page }) => {
    await page.goto('/designer');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30000 });

    for (const [label, hex] of [
      [/^Body: /i, BODY_HEX],
      [/^Stacking Lip: /i, LIP_HEX],
    ] as const) {
      const trigger = page.getByRole('button', { name: label });
      await expect(trigger).toBeVisible({ timeout: 5000 });
      await trigger.click();
      const popover = page.locator('[role="dialog"]').last();
      await popover.getByRole('textbox').first().fill(hex);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      // The picker button's aria-label is `${label}: ${hex}` — waiting for it
      // to update is a deterministic signal that the color change landed in
      // the store, no wall-clock guess needed.
      await expect(page.getByRole('button', { name: new RegExp(`${hex}$`, 'i') })).toBeVisible({
        timeout: 5000,
      });
    }

    await page
      .getByRole('button', { name: /^export/i })
      .first()
      .click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const threeMfOption = dialog.getByRole('button', { name: /^3MF\b/i }).first();
    if (await threeMfOption.isVisible().catch(() => false)) {
      await threeMfOption.click();
    } else {
      await dialog.getByRole('radio', { name: /3MF/i }).first().click();
    }

    const downloadButton = dialog.getByRole('button', { name: /download 3mf/i });
    await expect(downloadButton).toBeEnabled({ timeout: 60_000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await downloadButton.click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const buf = fs.readFileSync(downloadPath);
    const entries = unzipSync(new Uint8Array(buf));
    expect(entries['3D/3dmodel.model']).toBeDefined();
    const xml = strFromU8(entries['3D/3dmodel.model']);

    // Lower-cased: exporter's hex case is not part of the contract.
    expect(xml.toLowerCase()).toContain(BODY_HEX);
    expect(xml.toLowerCase()).toContain(LIP_HEX);
    expect(xml).toMatch(/<basematerials\b/);

    const triangleMatches = xml.match(/<triangle\b[^/]*p1="(\d+)"/g) ?? [];
    expect(triangleMatches.length).toBeGreaterThan(0);
    const distinctP1 = new Set(triangleMatches.map((m) => /p1="(\d+)"/.exec(m)?.[1]));
    expect(distinctP1.size).toBeGreaterThanOrEqual(2);
  });
});
