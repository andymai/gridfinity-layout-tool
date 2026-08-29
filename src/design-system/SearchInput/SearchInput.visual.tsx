import { test, expect } from '@playwright/experimental-ct-react';
import { SearchInput } from './SearchInput';

const noop = () => {};

test.describe('SearchInput visual', () => {
  test('empty with shortcut hint', async ({ mount }) => {
    const component = await mount(
      <SearchInput
        value=""
        onValueChange={noop}
        clearLabel="Clear"
        shortcutHint="⌘K"
        placeholder="Search settings"
        aria-label="Search"
      />
    );
    await expect(component).toHaveScreenshot('searchinput-empty.png');
  });

  test('with text and clear button', async ({ mount }) => {
    const component = await mount(
      <SearchInput value="magnet" onValueChange={noop} clearLabel="Clear" aria-label="Search" />
    );
    await expect(component).toHaveScreenshot('searchinput-filled.png');
  });
});
