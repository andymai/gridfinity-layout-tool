import { test, expect } from '@playwright/test';

test.describe('Print Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await expect(page.locator('text=Gridfinity Layout Tool')).toBeVisible();
  });

  test('print button exists in header', async ({ page }) => {
    // Find the print button
    const printButton = page.locator('button[aria-label="Print layout"]');
    await expect(printButton).toBeVisible();
  });

  test('clicking print button opens modal', async ({ page }) => {
    // Find and click the print button
    const printButton = page.locator('button[aria-label="Print layout"]');
    await expect(printButton).toBeVisible();

    // Click the button
    await printButton.click();

    // Wait for modal to appear
    const modalTitle = page.locator('text=Print Layout');
    await expect(modalTitle).toBeVisible();
  });

  test('print modal has settings panel', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Check for settings elements (use heading role to be specific)
    await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible();
    await expect(page.locator('text=Include in Print')).toBeVisible();
    await expect(page.locator('label:has-text("Labels")')).toBeVisible();
    await expect(page.locator('label:has-text("Category Colors")')).toBeVisible();
  });

  test('print modal has preview panel', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Check for preview content
    const preview = page.locator('.print-preview');
    await expect(preview).toBeVisible();
  });

  test('print modal can be closed with cancel button', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Click cancel
    await page.locator('button:has-text("Cancel")').click();

    // Modal should be gone
    await expect(page.locator('h2:has-text("Print Layout")')).not.toBeVisible();
  });

  test('print modal can be closed with escape key', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Press escape
    await page.keyboard.press('Escape');

    // Modal should be gone
    await expect(page.locator('h2:has-text("Print Layout")')).not.toBeVisible();
  });

  test('print modal can be closed by clicking overlay', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Click on the overlay (outside the modal content)
    await page.locator('.print-modal-overlay').click({ position: { x: 10, y: 10 } });

    // Modal should be gone
    await expect(page.locator('h2:has-text("Print Layout")')).not.toBeVisible();
  });

  test('layer checkboxes can be toggled', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Find layer checkbox (Layer 1 should exist by default)
    const layerCheckbox = page.locator('label:has-text("Layer 1") input[type="checkbox"]');

    // Should be checked by default
    await expect(layerCheckbox).toBeChecked();

    // Uncheck it
    await layerCheckbox.click();
    await expect(layerCheckbox).not.toBeChecked();

    // Check it again
    await layerCheckbox.click();
    await expect(layerCheckbox).toBeChecked();
  });

  test('display option checkboxes work', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Find "Size (WxD)" checkbox and toggle it
    const showSizeLabel = page.locator('label:has-text("Size (WxD)")');
    const showSizeCheckbox = showSizeLabel.locator('input[type="checkbox"]');

    // Toggle the checkbox
    const wasChecked = await showSizeCheckbox.isChecked();
    await showSizeCheckbox.click();

    // Verify it changed
    if (wasChecked) {
      await expect(showSizeCheckbox).not.toBeChecked();
    } else {
      await expect(showSizeCheckbox).toBeChecked();
    }
  });

  test('print portal exists in DOM', async ({ page }) => {
    // Check that print portal is rendered
    const printPortal = page.locator('.print-portal');
    await expect(printPortal).toBeAttached();

    // It should be hidden on screen
    await expect(printPortal).toHaveClass(/hidden/);
  });

  test('bin list checkbox exists in modal', async ({ page }) => {
    // Open the modal
    const printButton = page.locator('button[aria-label="Print layout"]');
    await printButton.click();

    // Wait for modal
    await expect(page.locator('h2:has-text("Print Layout")')).toBeVisible();

    // Check that bin list checkbox exists and is checked by default
    const binListCheckbox = page.locator('label:has-text("Bin Details Table") input[type="checkbox"]');
    await expect(binListCheckbox).toBeVisible();
    await expect(binListCheckbox).toBeChecked();

    // Toggle it off
    await binListCheckbox.click();
    await expect(binListCheckbox).not.toBeChecked();

    // Toggle it back on
    await binListCheckbox.click();
    await expect(binListCheckbox).toBeChecked();
  });
});
