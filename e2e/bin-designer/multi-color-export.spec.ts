/**
 * Verifies the `multi_color_export` Labs flow end-to-end. Pins the fix for
 * the bug where every face downstream of `collectOrigins` got the same tag
 * because brepjs's `mesh().faceGroups[].origin` is `0` by default — the
 * previous implementation tried to use that field as a face-id and ended up
 * with a one-entry map. The repaired path calls `setShapeOrigin(shape, tag)`
 * so origins propagate through fuses and reach the final mesh.
 *
 * Step list:
 *   1. Enable the Labs flag, change body + lip to distinct hex colors
 *   2. Download the 3MF, unzip it, parse the embedded XML
 *   3. Assert `<basematerials>` carries the chosen hex colors AND the
 *      per-triangle `pid`/`p1` attributes span ≥2 distinct material indices
 *
 * If `<basematerials>` is missing or every `<triangle>` carries the same
 * `p1`, the regression is back.
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
          // Storage may be unavailable in private/incognito contexts; the
          // test will fail at the next visibility assertion if the flag
          // doesn't apply, which is a clearer signal than a bare throw.
        }
      },
      { key: LABS_KEY, flag: LAB_FLAG }
    );
  });

  test('exports a 3MF with body + lip materials', async ({ page }) => {
    await page.goto('/designer');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(3000);

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
    }
    await page.waitForTimeout(2000);

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

    // basematerials should declare both hex colors. Compare lower-case so
    // the test isn't sensitive to the exporter's case choice.
    expect(xml.toLowerCase()).toContain(BODY_HEX);
    expect(xml.toLowerCase()).toContain(LIP_HEX);
    expect(xml).toMatch(/<basematerials\b/);

    // Triangles carry pid/p1 multi-material attributes and span at least
    // two distinct p1 indices (body + lip).
    const triangleMatches = xml.match(/<triangle\b[^/]*p1="(\d+)"/g) ?? [];
    expect(triangleMatches.length).toBeGreaterThan(0);
    const distinctP1 = new Set(triangleMatches.map((m) => /p1="(\d+)"/.exec(m)?.[1]));
    expect(distinctP1.size).toBeGreaterThanOrEqual(2);
  });
});
