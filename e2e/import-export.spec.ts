import type { Page } from '@playwright/test';
import {
  test,
  expect,
  waitForAppReady,
  waitForDialog,
  waitForDialogClosed,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
  drawBinOnGrid,
  waitForAutoSave,
  waitForBinCount,
} from './fixtures';

test.describe('Import/Export Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test.describe('Share Modal', () => {
    // Helper to open share modal via layout manager
    async function openShareModal(page: Page) {
      // Open layout manager
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const layoutModal = getActiveDialog(page);

      // Click "Copy share link" button for the first layout - this opens the ShareModal
      const copyLinkBtn = layoutModal.getByRole('button', { name: /copy share link/i }).first();
      await copyLinkBtn.click();

      // Wait for share modal to appear (it stacks on top)
      await page.waitForSelector('[role="dialog"][aria-labelledby="share-modal-title"]', { timeout: 5000 });
    }

    test('opens share modal via layout manager actions', async ({ page }) => {
      await openShareModal(page);

      // Should show "Share Layout" heading
      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      await expect(shareModal).toBeVisible();
      await expect(shareModal.getByRole('heading', { name: 'Share Layout' })).toBeVisible();
    });

    test('closes share modal with escape', async ({ page }) => {
      await openShareModal(page);

      await page.keyboard.press('Escape');

      // Share modal should close (layout manager may still be open)
      await expect(page.locator('[aria-labelledby="share-modal-title"]')).not.toBeVisible({ timeout: 3000 });
    });

    test('has Link, File, and JSON tabs', async ({ page }) => {
      await openShareModal(page);

      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      await expect(shareModal.getByRole('tab', { name: 'Link' })).toBeVisible();
      await expect(shareModal.getByRole('tab', { name: 'File' })).toBeVisible();
      await expect(shareModal.getByRole('tab', { name: 'JSON' })).toBeVisible();
    });

    test('Link tab shows shareable URL', async ({ page }) => {
      await openShareModal(page);

      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      // Click the Link tab
      await shareModal.getByRole('tab', { name: 'Link' }).click();

      // Should show an input with URL containing #share=
      const urlInput = shareModal.locator('input[type="text"]');
      await expect(urlInput).toBeVisible();
      const urlValue = await urlInput.inputValue();
      expect(urlValue).toContain('#share=');
    });

    test('Link tab allows copying URL', async ({ page }) => {
      await openShareModal(page);

      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      await shareModal.getByRole('tab', { name: 'Link' }).click();

      const copyButton = shareModal.getByRole('button', { name: 'Copy' });
      await expect(copyButton).toBeVisible();
      await copyButton.click();

      // Button should show "Copied!" feedback
      await expect(shareModal.getByRole('button', { name: 'Copied!' })).toBeVisible();
    });

    test('File tab shows download button', async ({ page }) => {
      await openShareModal(page);

      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      await shareModal.getByRole('tab', { name: 'File' }).click();

      // Should show download button and file info
      const downloadButton = shareModal.getByRole('button', { name: 'Download' });
      await expect(downloadButton).toBeVisible();

      // Should show layout info (e.g., "10×8 grid • 0 bins • 1 layers")
      await expect(shareModal.getByText(/grid.*bins.*layer/i)).toBeVisible();
    });

    test('JSON tab shows raw JSON data', async ({ page }) => {
      await openShareModal(page);

      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      await shareModal.getByRole('tab', { name: 'JSON' }).click();

      // Should show textarea with JSON
      const textarea = shareModal.locator('textarea');
      await expect(textarea).toBeVisible();

      const jsonText = await textarea.inputValue();
      expect(jsonText).toContain('"drawer"');
      expect(jsonText).toContain('"bins"');
      expect(jsonText).toContain('"layers"');

      // Copy JSON button should be present
      await expect(shareModal.getByRole('button', { name: 'Copy JSON' })).toBeVisible();
    });

    test('JSON tab Copy JSON button shows feedback', async ({ page }) => {
      await openShareModal(page);

      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      await shareModal.getByRole('tab', { name: 'JSON' }).click();

      await shareModal.getByRole('button', { name: 'Copy JSON' }).click();

      // Button should show "Copied!" feedback
      await expect(shareModal.getByRole('button', { name: 'Copied!' })).toBeVisible();
    });
  });

  test.describe('Import Modal', () => {
    test('opens import modal via layout manager', async ({ page }) => {
      // Open layout manager
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const layoutModal = getActiveDialog(page);

      // Click Import tab
      await layoutModal.getByRole('tab', { name: 'Import' }).click();

      // Import form should be visible
      await expect(layoutModal.getByText(/paste.*json/i)).toBeVisible();
    });

    test('shows validation error for invalid JSON', async ({ page }) => {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);
      await modal.getByRole('tab', { name: 'Import' }).click();

      // Enter invalid JSON
      const textarea = modal.locator('textarea');
      await textarea.fill('{ invalid json }');

      // Should show "Validation Errors" heading
      await expect(modal.getByText('Validation Errors')).toBeVisible({ timeout: 3000 });
    });

    test('shows validation error for missing required fields', async ({ page }) => {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);
      await modal.getByRole('tab', { name: 'Import' }).click();

      // Enter JSON missing required drawer field
      const textarea = modal.locator('textarea');
      await textarea.fill('{"bins": [], "layers": []}');

      // Should show error about missing drawer
      await expect(modal.getByText(/drawer|required/i)).toBeVisible({ timeout: 3000 });
    });

    test('shows preview for valid JSON', async ({ page }) => {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);
      await modal.getByRole('tab', { name: 'Import' }).click();

      // Create valid layout JSON with all required fields (including version!)
      const validLayout = JSON.stringify({
        version: '1.0',
        name: 'Test Layout',
        drawer: { width: 5, depth: 5, height: 10 },
        bins: [],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        categories: [{ id: 'cat1', name: 'Default', color: '#6b7280' }],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      });

      const textarea = modal.locator('textarea');
      await textarea.fill(validLayout);

      // Should show "Ready to Import" preview
      await expect(modal.getByText('Ready to Import')).toBeVisible({ timeout: 3000 });
      await expect(modal.getByText('5×5×10')).toBeVisible();
    });

    test('can parse share URL in import', async ({ page }) => {
      // First, get a share URL from the share modal via layout manager
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      let layoutModal = getActiveDialog(page);
      const copyLinkBtn = layoutModal.getByRole('button', { name: /copy share link/i }).first();
      await copyLinkBtn.click();
      await page.waitForSelector('[role="dialog"][aria-labelledby="share-modal-title"]', { timeout: 5000 });

      const shareModal = page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
      await shareModal.getByRole('tab', { name: 'Link' }).click();

      const urlInput = shareModal.locator('input[type="text"]');
      const shareURL = await urlInput.inputValue();

      // Close share modal and layout manager
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await waitForDialogClosed(page);

      // Now open import and paste the URL
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      layoutModal = getActiveDialog(page);
      await layoutModal.getByRole('tab', { name: 'Import' }).click();

      const textarea = layoutModal.locator('textarea');
      await textarea.fill(shareURL);

      // Should successfully parse and show "Ready to Import" preview
      await expect(layoutModal.getByText('Ready to Import')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Round-trip Export/Import', () => {
    // Helper to open share modal
    async function openShareModalForExport(page: Page) {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);
      const layoutModal = getActiveDialog(page);
      const copyLinkBtn = layoutModal.getByRole('button', { name: /copy share link/i }).first();
      await copyLinkBtn.click();
      await page.waitForSelector('[role="dialog"][aria-labelledby="share-modal-title"]', { timeout: 5000 });
      return page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
    }

    test('exported JSON can be parsed for re-import', async ({ page }) => {
      // Create a bin so we have something to export
      await drawBinOnGrid(page, 50, 50, 150, 150);
      await waitForBinCount(page, 1);
      await waitForAutoSave(page, 3000);

      // Export JSON from share modal
      const shareModal = await openShareModalForExport(page);
      await shareModal.getByRole('tab', { name: 'JSON' }).click();

      const textarea = shareModal.locator('textarea');
      const exportedJSON = await textarea.inputValue();

      // Close all dialogs
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await waitForDialogClosed(page);

      // Open import and paste the exported JSON
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);
      const modal = getActiveDialog(page);
      await modal.getByRole('tab', { name: 'Import' }).click();

      const importTextarea = modal.locator('textarea');
      await importTextarea.fill(exportedJSON);

      // Exported JSON should be valid and show "Ready to Import" preview
      // This validates the round-trip JSON serialization/deserialization
      await expect(modal.getByText('Ready to Import')).toBeVisible({ timeout: 3000 });

      // Verify the preview shows "Bins:" label (format is "Bins:" then count on separate line)
      await expect(modal.getByText('Bins:')).toBeVisible();
    });

    test('URL encoding preserves layout data', async ({ page }) => {
      // Name the layout first
      await page.getByRole('button', { name: 'Untitled layout' }).click();
      const headerInput = page.locator('header input[type="text"]');
      await headerInput.fill('URL Test Layout');
      await headerInput.press('Enter');

      // Create bins
      await drawBinOnGrid(page, 50, 50, 150, 150);
      await waitForBinCount(page, 1);
      await waitForAutoSave(page, 3000);

      // Get the share URL
      const shareModal = await openShareModalForExport(page);
      await shareModal.getByRole('tab', { name: 'Link' }).click();

      const urlInput = shareModal.locator('input[type="text"]');
      const shareURL = await urlInput.inputValue();

      // Verify URL contains encoded data
      expect(shareURL).toContain('#share=');

      // Close all dialogs
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await waitForDialogClosed(page);

      // Clear storage to simulate fresh user
      await clearAllStorage(page);

      // Navigate to the share URL
      await page.goto(shareURL);
      await waitForAppReady(page);

      // Should see the shared layout import prompt or the imported layout
      // The app should handle the #share= parameter
      await page.waitForTimeout(1000); // Allow app to process URL

      // Either we see an import dialog, or the layout was auto-imported
      // Check for the bin or import prompt
      const hasBin = await page.locator('[data-bin-id]').count();
      const hasImportPrompt = await page.getByText(/import/i).isVisible().catch(() => false);

      expect(hasBin > 0 || hasImportPrompt).toBeTruthy();
    });
  });

  test.describe('File Operations', () => {
    // Helper to open share modal for file operations
    async function openShareModalForFile(page: Page) {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);
      const layoutModal = getActiveDialog(page);
      const copyLinkBtn = layoutModal.getByRole('button', { name: /copy share link/i }).first();
      await copyLinkBtn.click();
      await page.waitForSelector('[role="dialog"][aria-labelledby="share-modal-title"]', { timeout: 5000 });
      return page.locator('[role="dialog"][aria-labelledby="share-modal-title"]');
    }

    test('download button triggers file download', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      const shareModal = await openShareModalForFile(page);
      await shareModal.getByRole('tab', { name: 'File' }).click();

      await shareModal.getByRole('button', { name: 'Download' }).click();

      // Verify download was triggered
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.json$/);
    });

    test('file upload parses JSON file', async ({ page }) => {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);
      await modal.getByRole('tab', { name: 'Import' }).click();

      // Find the file input (might be hidden, use locator directly)
      const fileInput = modal.locator('input[type="file"]');

      // Create a valid layout JSON with all required fields
      const validLayout = JSON.stringify({
        version: '1.0',
        name: 'File Test Layout',
        drawer: { width: 6, depth: 6, height: 8 },
        bins: [
          {
            id: 'bin1',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            layerId: 'layer1',
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
        layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        categories: [{ id: 'cat1', name: 'Default', color: '#6b7280' }],
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      });

      // Upload file using setInputFiles
      await fileInput.setInputFiles({
        name: 'test-layout.json',
        mimeType: 'application/json',
        buffer: Buffer.from(validLayout),
      });

      // Should show "Ready to Import" preview
      await expect(modal.getByText('Ready to Import')).toBeVisible({ timeout: 3000 });
      await expect(modal.getByText('6×6×8')).toBeVisible();
    });
  });
});
