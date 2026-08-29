import { test, expect } from '@playwright/experimental-ct-react';
import { NumberField } from './NumberField';

const noop = () => {};

test.describe('NumberField visual', () => {
  for (const size of ['sm', 'md'] as const) {
    test(`size ${size}`, async ({ mount }) => {
      const component = await mount(
        <NumberField size={size} label="X" value={42} onChange={noop} unit="mm" />
      );
      await expect(component).toHaveScreenshot(`numberfield-${size}.png`);
    });
  }

  test('disabled', async ({ mount }) => {
    const component = await mount(
      <NumberField label="X" value={42} onChange={noop} unit="mm" disabled />
    );
    await expect(component).toHaveScreenshot('numberfield-disabled.png');
  });

  test('highlighted', async ({ mount }) => {
    const component = await mount(<NumberField label="X" value={42} onChange={noop} highlight />);
    await expect(component).toHaveScreenshot('numberfield-highlight.png');
  });

  test('mixed selection', async ({ mount }) => {
    const component = await mount(
      <NumberField label="X" value={42} onChange={noop} indeterminate />
    );
    await expect(component).toHaveScreenshot('numberfield-mixed.png');
  });
});
