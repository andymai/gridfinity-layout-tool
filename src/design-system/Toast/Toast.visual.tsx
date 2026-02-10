import { test, expect } from '@playwright/experimental-ct-react';
import { ToastContainer, type ToastData } from './Toast';

const baseToast: ToastData = {
  id: 'test-1',
  type: 'info',
  message: 'This is a test notification',
  duration: 0, // Prevent auto-dismiss during test
};

const successToast: ToastData = {
  ...baseToast,
  id: 'test-success',
  type: 'success',
  message: 'Changes saved successfully!',
};

const errorToast: ToastData = {
  ...baseToast,
  id: 'test-error',
  type: 'error',
  message: 'Failed to save changes. Please try again.',
};

const actionToast: ToastData = {
  ...baseToast,
  id: 'test-action',
  message: 'Item deleted',
  action: { label: 'Undo', onClick: () => {} },
};

const noop = () => {};

test.describe('Toast visual', () => {
  for (const type of ['success', 'error', 'info'] as const) {
    test(`type ${type}`, async ({ mount, page }) => {
      await mount(
        <ToastContainer
          toasts={[{ ...baseToast, type, id: `test-${type}` }]}
          onDismiss={noop}
          position="bottom-right"
        />
      );
      const toast = page.locator('[role="status"], [role="alert"]').first();
      await expect(toast).toHaveScreenshot(`toast-${type}.png`);
    });
  }

  test('with action button', async ({ mount, page }) => {
    await mount(<ToastContainer toasts={[actionToast]} onDismiss={noop} position="bottom-right" />);
    const toast = page.locator('[role="status"]').first();
    await expect(toast).toHaveScreenshot('toast-action.png');
  });

  test('top-center position', async ({ mount, page }) => {
    await mount(
      <ToastContainer toasts={[successToast, errorToast]} onDismiss={noop} position="top-center" />
    );
    // Screenshot the container for position verification
    const container = page.locator('.fixed').first();
    await expect(container).toHaveScreenshot('toast-top-center.png');
  });

  test('bottom-right position', async ({ mount, page }) => {
    await mount(
      <ToastContainer toasts={[successToast]} onDismiss={noop} position="bottom-right" />
    );
    const container = page.locator('.fixed').first();
    await expect(container).toHaveScreenshot('toast-bottom-right.png');
  });
});
