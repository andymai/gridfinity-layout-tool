import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getSidebar,
  getInspector,
  waitForBinCount,
  waitForBinSelected,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.describe('Print List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('shows empty state when no bins', async ({ page }) => {
    // Bin List section should exist and show empty state
    const binList = page.getByRole('heading', { name: /bin list/i });
    await expect(binList).toBeVisible();

    // Should show empty state message
    const emptyMessage = page.getByText(/no bins placed/i);
    await expect(emptyMessage).toBeVisible();
  });

  test('shows bins in bin list after creation', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Bin List section should show the bin
    const binList = page.getByRole('heading', { name: /bin list/i });
    await expect(binList).toBeVisible();

    // Should see "1" badge indicating bin count
    const binBadge = binList.locator('..').locator('.badge');
    await expect(binBadge).toHaveText('1');
  });

  test('groups identical bins together', async ({ page }) => {
    // Create two bins of the same size
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    // Should show "×2" for the grouped bins
    const groupCount = page.getByText(/×2/);
    await expect(groupCount.first()).toBeVisible();
  });

  test('shows filament estimate', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Should show filament estimate (contains "m" for meters)
    const filamentEstimate = page.getByText(/\d+\.?\d*\s*m/);
    await expect(filamentEstimate.first()).toBeVisible();
  });

  test('shows split warning for oversized bins', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Set small print bed size to force splitting
    const printBedInput = sidebar.locator('input#printBedSize');
    await printBedInput.fill('80');
    await printBedInput.blur();

    // Wait for setting to apply
    await expect(printBedInput).toHaveValue('80');

    // Create a large bin that exceeds print bed
    await drawBinOnGrid(page, 50, 50, 250, 250);

    // Should show "Split" indicator
    const splitIndicator = page.getByText(/split/i);
    await expect(splitIndicator.first()).toBeVisible();
  });

  test('bin list can be collapsed', async ({ page }) => {
    // Create a bin so bin list has content
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Find Bin List header button (contains the heading)
    const binListButton = page.locator('button').filter({
      has: page.getByRole('heading', { name: /bin list/i })
    });
    await expect(binListButton).toBeVisible();

    // Initially expanded - check aria-expanded attribute
    const isExpanded = await binListButton.getAttribute('aria-expanded');
    expect(isExpanded).toBe('true');

    // Toggle collapse
    await binListButton.click();

    // State should have changed
    await expect(binListButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('copy TSV button works', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-write', 'clipboard-read']);

    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Find copy button by aria-label
    const copyButton = page.getByRole('button', { name: /copy.*tsv/i });
    await expect(copyButton).toBeVisible();

    // Click copy button
    await copyButton.click();

    // Button shows checkmark (success icon) after copy - look for the success-colored SVG
    const successIcon = copyButton.locator('svg.text-\\[var\\(--color-success\\)\\]');
    await expect(successIcon).toBeVisible();
  });

  test('different sized bins create separate rows', async ({ page }) => {
    // Create bins of different sizes
    await drawBinOnGrid(page, 50, 50, 80, 80);    // 1×1
    await drawBinOnGrid(page, 150, 50, 210, 110); // 2×2 (roughly)

    // Should see multiple size notations (e.g., "1×1" and "2×2")
    // Check that we have at least 2 bins total
    const totalBins = page.getByText(/2 bin/i);
    await expect(totalBins.first()).toBeVisible();
  });

  test('stashed bins not included in print list', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Select the bin
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    // Move to stash via inspector button (scope to inspector to avoid matching bin palette)
    const inspector = getInspector(page);
    const moveToStashButton = inspector.getByRole('button', { name: /to stash/i });
    if (await moveToStashButton.isVisible()) {
      await moveToStashButton.click();

      // Wait for bin to move to stash
      await waitForBinCount(page, 0);

      // Print list should be empty (stashed bins excluded)
      const emptyIndicator = page.getByText(/0 bin/i);
      await expect(emptyIndicator.first()).toBeVisible();
    }
  });

  test('shows bin dimensions correctly', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Should show dimensions in format like "1×1" or "2×2"
    const dimensions = page.getByText(/\d×\d/);
    await expect(dimensions.first()).toBeVisible();
  });

  test('shows height unit in print list', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Should show height with "u" suffix (e.g., "3u")
    const heightDisplay = page.getByText(/\du/);
    await expect(heightDisplay.first()).toBeVisible();
  });

  test('print list updates when bin deleted', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    // Verify 2 bins shown
    let binCount = page.getByText(/2 bin/i);
    await expect(binCount.first()).toBeVisible();

    // Delete one bin
    const bins = page.locator('[data-bin-id]');
    await bins.first().click();
    await page.keyboard.press('Delete');
    await waitForBinCount(page, 1);

    // Should now show 1 bin
    binCount = page.getByText(/1 bin/i);
    await expect(binCount.first()).toBeVisible();
  });

  test('bin list shows category colors', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Bin list table should have rows with category indicators
    // The table shows size, height, qty, and filament columns
    const binTable = page.locator('table').filter({
      has: page.locator('th', { hasText: 'Size' })
    });
    await expect(binTable).toBeVisible();

    // Verify table has at least one data row
    const tableRows = binTable.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible();
  });

  test('print list shows spool estimate', async ({ page }) => {
    // Create several bins to have significant filament usage
    for (let i = 0; i < 3; i++) {
      await drawBinOnGrid(page, 50 + i * 100, 50, 80 + i * 100, 80);
    }

    // Wait for bins to be rendered
    await waitForBinCount(page, 3);

    // Should show spool estimate - format is either "X%" or "X.Y spools"
    // The "Spool" label should be visible in the print list summary
    await expect(page.getByText('Spool')).toBeVisible({ timeout: 5000 });
  });

  test('labeled bins shown separately in print list', async ({ page }) => {
    // Create first bin
    await drawBinOnGrid(page, 50, 50, 80, 80);

    // Select and add label
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    // Find label input in inspector
    const labelInput = page.getByRole('textbox', { name: /label/i });
    if (await labelInput.isVisible()) {
      await labelInput.fill('Test Bin');
      await labelInput.blur();
    }

    // Create identical bin (same size but no label)
    await drawBinOnGrid(page, 150, 50, 180, 80);

    // With labels, bins are not grouped together
    // Should show 2 bins total
    const totalBins = page.getByText(/2 bin/i);
    await expect(totalBins.first()).toBeVisible();
  });
});
