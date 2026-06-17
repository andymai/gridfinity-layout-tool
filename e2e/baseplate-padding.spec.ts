import { test, expect, clearAllStorage, resetViewport, getActiveDialog } from './fixtures';

/**
 * Baseplate padding schematic tests.
 *
 * The `/baseplate` route is reachable directly (only the sidebar entry button
 * is labs-gated). The panel's "Padding" section shows a spatial schematic:
 * padding steppers arranged around a baseplate rectangle
 * (Back on top, Left/Right on sides, Front on bottom).
 */
test.describe('Baseplate Padding Schematic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/baseplate');
    // The padding schematic is plain React (no 3D kernel), so its inputs render
    // well before the WASM preview — gate on the Left padding input.
    await expect(page.getByRole('spinbutton', { name: 'Left', exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('padding schematic renders all four steppers', async ({ page }) => {
    // Side steppers (custom SideStepper): inputs with aria-label
    const leftInput = page.getByRole('spinbutton', { name: 'Left', exact: true });
    const rightInput = page.getByRole('spinbutton', { name: 'Right', exact: true });

    // Horizontal steppers (design system Stepper): inputs with aria-label
    const backInput = page.getByRole('spinbutton', { name: 'Back', exact: true });
    const frontInput = page.getByRole('spinbutton', { name: 'Front', exact: true });

    await expect(leftInput).toBeVisible({ timeout: 5000 });
    await expect(rightInput).toBeVisible({ timeout: 5000 });
    await expect(backInput).toBeVisible({ timeout: 5000 });
    await expect(frontInput).toBeVisible({ timeout: 5000 });
  });

  test('side stepper increment updates padding value', async ({ page }) => {
    const leftInput = page.getByLabel('Left', { exact: true });
    const incrementButton = page.getByLabel('Increase Left');

    // Buttons step by 0.25mm, so 4 clicks add 1mm.
    for (let i = 0; i < 4; i++) await incrementButton.click();

    await expect(leftInput).toHaveValue('1');
  });

  test('side stepper decrement reduces value', async ({ page }) => {
    const incrementButton = page.getByLabel('Increase Left');
    const decrementButton = page.getByLabel('Decrease Left');
    const leftInput = page.getByLabel('Left', { exact: true });

    // Increment 4 times → 1mm
    for (let i = 0; i < 4; i++) await incrementButton.click();
    await expect(leftInput).toHaveValue('1');

    // Decrement 2 times → 0.5mm (two 0.25mm steps)
    await decrementButton.click();
    await decrementButton.click();

    await expect(leftInput).toHaveValue('0.5');
  });

  test('horizontal stepper (Back/Front) updates value', async ({ page }) => {
    const backInput = page.getByRole('spinbutton', { name: 'Back', exact: true });

    // Focus, clear, type a value, and commit with Enter
    await backInput.click();
    await backInput.fill('10');
    await page.keyboard.press('Enter');

    await expect(backInput).toHaveValue('10');
  });

  test('side stepper input accepts typed values', async ({ page }) => {
    const leftInput = page.getByLabel('Left', { exact: true });

    // Focus, type a decimal value, and commit
    await leftInput.click();
    await leftInput.fill('5.5');
    await page.keyboard.press('Enter');

    await expect(leftInput).toHaveValue('5.5');
  });

  test('Escape cancels edit', async ({ page }) => {
    const leftInput = page.getByLabel('Left', { exact: true });

    // Verify initial value is 0
    await expect(leftInput).toHaveValue('0');

    // Focus and type a new value but cancel with Escape
    await leftInput.click();
    await leftInput.fill('99');
    await page.keyboard.press('Escape');

    // Original value should be restored
    await expect(leftInput).toHaveValue('0');
  });

  test('total dimensions update with padding', async ({ page }) => {
    // The click-to-edit dimensions readout shows "{w} × {d} mm" — grid-only with
    // no padding, grid+padding once padding is added.
    const dims = page.getByLabel('Edit baseplate dimensions');
    await expect(dims).toBeVisible({ timeout: 5000 });
    const readWidth = async (): Promise<number> =>
      parseInt(((await dims.textContent()) ?? '').match(/(\d+)\s*×/)?.[1] ?? '0', 10);
    const initialWidth = await readWidth();
    expect(initialWidth).toBeGreaterThan(0);

    // Type 5mm left + 5mm right padding (step-independent vs the 0.25mm buttons).
    const leftInput = page.getByLabel('Left', { exact: true });
    const rightInput = page.getByLabel('Right', { exact: true });
    await leftInput.click();
    await leftInput.fill('5');
    await page.keyboard.press('Enter');
    await rightInput.click();
    await rightInput.fill('5');
    await page.keyboard.press('Enter');

    // Width should increase by 10mm (5 left + 5 right)
    await expect(dims).toContainText(`${initialWidth + 10} ×`);
  });
});
