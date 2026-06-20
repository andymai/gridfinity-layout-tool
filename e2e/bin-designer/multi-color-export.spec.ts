/**
 * Pins the multi-color 3MF export contract end-to-end through the current
 * export dialog: faces tagged via `collectOrigins` (body + lip-grid cells)
 * must reach the final 3MF as distinct filament materials. Failure mode if
 * this regresses: `filament_colour` is missing a zone color, or every
 * `<triangle>` carries the same `paint_color` — i.e. one color for the bin.
 *
 * Exercises the lip color grid specifically: a single corner split into two Z
 * bands gives body + two distinct lip colors → three filaments.
 */

import { test, expect } from '../fixtures';
import { unzipSync, strFromU8 } from 'fflate';
import fs from 'node:fs';

const LABS_KEY = 'gridfinity-labs-v1';
const LAB_FLAG = 'multi_color_export';
const BODY_HEX = '#00aaff';
const BAND1_HEX = '#ff0066';
const BAND2_HEX = '#22cc44';

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

  test('exports a 3MF with body + two lip-band materials', async ({ page }) => {
    // The export runs the OCCT kernel and writes a 3MF; with the kernel warmup
    // and download waits this can't fit Playwright's 30s default.
    test.setTimeout(120_000);

    await page.goto('/designer');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 60000 });

    // The per-zone editors only render once the per-design multi-color toggle
    // is on (the lab flag merely reveals the section). Guard on aria-checked so
    // a future default-on UI doesn't get toggled back off.
    const enableMC = page.getByRole('switch', { name: /multi-color/i }).first();
    await enableMC.waitFor({ state: 'visible', timeout: 10000 });
    if ((await enableMC.getAttribute('aria-checked')) !== 'true') {
      await enableMC.click();
    }

    await setZoneColor(page, /^Body: /i, BODY_HEX);

    // Split the lip into two Z bands and color each distinctly.
    await page.getByRole('radiogroup', { name: 'Bands' }).getByRole('radio', { name: '2' }).click();
    await setZoneColor(page, /^Stacking Lip · Band 1: /i, BAND1_HEX);
    await setZoneColor(page, /^Stacking Lip · Band 2: /i, BAND2_HEX);

    // Open the export dialog. The trigger is `disabled` whenever the preview
    // mesh is mid-regeneration — and the preview regenerates continuously — so
    // it flickers and a normal click never settles as "stable". dispatchEvent
    // fires the React handler without Playwright's stability wait; poll until
    // the dialog's 3MF radio appears.
    const exportTrigger = page.getByRole('button', { name: 'Export bin as STL' });
    const threeMfRadio = page.getByRole('radio', { name: '3MF' });
    await expect
      .poll(
        async () => {
          if (await exportTrigger.isEnabled().catch(() => false)) {
            await exportTrigger.dispatchEvent('click').catch(() => {});
          }
          return threeMfRadio.isVisible().catch(() => false);
        },
        { timeout: 60_000, intervals: [300, 600, 1000] }
      )
      .toBe(true);

    const dialog = page.getByRole('dialog');

    // Multi-color auto-selects 3MF (STL/STEP drop color and are disabled), but
    // assert it explicitly so the rest of the flow is deterministic.
    await threeMfRadio.click();

    // The download button reads "Preparing engine…" until the kernel is warm,
    // then becomes "Download 3MF" — wait for that enabled state.
    const downloadButton = dialog.getByRole('button', { name: /download/i });
    await expect(downloadButton).toBeEnabled({ timeout: 90_000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
    await downloadButton.click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const buf = fs.readFileSync(downloadPath);
    const entries = unzipSync(new Uint8Array(buf));
    expect(entries['3D/3dmodel.model']).toBeDefined();
    const xml = strFromU8(entries['3D/3dmodel.model']);

    // The three zone colors must each surface as a filament. Lower-cased: the
    // exporter's hex case is not part of the contract.
    const config = JSON.parse(strFromU8(entries['Metadata/project_settings.config']));
    const filamentColours = (config.filament_colour as string[]).map((c) => c.toLowerCase());
    expect(filamentColours).toEqual(expect.arrayContaining([BODY_HEX, BAND1_HEX, BAND2_HEX]));

    expect(xml).toMatch(/<metadata name="Application">BambuStudio-/);
    const triangleMatches = xml.match(/<triangle\b[^/]*paint_color="([^"]+)"/g) ?? [];
    expect(triangleMatches.length).toBeGreaterThan(0);
    const distinctCodes = new Set(triangleMatches.map((m) => /paint_color="([^"]+)"/.exec(m)?.[1]));
    // Body + two lip bands paint distinctly (body may ride the base material,
    // so ≥2 painted codes proves the lip grid split into separate materials).
    expect(distinctCodes.size).toBeGreaterThanOrEqual(2);

    // Build item must carry a centering transform so the bin opens on the
    // plate, not at the bed corner (regression introduced when we claimed
    // BambuStudio identity flipped Orca's auto-arrange off — see
    // BAMBU_COMPAT_APPLICATION JSDoc in threemfExporter.ts).
    expect(xml).toMatch(/<item objectid="\d+" transform="1 0 0 0 1 0 0 0 1 [^"]+" \/>/);
  });
});

async function setZoneColor(
  page: import('@playwright/test').Page,
  namePattern: RegExp,
  hex: string
): Promise<void> {
  const trigger = page.getByRole('button', { name: namePattern });
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  const popover = page.locator('[role="dialog"]').last();
  await popover.getByRole('textbox').first().fill(hex);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  // The picker button's aria-label is `${label}: ${hex}` — waiting for it to
  // update is a deterministic signal the color landed in the store.
  await expect(page.getByRole('button', { name: new RegExp(`${hex}$`, 'i') })).toBeVisible({
    timeout: 5000,
  });
}
