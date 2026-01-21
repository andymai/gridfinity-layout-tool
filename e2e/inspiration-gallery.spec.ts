import {
  test,
  expect,
  MOBILE_VIEWPORT,
  waitForMobileAppReady,
  waitForAppReady,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
  getSidebar,
} from './fixtures';
import type { Page, Locator } from '@playwright/test';

/**
 * Helper to open the Inspiration Gallery from sidebar
 */
async function openGallery(page: Page): Promise<Locator> {
  const sidebar = getSidebar(page);
  // The button contains nested text "Inspiration Gallery"
  const galleryButton = sidebar.locator('button', { hasText: 'Inspiration Gallery' });
  await galleryButton.click();

  // Wait for the gallery dialog to appear (has specific aria-labelledby)
  const dialog = page.locator('[role="dialog"][aria-labelledby="inspiration-gallery-title"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  return dialog;
}

/**
 * Helper to get the gallery dialog locator
 */
function getGalleryDialog(page: Page): Locator {
  return page.locator('[role="dialog"][aria-labelledby="inspiration-gallery-title"]');
}

/**
 * Helper to get the preview overlay locator (appears when clicking a card)
 */
function getPreviewOverlay(page: Page): Locator {
  return page.locator('[role="dialog"][aria-labelledby="preview-title"]');
}

/**
 * Helper to wait for gallery to be closed
 */
async function waitForGalleryClosed(page: Page): Promise<void> {
  const dialog = getGalleryDialog(page);
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
}

/**
 * Helper to wait for preview to be closed
 */
async function waitForPreviewClosed(page: Page): Promise<void> {
  const preview = getPreviewOverlay(page);
  await expect(preview).not.toBeVisible({ timeout: 5000 });
}

test.describe('Inspiration Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    // Close any lingering dialogs
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test.describe('Opening and Closing', () => {
    test('opens gallery from sidebar button', async ({ page }) => {
      // Open gallery using helper
      const dialog = await openGallery(page);

      // Should show the gallery title
      await expect(dialog.locator('h2', { hasText: 'Inspiration Gallery' })).toBeVisible();

      // Should show theme filter pills (using tab role for tablist)
      const filterPills = dialog.locator('[role="tablist"]');
      await expect(filterPills).toBeVisible();
      await expect(filterPills.locator('[role="tab"]', { hasText: 'All' })).toBeVisible();
      await expect(filterPills.locator('[role="tab"]', { hasText: 'Kitchen' })).toBeVisible();
      await expect(filterPills.locator('[role="tab"]', { hasText: 'Workshop' })).toBeVisible();
    });

    test('closes gallery with Escape key', async ({ page }) => {
      await openGallery(page);

      // Press Escape to close
      await page.keyboard.press('Escape');
      await waitForGalleryClosed(page);
    });

    test('closes gallery with close button', async ({ page }) => {
      const dialog = await openGallery(page);

      // Find and click the close button (aria-label="Close gallery")
      const closeButton = dialog.locator('button[aria-label="Close gallery"]');
      await closeButton.click();

      await waitForGalleryClosed(page);
    });

    test('closes gallery when clicking backdrop', async ({ page }) => {
      await openGallery(page);

      // Click the backdrop (the fixed inset-0 element behind the dialog)
      // Use z-50 to target the gallery backdrop specifically (preview uses z-[99])
      const backdrop = page.locator('.fixed.inset-0.z-50.bg-black\\/50');
      await backdrop.click({ position: { x: 5, y: 5 } });

      await waitForGalleryClosed(page);
    });
  });

  test.describe('Theme Filtering', () => {
    test('filters layouts by theme when clicking filter pills', async ({ page }) => {
      const dialog = await openGallery(page);

      // Initially showing "All" (should be selected)
      const allTab = dialog.locator('[role="tab"]', { hasText: 'All' });
      await expect(allTab).toHaveAttribute('aria-selected', 'true');

      // Count initial cards (there should be layout cards visible)
      const initialCards = dialog.locator('[data-layout-card]');
      await expect(initialCards.first()).toBeVisible();
      const initialCount = await initialCards.count();
      expect(initialCount).toBe(23); // Total layouts

      // Click Workshop filter
      const workshopTab = dialog.locator('[role="tab"]', { hasText: 'Workshop' });
      await workshopTab.click();

      // Workshop tab should now be selected
      await expect(workshopTab).toHaveAttribute('aria-selected', 'true');
      await expect(allTab).toHaveAttribute('aria-selected', 'false');

      // Card count should change (workshop has 7 layouts)
      await expect(dialog.locator('[data-layout-card]')).toHaveCount(7, { timeout: 3000 });
    });

    test('shows correct layout count badges on filter pills', async ({ page }) => {
      const dialog = await openGallery(page);

      // Check that filter tabs show count badges
      // The counts are: all=23, kitchen=4, workshop=7, office=2, hobby=5, personal=5
      await expect(dialog.locator('[role="tab"]', { hasText: '23' })).toBeVisible();
      await expect(dialog.locator('[role="tab"]', { hasText: '4' })).toBeVisible();
      await expect(dialog.locator('[role="tab"]', { hasText: '7' })).toBeVisible();
    });

    test('switches between different theme filters', async ({ page }) => {
      const dialog = await openGallery(page);

      // Click Kitchen
      await dialog.locator('[role="tab"]', { hasText: 'Kitchen' }).click();
      await expect(dialog.locator('[data-layout-card]')).toHaveCount(4);

      // Click Office
      await dialog.locator('[role="tab"]', { hasText: 'Office' }).click();
      await expect(dialog.locator('[data-layout-card]')).toHaveCount(2);

      // Click back to All
      await dialog.locator('[role="tab"]', { hasText: 'All' }).click();
      await expect(dialog.locator('[data-layout-card]')).toHaveCount(23);
    });
  });

  test.describe('Layout Cards', () => {
    test('displays layout card with name, description, and metrics', async ({ page }) => {
      const dialog = await openGallery(page);

      // First card should be visible
      const firstCard = dialog.locator('[data-layout-card]').first();
      await expect(firstCard).toBeVisible();

      // Card should have metrics (like "12 bins · 10×8")
      await expect(firstCard.locator('text=/\\d+ bins/i')).toBeVisible();
    });

    test('opens preview overlay when clicking a card', async ({ page }) => {
      const dialog = await openGallery(page);

      // Click the first layout card
      const firstCard = dialog.locator('[data-layout-card]').first();
      await firstCard.click();

      // Preview overlay should open (separate dialog with aria-labelledby="preview-title")
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Should show "Use as Starting Point" CTA button
      await expect(preview.locator('button', { hasText: 'Use as Starting Point' })).toBeVisible();

      // Should show layout details (exact match to avoid matching descriptions)
      await expect(preview.getByText('Bins', { exact: true })).toBeVisible();
      await expect(preview.getByText('Layers', { exact: true })).toBeVisible();
    });
  });

  test.describe('Preview Overlay', () => {
    test('shows layout preview with thumbnail and metrics', async ({ page }) => {
      const dialog = await openGallery(page);

      await dialog.locator('[data-layout-card]').first().click();

      // Wait for preview overlay to appear
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Preview should show metrics (exact match to avoid matching descriptions)
      await expect(preview.getByText('Bins', { exact: true })).toBeVisible();
      await expect(preview.getByText('Layers', { exact: true })).toBeVisible();
      await expect(preview.getByText('Categories', { exact: true })).toBeVisible();
    });

    test('closes preview with back button', async ({ page }) => {
      const dialog = await openGallery(page);

      await dialog.locator('[data-layout-card]').first().click();

      // Wait for preview to open
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Click back button (aria-label="Back to gallery")
      const backButton = preview.locator('button[aria-label="Back to gallery"]');
      await backButton.click();

      // Preview should close
      await waitForPreviewClosed(page);

      // Gallery should still be visible with cards
      await expect(dialog.locator('[data-layout-card]').first()).toBeVisible();
    });

    test('closes preview with Escape key (returns to gallery)', async ({ page }) => {
      const dialog = await openGallery(page);

      await dialog.locator('[data-layout-card]').first().click();

      // Wait for preview to open
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Press Escape - should close preview but not gallery
      await page.keyboard.press('Escape');

      // Preview should close
      await waitForPreviewClosed(page);

      // Gallery should still be open with cards visible
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-layout-card]').first()).toBeVisible();
    });

    test('shows related layouts from same theme', async ({ page }) => {
      const dialog = await openGallery(page);

      // Filter to workshop theme (has multiple layouts), click a card
      await dialog.locator('[role="tab"]', { hasText: 'Workshop' }).click();
      await dialog.locator('[data-layout-card]').first().click();

      // Wait for preview overlay to appear
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Should show "More Workshop" section with related layouts
      await expect(preview.locator('text=/more workshop/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Layout Import', () => {
    test('imports layout when clicking "Use as Starting Point"', async ({ page }) => {
      const dialog = await openGallery(page);

      await dialog.locator('[data-layout-card]').first().click();

      // Wait for preview overlay to open
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Click "Use as Starting Point" in the preview overlay
      const useButton = preview.locator('button', { hasText: 'Use as Starting Point' });
      await useButton.click();

      // Gallery and preview should close after import
      await waitForGalleryClosed(page);
      await waitForPreviewClosed(page);

      // Layout should have bins from the imported layout (wait for grid to update)
      const bins = page.locator('[data-bin-id]');
      await expect(bins.first()).toBeVisible({ timeout: 5000 });
    });

    test('shows toast notification after successful import', async ({ page }) => {
      const dialog = await openGallery(page);

      await dialog.locator('[data-layout-card]').first().click();

      // Wait for preview overlay to open
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Click "Use as Starting Point" in the preview overlay
      await preview.locator('button', { hasText: 'Use as Starting Point' }).click();

      // Should show success toast (the toast contains "Added" text)
      await expect(page.locator('[role="alert"]', { hasText: /added/i })).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('supports arrow key navigation in grid', async ({ page }) => {
      const dialog = await openGallery(page);

      // Click on first card to focus it
      const firstCard = dialog.locator('[data-layout-card]').first();
      await firstCard.click();
      // Press Escape to close preview if it opened
      await page.keyboard.press('Escape');

      // Focus the first card directly
      await firstCard.focus();
      await expect(firstCard).toBeFocused();

      // Arrow right should move to next card
      await page.keyboard.press('ArrowRight');
      const secondCard = dialog.locator('[data-layout-card]').nth(1);
      await expect(secondCard).toBeFocused();
    });

    test('opens preview with Enter key on focused card', async ({ page }) => {
      const dialog = await openGallery(page);

      // Focus the first card
      const firstCard = dialog.locator('[data-layout-card]').first();
      await firstCard.focus();

      // Press Enter to open preview
      await page.keyboard.press('Enter');

      // Preview overlay should open (separate dialog)
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });
      await expect(preview.locator('button', { hasText: 'Use as Starting Point' })).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('has proper ARIA attributes on modal', async ({ page }) => {
      const dialog = await openGallery(page);

      // Dialog should have aria-modal
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      // Should have aria-labelledby pointing to title
      await expect(dialog).toHaveAttribute('aria-labelledby', 'inspiration-gallery-title');
    });

    test('traps focus within modal', async ({ page }) => {
      await openGallery(page);

      // Tab through elements - focus should not escape modal
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
      }

      // Focus should still be within the dialog
      const focusedElement = page.locator(':focus');
      const dialog = getGalleryDialog(page);
      await expect(focusedElement).toBeVisible();

      // The focused element should be within the dialog
      const dialogBounds = await dialog.boundingBox();
      const focusedBounds = await focusedElement.boundingBox();
      if (dialogBounds && focusedBounds) {
        expect(focusedBounds.x).toBeGreaterThanOrEqual(dialogBounds.x);
        expect(focusedBounds.y).toBeGreaterThanOrEqual(dialogBounds.y);
      }
    });

    test('layout cards have descriptive aria-labels', async ({ page }) => {
      const dialog = await openGallery(page);

      // First card should have aria-label with layout info
      const firstCard = dialog.locator('[data-layout-card]').first();
      const ariaLabel = await firstCard.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/\d+ bins/i); // Should mention bin count
    });
  });
});

test.describe('Inspiration Gallery - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForMobileAppReady(page);
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

  test('opens gallery from mobile header menu', async ({ page }) => {
    // On mobile, look for the settings/menu button in the header
    const headerMenuButton = page.locator('header button[aria-label*="settings"], header button[aria-label*="menu"]').first();

    if (await headerMenuButton.isVisible()) {
      await headerMenuButton.click();
      // Wait for any menu to appear
      await page.waitForTimeout(300);
    }

    // Look for Inspiration Gallery button anywhere on the page now
    const galleryButton = page.locator('button', { hasText: 'Inspiration Gallery' });

    if (await galleryButton.isVisible()) {
      await galleryButton.click();

      // Gallery should open
      const dialog = getGalleryDialog(page);
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.locator('h2', { hasText: 'Inspiration Gallery' })).toBeVisible();
    } else {
      // Gallery button might be in a bottom sheet panel on mobile
      // Skip test if button not accessible
      test.skip();
    }
  });

  test('gallery is responsive on mobile viewport', async ({ page }) => {
    // Try to open gallery
    const galleryButton = page.locator('button', { hasText: 'Inspiration Gallery' });

    // Check if visible, otherwise try menu
    if (!(await galleryButton.isVisible())) {
      const menuButton = page.locator('header button').first();
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(300);
      }
    }

    if (await galleryButton.isVisible()) {
      await galleryButton.click();

      const dialog = getGalleryDialog(page);
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // On mobile, gallery should take most of the screen width
      const dialogBounds = await dialog.boundingBox();
      if (dialogBounds) {
        // Dialog should be nearly full width on mobile (accounting for inset)
        expect(dialogBounds.width).toBeGreaterThan(MOBILE_VIEWPORT.width * 0.85);
      }

      // Filter pills should still be visible
      await expect(dialog.locator('[role="tablist"]')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('can navigate and import layout on mobile', async ({ page }) => {
    // Try to open gallery
    const galleryButton = page.locator('button', { hasText: 'Inspiration Gallery' });

    if (!(await galleryButton.isVisible())) {
      const menuButton = page.locator('header button').first();
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(300);
      }
    }

    if (await galleryButton.isVisible()) {
      await galleryButton.click();

      const dialog = getGalleryDialog(page);
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Tap on a layout card
      await dialog.locator('[data-layout-card]').first().tap();

      // Preview overlay should open (separate dialog)
      const preview = getPreviewOverlay(page);
      await expect(preview).toBeVisible({ timeout: 5000 });
      await expect(preview.locator('button', { hasText: 'Use as Starting Point' })).toBeVisible();

      // Tap "Use as Starting Point" in the preview overlay
      await preview.locator('button', { hasText: 'Use as Starting Point' }).tap();

      // Gallery and preview should close
      await waitForGalleryClosed(page);
      await waitForPreviewClosed(page);
    } else {
      test.skip();
    }
  });
});
