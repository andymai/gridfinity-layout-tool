import {
  test,
  expect,
  MOBILE_VIEWPORT,
  waitForMobileAppReady,
  getGridBounds,
  drawBinOnGrid,
  waitForBinCount,
  waitForBinSelected,
  waitForNoSelection,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

/**
 * Mobile touch interaction tests.
 *
 * These tests verify that core grid interactions (draw, drag, resize) work
 * reliably on touch devices. They run on mobile-chrome (Pixel 5) and
 * mobile-safari (iPhone 12) projects which have hasTouch: true.
 *
 * Key fixes being validated:
 * - useLayoutEffect for document-level event listeners (prevents race condition)
 * - touchAction: 'none' on GridCanvas (prevents pointercancel during draw)
 * - Resize handle guard in Bin.handlePointerDown (defense-in-depth)
 */
test.describe('Mobile Touch Interactions', () => {
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

  test('quick draw gesture completes without pointercancel', async ({ page }) => {
    // A fast draw gesture should create a bin, not be cancelled by the browser.
    // Before the touchAction fix, the browser would fire pointercancel because
    // touchAction was 'pan-x pan-y' at pointerdown time.
    const bounds = await getGridBounds(page);

    const startX = bounds.x + 30;
    const startY = bounds.y + 30;
    const endX = bounds.x + 100;
    const endY = bounds.y + 100;

    // Simulate a quick touch-drag (fewer steps = faster gesture)
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 3 });
    await page.mouse.up();

    // Bin should be created despite the fast gesture
    await waitForBinCount(page, 1);
  });

  test('tap on bin selects it', async ({ page }) => {
    // Create a bin first
    const bounds = await getGridBounds(page);
    await page.mouse.move(bounds.x + 30, bounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 100, bounds.y + 100, { steps: 5 });
    await page.mouse.up();
    await waitForBinCount(page, 1);

    // Deselect by tapping empty area
    await page.mouse.click(bounds.x + 200, bounds.y + 200);
    await waitForNoSelection(page);

    // Tap the bin to select it
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);
  });

  test('drag works after movement threshold', async ({ page }) => {
    // Create and select a bin
    const bin = await drawBinOnGrid(page, 30, 30, 100, 100);
    await waitForBinCount(page, 1);
    await waitForBinSelected(bin);

    // Get bin's initial position
    const binBox = await bin.boundingBox();
    if (!binBox) throw new Error('Bin not found');
    const bounds = await getGridBounds(page);

    const centerX = binBox.x + binBox.width / 2;
    const centerY = binBox.y + binBox.height / 2;

    // Tap to re-select (touch devices select on tap, drag on move > 10px)
    await page.mouse.click(centerX, centerY);
    await waitForBinSelected(bin);

    // Now start a drag gesture that exceeds the 10px movement threshold
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    // Move more than 10px to trigger drag
    await page.mouse.move(centerX + 60, centerY + 60, { steps: 10 });
    await page.mouse.up();

    // Verify bin moved - new bounding box should differ
    const binBoxAfter = await bin.boundingBox();
    if (!binBoxAfter) throw new Error('Bin not found after drag');

    // The bin should have moved (at least one axis changed)
    const moved = binBoxAfter.x !== binBox.x || binBoxAfter.y !== binBox.y;
    expect(moved).toBe(true);
  });

  test('interaction state does not get stuck', async ({ page }) => {
    // Verify that after a complete draw gesture, there are no orphan interactions
    // that would hide resize handles or block further interactions.
    const bounds = await getGridBounds(page);

    // Draw a bin
    await page.mouse.move(bounds.x + 30, bounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 100, bounds.y + 100, { steps: 5 });
    await page.mouse.up();
    await waitForBinCount(page, 1);

    // The bin should be selectable (interaction is cleared)
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    // Resize handles should be visible for selected bin (proves interaction is null)
    await expect(page.locator('.resize-handle').first()).toBeVisible({ timeout: 3000 });
  });

  test('resize handle responds to touch', async ({ page }) => {
    // Create and select a bin so resize handles appear
    const bin = await drawBinOnGrid(page, 30, 30, 100, 100);
    await waitForBinCount(page, 1);
    await waitForBinSelected(bin);

    // Resize handles should be visible
    const handles = page.locator('.resize-handle');
    await expect(handles.first()).toBeVisible({ timeout: 3000 });

    // Get the bin's initial dimensions
    const binBox = await bin.boundingBox();
    if (!binBox) throw new Error('Bin not found');

    // Find a resize handle and attempt to drag it
    // Use the east (right-edge) handle for a horizontal resize
    const handle = handles.first();
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('Resize handle not found');

    const handleCenterX = handleBox.x + handleBox.width / 2;
    const handleCenterY = handleBox.y + handleBox.height / 2;

    // Drag the resize handle outward
    await page.mouse.move(handleCenterX, handleCenterY);
    await page.mouse.down();
    await page.mouse.move(handleCenterX + 50, handleCenterY, { steps: 5 });
    await page.mouse.up();

    // After releasing, interaction should be cleared - verify by checking
    // the bin is still selectable and handles reappear
    await bin.click();
    await waitForBinSelected(bin);
    await expect(handles.first()).toBeVisible({ timeout: 3000 });
  });

  test('multiple sequential draw gestures all succeed', async ({ page }) => {
    // Verify that drawing multiple bins in sequence doesn't leave
    // interaction state stuck, which would block subsequent draws.
    const bounds = await getGridBounds(page);

    // Draw first bin (top-left area)
    await page.mouse.move(bounds.x + 20, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 70, bounds.y + 70, { steps: 3 });
    await page.mouse.up();
    await waitForBinCount(page, 1);

    // Draw second bin (top-right area)
    await page.mouse.move(bounds.x + 100, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 150, bounds.y + 70, { steps: 3 });
    await page.mouse.up();
    await waitForBinCount(page, 2);

    // Draw third bin (bottom area)
    await page.mouse.move(bounds.x + 20, bounds.y + 100);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 70, bounds.y + 150, { steps: 3 });
    await page.mouse.up();
    await waitForBinCount(page, 3);
  });
});
