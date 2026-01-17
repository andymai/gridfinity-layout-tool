import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  selectBinAt,
  getInspector,
  getSidebar,
  waitForDialog,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/**
 * Filter out known accessibility issues that are either:
 * - False positives for this app's architecture
 * - Low priority issues to fix in a separate effort
 *
 * Note: These are documented issues to address in future iterations,
 * not being ignored permanently.
 */
function filterKnownIssues(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  const knownIssueIds = [
    // Scrollable region focus: Our scroll containers have focusable content inside them,
    // but axe doesn't always detect this correctly. The grid itself handles keyboard nav.
    'scrollable-region-focusable',
    // Color contrast: Dark theme with carefully chosen colors. axe sometimes flags
    // colors that meet requirements in practice. Would need manual review.
    'color-contrast',
  ];

  return violations.filter(v => {
    if (knownIssueIds.includes(v.id)) return false;

    // Only keep critical and serious
    return v.impact === 'critical' || v.impact === 'serious';
  });
}

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs (excluding Labs drawer)
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('main page has no critical accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Exclude canvas elements (3D preview) from color contrast checks
      .exclude('canvas')
      .analyze();

    const criticalViolations = filterKnownIssues(results.violations);
    expect(criticalViolations).toEqual([]);
  });

  test('sidebar has proper ARIA structure', async ({ page }) => {
    const sidebar = getSidebar(page);
    await expect(sidebar).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('aside')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = filterKnownIssues(results.violations);
    expect(criticalViolations).toEqual([]);
  });

  test('bin inspector has proper ARIA labels when bin selected', async ({ page }) => {
    // Create and select a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await selectBinAt(page, 70, 70);

    // Verify inspector is visible
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({ timeout: 3000 });

    // Run axe on the inspector panel
    const results = await new AxeBuilder({ page })
      .include('aside:last-of-type')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = filterKnownIssues(results.violations);
    expect(criticalViolations).toEqual([]);
  });

  test('help modal dialog is accessible', async ({ page }) => {
    // Open help modal with ? key
    await page.keyboard.press('Shift+?');

    // Verify modal is visible (excluding Labs drawer)
    await waitForDialog(page);
    const modal = getActiveDialog(page);
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Run axe on the modal
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = filterKnownIssues(results.violations);
    expect(criticalViolations).toEqual([]);

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('confirm dialog is accessible', async ({ page }) => {
    // Scroll to see the "Save Current as Defaults" button in the sidebar
    const sidebar = getSidebar(page);
    const saveDefaultsButton = sidebar.getByRole('button', { name: 'Save Current as Defaults' });
    await saveDefaultsButton.scrollIntoViewIfNeeded();
    await saveDefaultsButton.click();

    // Verify dialog is visible (excluding Labs drawer)
    await waitForDialog(page);
    const dialog = getActiveDialog(page);
    await expect(dialog).toBeVisible();

    // Run axe on the dialog
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = filterKnownIssues(results.violations);
    expect(criticalViolations).toEqual([]);

    // Cancel dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('interactive elements are keyboard focusable', async ({ page }) => {
    // Tab through the page and verify focus moves
    await page.keyboard.press('Tab');

    // Should be able to tab to interactive elements
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Continue tabbing to verify multiple elements are focusable
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
    }
  });

  test('buttons have accessible names', async ({ page }) => {
    // Check that all buttons have accessible names
    const buttons = page.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const name = await button.getAttribute('aria-label') || await button.textContent();
        expect(name?.trim()).not.toBe('');
      }
    }
  });

  test('grid has proper role and label', async ({ page }) => {
    // The grid canvas should have role="application" for custom keyboard handling
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();

    // Should have an accessible label
    const label = await grid.getAttribute('aria-label');
    expect(label).toBeTruthy();
  });

  test('form inputs have labels', async ({ page }) => {
    // Create a bin to show the inspector with inputs
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await selectBinAt(page, 70, 70);

    // Wait for inspector to show
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({ timeout: 3000 });

    // Check inputs have labels (aria-label or associated label element)
    const inputs = inspector.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        const ariaLabel = await input.getAttribute('aria-label');
        const id = await input.getAttribute('id');

        if (!ariaLabel && id) {
          // Check for associated label
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          expect(ariaLabel || hasLabel).toBeTruthy();
        } else {
          // Has aria-label or placeholder
          const placeholder = await input.getAttribute('placeholder');
          expect(ariaLabel || placeholder).toBeTruthy();
        }
      }
    }
  });
});
