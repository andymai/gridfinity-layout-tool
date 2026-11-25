import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/i18n';
import en from '@/i18n/locales/en';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import type * as Posthog from '@/shared/analytics/posthog';
import { SharedLayoutBanner } from './SharedLayoutBanner';

const mocks = vi.hoisted(() => ({ trackPlanLinkSaved: vi.fn() }));

vi.unmock('@/i18n');
vi.mock('@/shared/analytics/posthog', async (importOriginal) => ({
  ...(await importOriginal<typeof Posthog>()),
  trackPlanLinkSaved: mocks.trackPlanLinkSaved,
}));

async function saveFrom(source?: 'plan'): Promise<void> {
  const layout = createTestLayout({ name: 'Desk drawer', bins: [createTestBin()] });
  useLayoutStore.setState({ layout });
  useSharedPreviewStore
    .getState()
    .setSharedLayoutPreview(
      layout,
      layout.name,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      source
    );
  render(
    <LocaleProvider initialLocale="en">
      <SharedLayoutBanner />
    </LocaleProvider>
  );
  fireEvent.click(await screen.findByRole('button', { name: en['share.banner.saveToMyLayouts'] }));
  await waitFor(() => expect(useSharedPreviewStore.getState().sharedPreview).toBeNull());
}

describe('SharedLayoutBanner plan conversion', () => {
  beforeEach(() => {
    resetAllStores();
    useLibraryStore.setState({ isLoaded: true });
    mocks.trackPlanLinkSaved.mockReset();
  });

  it('counts a saved plan link once, with its bins', async () => {
    await saveFrom('plan');
    expect(mocks.trackPlanLinkSaved).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('counts nothing for a share link', async () => {
    await saveFrom();
    expect(mocks.trackPlanLinkSaved).not.toHaveBeenCalled();
  });
});
