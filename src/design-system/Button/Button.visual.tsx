import { test, expect } from '@playwright/experimental-ct-react';
import { Button } from './Button';

test.describe('Button visual', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`size ${size} secondary`, async ({ mount }) => {
      const component = await mount(
        <Button size={size} variant="secondary">
          Button
        </Button>
      );
      await expect(component).toHaveScreenshot(`button-${size}-secondary.png`);
    });
  }

  for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
    test(`variant ${variant}`, async ({ mount }) => {
      const component = await mount(<Button variant={variant}>Button</Button>);
      await expect(component).toHaveScreenshot(`button-${variant}.png`);
    });
  }

  test('disabled', async ({ mount }) => {
    const component = await mount(<Button disabled>Button</Button>);
    await expect(component).toHaveScreenshot('button-disabled.png');
  });

  test('loading', async ({ mount }) => {
    const component = await mount(<Button loading>Button</Button>);
    await expect(component).toHaveScreenshot('button-loading.png', {
      animations: 'disabled',
    });
  });

  test('full width', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: 300 }}>
        <Button fullWidth>Button</Button>
      </div>
    );
    await expect(component).toHaveScreenshot('button-fullwidth.png');
  });
});
