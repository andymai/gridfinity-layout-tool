import { test, expect } from '@playwright/experimental-ct-react';
import { Checkbox } from './Checkbox';

test.describe('Checkbox visual', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`size ${size} unchecked`, async ({ mount }) => {
      const component = await mount(<Checkbox size={size} label={`Size ${size}`} />);
      await expect(component).toHaveScreenshot(`checkbox-${size}-unchecked.png`);
    });

    test(`size ${size} checked`, async ({ mount }) => {
      const component = await mount(<Checkbox size={size} checked label={`Size ${size}`} />);
      await expect(component).toHaveScreenshot(`checkbox-${size}-checked.png`);
    });
  }

  test('indeterminate', async ({ mount }) => {
    const component = await mount(<Checkbox indeterminate label="Indeterminate" />);
    await expect(component).toHaveScreenshot('checkbox-indeterminate.png');
  });

  test('disabled unchecked', async ({ mount }) => {
    const component = await mount(<Checkbox disabled label="Disabled" />);
    await expect(component).toHaveScreenshot('checkbox-disabled-unchecked.png');
  });

  test('disabled checked', async ({ mount }) => {
    const component = await mount(<Checkbox disabled checked label="Disabled checked" />);
    await expect(component).toHaveScreenshot('checkbox-disabled-checked.png');
  });
});
