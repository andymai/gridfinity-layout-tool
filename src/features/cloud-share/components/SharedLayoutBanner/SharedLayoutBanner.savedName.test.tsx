import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/i18n';
import en from '@/i18n/locales/en';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import { SharedLayoutBanner } from './SharedLayoutBanner';

vi.unmock('@/i18n');

describe('SharedLayoutBanner saved name, through the real translator', () => {
  beforeEach(() => {
    resetAllStores();
    useLibraryStore.setState({ isLoaded: true });
  });

  it('keeps replacement patterns in a shared name as typed', async () => {
    const sharedName = "Budget $& $$ $' $`";
    const layout = createTestLayout({ name: sharedName });
    useLayoutStore.setState({ layout });
    useSharedPreviewStore.getState().setSharedLayoutPreview(layout, sharedName);

    render(
      <LocaleProvider initialLocale="en">
        <SharedLayoutBanner />
      </LocaleProvider>
    );
    fireEvent.click(
      await screen.findByRole('button', { name: en['share.banner.saveToMyLayouts'] })
    );

    await waitFor(() => expect(useSharedPreviewStore.getState().sharedPreview).toBeNull());
    const { library } = useLibraryStore.getState();
    const saved = library.entries.find((entry) => entry.id === library.activeLayoutId);
    expect(saved?.name).toBe(`${sharedName} (imported)`);
    expect(useLayoutStore.getState().layout.name).toBe(`${sharedName} (imported)`);
  });
});
