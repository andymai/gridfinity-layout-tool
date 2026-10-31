/**
 * E2E coverage for the "Stack for printing" baseplate feature — exercises the
 * real panel/preview flows that unit tests can't: split-dependent stacking,
 * dedup, the build-height cap, feature stripping + restore, and the preview
 * separation slider.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

test.use({
  launchOptions: { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] },
});

const GRID = 42; // mm per unit

async function setDimensions(page: Page, units: number): Promise<void> {
  await page.getByRole('button', { name: /Edit baseplate dimensions/i }).click();
  await page.getByRole('spinbutton', { name: /Baseplate width in mm/i }).fill(String(units * GRID));
  await page.getByRole('spinbutton', { name: /Baseplate depth in mm/i }).fill(String(units * GRID));
  await page.keyboard.press('Enter');
}

async function setBed(page: Page, mm: number): Promise<void> {
  await page.getByRole('spinbutton', { name: /Print bed width/i }).fill(String(mm));
  await page.keyboard.press('Enter');
}

async function setBuildHeight(page: Page, mm: number): Promise<void> {
  await page.getByRole('spinbutton', { name: /Build height/i }).fill(String(mm));
  await page.keyboard.press('Enter');
}

function stackSwitch(page: Page) {
  return page.getByRole('switch', { name: /vertical stack/i });
}

async function summaryText(page: Page): Promise<string> {
  return (
    (await page
      .getByText(/\d+ stacks? · \d+ plates?/i)
      .first()
      .textContent()) ?? ''
  );
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/baseplate');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
});

test('a single unsplit plate has nothing to stack', async ({ page }) => {
  await setDimensions(page, 2); // 84mm, fits any bed → unsplit, one plate
  await stackSwitch(page).click();
  await expect(page.getByText(/1 stack · 1 plate/i)).toBeVisible();
});

test('an evenly-tiled drawer dedupes into few tall stacks', async ({ page }) => {
  await setDimensions(page, 16); // sixteen identical 4×4 tiles on a 180mm bed
  await setBed(page, 180);
  await page.waitForTimeout(800);
  await stackSwitch(page).click();
  // Default 250mm build height fits all 16 in one tower.
  await expect(page.getByText(/1 stack · 16 plates/i)).toBeVisible();
});

test('an unevenly-tiled drawer does not fully consolidate', async ({ page }) => {
  await setDimensions(page, 14); // 4+4+3+3 → tiles of differing sizes
  await setBed(page, 180);
  await page.waitForTimeout(800);
  await stackSwitch(page).click();
  await expect(page.getByText(/\d+ stacks · 16 plates/i)).toBeVisible();
  // Different-size tiles can't all stack together → more than one stack
  // (contrast the even 16×16 case, which collapses to a single stack).
  const stacks = Number((await summaryText(page)).match(/(\d+) stacks/)?.[1]);
  expect(stacks).toBeGreaterThan(1);
});

test('mixed-size mode prints a whole uneven Eco Plate as one tower', async ({ page }) => {
  await setDimensions(page, 14);
  await setBed(page, 180);
  await page.waitForTimeout(800);
  await page.getByText('Eco plate', { exact: true }).click();
  await stackSwitch(page).click();
  await page.getByText('Mix tile sizes in stacks', { exact: true }).click();
  await expect(page.getByText(/16 plates stacked into 1 print file/i)).toBeVisible();
});

test('four distinct drawer parts with margins and connectors print once in one tower', async ({
  page,
}) => {
  await setDimensions(page, 8);
  await setBed(page, 180);
  for (const side of ['Left', 'Right', 'Front', 'Back']) {
    await page.getByRole('spinbutton', { name: side, exact: true }).fill('10');
    await page.keyboard.press('Enter');
  }
  await page.getByRole('radio', { name: /Dovetail/i }).click();
  await stackSwitch(page).click();
  await page.getByText('Mix tile sizes in stacks', { exact: true }).click();
  await expect(page.getByText(/4 plates stacked into 1 print file/i)).toBeVisible();
});

test('tiled Eco Plate margins still stack the different parts of a 523 by 325 mm drawer', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Edit baseplate dimensions/i }).click();
  await page.getByRole('spinbutton', { name: /Baseplate width in mm/i }).fill('504');
  await page.getByRole('spinbutton', { name: /Baseplate depth in mm/i }).fill('294');
  await page.keyboard.press('Enter');
  await setBed(page, 180);
  for (const [side, value] of [
    ['Left', '10'],
    ['Right', '9'],
    ['Back', '31'],
  ] as const) {
    await page.getByRole('spinbutton', { name: side, exact: true }).fill(value);
    await page.keyboard.press('Enter');
  }
  await page.getByRole('switch', { name: /Fill padding with grid tiles/i }).click();
  await page.getByText('Eco plate', { exact: true }).click();
  await page.getByRole('radio', { name: /Dovetail/i }).click();
  await stackSwitch(page).click();
  await page.getByText('Mix tile sizes in stacks', { exact: true }).click();
  await expect(page.getByText(/6 plates across 2 print files/i)).toBeVisible();
});

test('build height drives the per-stack cap', async ({ page }) => {
  await setDimensions(page, 16);
  await setBed(page, 180);
  await page.waitForTimeout(800);
  await stackSwitch(page).click();
  await expect(page.getByText(/1 stack · 16 plates/i)).toBeVisible();

  await setBuildHeight(page, 50); // ~9 tiles fit → 16 splits into 2 stacks
  await expect(page.getByText(/2 stacks · 16 plates/i)).toBeVisible();
});

test('stacking hides magnet + corner-radius controls and restores them on disable', async ({
  page,
}) => {
  await setDimensions(page, 2);

  // Turn magnets on, confirm the corner-radius slider is present.
  const magnet = page.getByRole('switch', { name: /magnet/i });
  await magnet.click();
  await expect(magnet).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Corner radius' })).toBeVisible();

  // Enable stacking → magnet + corner-radius controls vanish, notice appears.
  await stackSwitch(page).click();
  await expect(page.getByRole('switch', { name: /magnet/i })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Corner radius' })).toHaveCount(0);
  await expect(
    page.getByText(/Connectors, magnet holes, and corner rounding are turned off/i)
  ).toBeVisible();

  // Disable stacking → magnet toggle returns, still on (restored, not lost).
  await stackSwitch(page).click();
  const magnetAgain = page.getByRole('switch', { name: /magnet/i });
  await expect(magnetAgain).toBeVisible();
  await expect(magnetAgain).toBeChecked();
});

test('the preview separation slider appears only while stacking', async ({ page }) => {
  await setDimensions(page, 2);
  await expect(page.getByRole('slider', { name: /Separate the print stack/i })).toHaveCount(0);

  await stackSwitch(page).click();
  await expect(page.getByRole('slider', { name: /Separate the print stack/i })).toBeVisible();
});
