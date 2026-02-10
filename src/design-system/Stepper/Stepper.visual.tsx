import { test, expect } from '@playwright/experimental-ct-react';
import { Stepper } from './Stepper';

const noop = () => {};

test.describe('Stepper visual', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`size ${size} input mode`, async ({ mount }) => {
      const component = await mount(
        <Stepper
          size={size}
          value={5}
          onChange={noop}
          onStep={noop}
          min={1}
          max={10}
          aria-label="Width"
        />
      );
      await expect(component).toHaveScreenshot(`stepper-${size}-input.png`);
    });
  }

  for (const size of ['sm', 'md', 'lg'] as const) {
    test(`size ${size} display mode`, async ({ mount }) => {
      const component = await mount(
        <Stepper
          size={size}
          value={3}
          onStep={noop}
          min={1}
          max={10}
          displayValue="3u"
          aria-label="Height"
        />
      );
      await expect(component).toHaveScreenshot(`stepper-${size}-display.png`);
    });
  }

  test('disabled', async ({ mount }) => {
    const component = await mount(
      <Stepper
        value={5}
        onChange={noop}
        onStep={noop}
        min={1}
        max={10}
        disabled
        aria-label="Width"
      />
    );
    await expect(component).toHaveScreenshot('stepper-disabled.png');
  });

  test('at min value', async ({ mount }) => {
    const component = await mount(
      <Stepper value={1} onChange={noop} onStep={noop} min={1} max={10} aria-label="Width" />
    );
    await expect(component).toHaveScreenshot('stepper-at-min.png');
  });

  test('at max value', async ({ mount }) => {
    const component = await mount(
      <Stepper value={10} onChange={noop} onStep={noop} min={1} max={10} aria-label="Width" />
    );
    await expect(component).toHaveScreenshot('stepper-at-max.png');
  });
});
