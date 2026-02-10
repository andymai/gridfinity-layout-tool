import { test, expect } from '@playwright/experimental-ct-react';
import { Select } from './Select';

const options = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

test.describe('Select visual', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`size ${size}`, async ({ mount }) => {
      const component = await mount(
        <Select size={size} options={options} value="a" aria-label="Choice" />
      );
      await expect(component).toHaveScreenshot(`select-${size}.png`);
    });
  }

  test('full width md', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: 300 }}>
        <Select fullWidth options={options} value="a" aria-label="Choice" />
      </div>
    );
    await expect(component).toHaveScreenshot('select-fullwidth.png');
  });

  test('with color swatch', async ({ mount }) => {
    const component = await mount(
      <Select options={options} value="a" colorSwatch="#f59e0b" aria-label="Choice" />
    );
    await expect(component).toHaveScreenshot('select-swatch.png');
  });

  test('error state', async ({ mount }) => {
    const component = await mount(<Select options={options} value="a" error aria-label="Choice" />);
    await expect(component).toHaveScreenshot('select-error.png');
  });

  test('disabled state', async ({ mount }) => {
    const component = await mount(
      <Select options={options} value="a" disabled aria-label="Choice" />
    );
    await expect(component).toHaveScreenshot('select-disabled.png');
  });
});
