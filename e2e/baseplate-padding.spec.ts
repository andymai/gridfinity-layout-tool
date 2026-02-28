import {
  test,
  expect,
  waitForAppReady,
  getSidebar,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

/**
 * Baseplate padding schematic tests.
 *
 * The baseplate page is gated behind the `baseplate_generator` labs flag.
 * The panel shows an "Edge Padding" section with a spatial schematic:
 * padding steppers arranged around a baseplate rectangle
 * (Back on top, Left/Right on sides, Front on bottom).
 */
test.describe('Baseplate Padding Schematic', () => {
  test.beforeEach(async ({ page }) => {
    // Enable the baseplate_generator labs flag before navigation
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'gridfinity-labs-v1',
        JSON.stringify({
          enabledFeatures: { baseplate_generator: true },
          lastModified: new Date().toISOString(),
        })
      );
    });
    await page.reload();
    await waitForAppReady(page);

    // Scroll sidebar to bottom and click "Generate Baseplate"
    const sidebar = getSidebar(page);
    const baseplateButton = sidebar.getByRole('button', { name: /generate baseplate/i });
    await baseplateButton.scrollIntoViewIfNeeded();
    await baseplateButton.click();

    // Wait for baseplate page to load
    await expect(page.getByText('Edge Padding')).toBeVisible({ timeout: 5000 });
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
    const leftInput = page.getByRole('textbox', { name: 'Left', exact: true });
    const rightInput = page.getByRole('textbox', { name: 'Right', exact: true });

    // Horizontal steppers (design system Stepper): inputs with aria-label
    const backInput = page.getByRole('textbox', { name: 'Back', exact: true });
    const frontInput = page.getByRole('textbox', { name: 'Front', exact: true });

    await expect(leftInput).toBeVisible({ timeout: 5000 });
    await expect(rightInput).toBeVisible({ timeout: 5000 });
    await expect(backInput).toBeVisible({ timeout: 5000 });
    await expect(frontInput).toBeVisible({ timeout: 5000 });
  });

  test('side stepper increment updates padding value', async ({ page }) => {
    const leftInput = page.getByLabel('Left', { exact: true });
    const incrementButton = page.getByLabel('Left increment');

    // Click increment 3 times
    await incrementButton.click();
    await incrementButton.click();
    await incrementButton.click();

    await expect(leftInput).toHaveValue('3');
  });

  test('side stepper decrement reduces value', async ({ page }) => {
    const incrementButton = page.getByLabel('Left increment');
    const decrementButton = page.getByLabel('Left decrement');
    const leftInput = page.getByLabel('Left', { exact: true });

    // Increment 5 times
    for (let i = 0; i < 5; i++) {
      await incrementButton.click();
    }
    await expect(leftInput).toHaveValue('5');

    // Decrement 2 times
    await decrementButton.click();
    await decrementButton.click();

    await expect(leftInput).toHaveValue('3');
  });

  test('horizontal stepper (Back/Front) updates value', async ({ page }) => {
    const backInput = page.getByRole('textbox', { name: 'Back', exact: true });

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
    // Scope to the schematic's total text (the <p> inside the Edge Padding section)
    const paddingSection = page.getByLabel('Edge Padding');
    const schematicTotal = paddingSection.locator('p').filter({ hasText: /Total:/ });

    // Read initial total width from the schematic caption
    await expect(schematicTotal).toBeVisible({ timeout: 5000 });
    const initialText = await schematicTotal.textContent();
    const initialWidth = parseInt(initialText?.match(/Total:\s*(\d+)/)?.[1] ?? '0', 10);

    // Add 5mm left + 5mm right padding via increment buttons
    const leftIncrement = page.getByLabel('Left increment');
    const rightIncrement = page.getByLabel('Right increment');
    for (let i = 0; i < 5; i++) await leftIncrement.click();
    for (let i = 0; i < 5; i++) await rightIncrement.click();

    // Width should increase by 10mm (5 left + 5 right)
    const expectedWidth = initialWidth + 10;
    await expect(schematicTotal).toContainText(String(expectedWidth));
  });
});
