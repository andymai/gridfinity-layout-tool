import { test, expect } from '@playwright/experimental-ct-react';
import { Input } from './Input';

test.describe('Input visual', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`size ${size}`, async ({ mount }) => {
      const component = await mount(
        <Input size={size} placeholder="Placeholder text" aria-label="Input" />
      );
      await expect(component).toHaveScreenshot(`input-${size}.png`);
    });
  }

  test('with value', async ({ mount }) => {
    const component = await mount(<Input value="Hello world" aria-label="Input" readOnly />);
    await expect(component).toHaveScreenshot('input-with-value.png');
  });

  test('error state', async ({ mount }) => {
    const component = await mount(<Input error placeholder="Error input" aria-label="Input" />);
    await expect(component).toHaveScreenshot('input-error.png');
  });

  test('disabled', async ({ mount }) => {
    const component = await mount(<Input disabled value="Disabled" aria-label="Input" />);
    await expect(component).toHaveScreenshot('input-disabled.png');
  });

  test('full width', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: 300 }}>
        <Input fullWidth placeholder="Full width" aria-label="Input" />
      </div>
    );
    await expect(component).toHaveScreenshot('input-fullwidth.png');
  });
});
