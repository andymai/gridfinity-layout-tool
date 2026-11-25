import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useLibraryStore } from '@/core/store/library';
import { useToastStore } from '@/core/store/toast';
import { clearSharedLayoutFromURL } from '@/core/storage';
import { recoverStaleBundle } from '@/shared/pwa/staleRecovery';

const { NEEDS_UPDATE } = vi.hoisted(() => ({
  NEEDS_UPDATE: 'This plan link needs a newer version of the app.',
}));

vi.mock('@/core/storage', () => ({
  getSharedLayoutFromURL: vi.fn(() => null),
  getPlanLinkFromURL: vi.fn(() => 'v9.abc'),
  clearSharedLayoutFromURL: vi.fn(),
  getCloudShareIdFromURL: vi.fn(() => null),
  clearCloudShareFromURL: vi.fn(),
  restoreSharedDesigns: vi.fn(),
  PLAN_LINK_NEEDS_UPDATE: NEEDS_UPDATE,
}));

vi.mock('@/shared/pwa/staleRecovery', () => ({ recoverStaleBundle: vi.fn() }));

vi.mock('@/core/storage/planLinkImport', () => ({
  importPlanLink: vi.fn(async () => ({ layout: null, errors: [NEEDS_UPDATE] })),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const { SharedLayoutImporter } = await import('./SharedLayoutImporter');

describe('SharedLayoutImporter when the app cannot update', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useLibraryStore.setState({ isLoaded: true });
  });

  it('clears the link and says why it did not open', async () => {
    vi.mocked(recoverStaleBundle).mockResolvedValue(false);
    render(<SharedLayoutImporter />);
    await waitFor(() => expect(clearSharedLayoutFromURL).toHaveBeenCalled());
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([
      `toast.sharedLayoutFailed:${JSON.stringify({ error: NEEDS_UPDATE })}`,
    ]);
  });
});
