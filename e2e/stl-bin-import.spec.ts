/**
 * E2E for the STL bin import feature (stl_bin_import labs flag):
 * import a whole-bin STL as an `importedMesh` design, verify grid-footprint
 * detection and the designer panel, then link the design to a matching
 * layout bin through the Link Existing dialog.
 *
 * The fixture is a generated watertight binary STL box of 41.5×41.5×14mm —
 * the exact outer size of a lipless 1×1×2U Gridfinity bin — so detection
 * must read 1×1×2 with no off-grid warning.
 */

import type { Page } from '@playwright/test';
import { test, expect, drawBinOnGrid, waitForAppReady } from './fixtures';

const LABS_KEY = 'gridfinity-labs-v1';
const LAB_FLAG = 'stl_bin_import';

const BOX_W = 41.5;
const BOX_D = 41.5;
const BOX_H = 14;

/** Build a watertight binary STL box (12 triangles, outward CCW winding). */
function binarySTLBox(w: number, d: number, h: number): Buffer {
  const v = [
    [0, 0, 0],
    [w, 0, 0],
    [w, d, 0],
    [0, d, 0],
    [0, 0, h],
    [w, 0, h],
    [w, d, h],
    [0, d, h],
  ] as const;
  const tris: ReadonlyArray<readonly [number, number, number]> = [
    // bottom (-z)
    [0, 2, 1],
    [0, 3, 2],
    // top (+z)
    [4, 5, 6],
    [4, 6, 7],
    // front (-y)
    [0, 1, 5],
    [0, 5, 4],
    // back (+y)
    [2, 3, 7],
    [2, 7, 6],
    // left (-x)
    [0, 4, 7],
    [0, 7, 3],
    // right (+x)
    [1, 2, 6],
    [1, 6, 5],
  ];
  const buffer = Buffer.alloc(84 + tris.length * 50);
  buffer.write('e2e stl bin import fixture', 0, 'ascii');
  buffer.writeUInt32LE(tris.length, 80);
  let offset = 84;
  for (const [a, b, c] of tris) {
    // Normals are zero — the import pipeline recomputes them.
    offset += 12;
    for (const idx of [a, b, c]) {
      buffer.writeFloatLE(v[idx][0], offset);
      buffer.writeFloatLE(v[idx][1], offset + 4);
      buffer.writeFloatLE(v[idx][2], offset + 8);
      offset += 12;
    }
    offset += 2; // attribute byte count
  }
  return buffer;
}

/** Drive the import flow up to the confirmation dialog. */
async function importFixtureStl(page: Page): Promise<void> {
  await page.goto('/designer');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 });

  await page.getByRole('button', { name: 'Open design list' }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  const fileInput = page.locator('input[type="file"][accept=".json,.stl"]');
  await fileInput.setInputFiles({
    name: 'e2e_import_bin.stl',
    mimeType: 'model/stl',
    buffer: binarySTLBox(BOX_W, BOX_D, BOX_H),
  });

  // The worker parses/repairs/decimates (loads manifold WASM on first use).
  await expect(page.getByText('Import STL as bin')).toBeVisible({ timeout: 60000 });
}

test.describe('STL bin import', () => {
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
          /* assertions below fail loudly if labs init breaks */
        }
      },
      { key: LABS_KEY, flag: LAB_FLAG }
    );
  });

  test('imports an STL as a bin design with detected footprint', async ({ page }) => {
    test.setTimeout(120000);
    await importFixtureStl(page);

    // Mesh stats + auto-detected grid claim (1×1 footprint, 2U lipless).
    await expect(
      page.getByText(`${BOX_W.toFixed(1)} × ${BOX_D.toFixed(1)} × 14.0 mm`)
    ).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Width (units)' })).toHaveValue('1');
    await expect(page.getByRole('spinbutton', { name: 'Depth (units)' })).toHaveValue('1');
    await expect(page.getByRole('spinbutton', { name: 'Height (units)' })).toHaveValue('2');
    // On-grid fixture → no off-grid warning.
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByRole('button', { name: 'Import as bin design' }).click();

    // Saved + loaded into the designer: read-mostly imported panel with
    // STL/3MF export, no STEP.
    await expect(page.getByText('Imported "e2e_import_bin" as a bin design')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: 'Export STL' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '3MF' })).toBeVisible();
    await expect(page.getByRole('button', { name: /STEP/ })).toHaveCount(0);
    await expect(page.getByText('Imported from e2e_import_bin.stl')).toBeVisible();
  });

  test('links the imported design to a matching layout bin', async ({ page }) => {
    // The link flow drives the desktop inspector (Link button, drawn bin
    // selection); mobile/tablet trees surface linking differently.
    const viewport = page.viewportSize();
    test.skip((viewport?.width ?? 0) < 900, 'desktop-only inspector flow');
    test.setTimeout(120000);
    await importFixtureStl(page);
    await page.getByRole('button', { name: 'Import as bin design' }).click();
    await expect(page.getByRole('button', { name: 'Export STL' })).toBeVisible({ timeout: 15000 });

    // Back to the layout planner; draw a 1×1 bin (small drag inside one cell).
    await page.goto('/');
    await waitForAppReady(page);
    const bin = await drawBinOnGrid(page, 30, 30, 40, 40);
    await expect(bin).toHaveAttribute('aria-pressed', 'true');

    // Link Existing → the imported design must be offered for the 1×1 footprint.
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    await expect(page.getByText('Link Existing Design')).toBeVisible({ timeout: 10000 });
    const option = page.getByRole('button', { name: /e2e_import_bin/ });
    await expect(option).toBeVisible();
    // Kind badge distinguishes imported designs from parametric bins.
    await expect(option.getByText('Imported bin')).toBeVisible();

    await option.click();

    // Linked: dialog closes, inspector shows the linked design.
    await expect(page.getByText('Link Existing Design')).toHaveCount(0);
    await expect(page.getByText(/e2e_import_bin/).first()).toBeVisible({ timeout: 10000 });
  });
});
