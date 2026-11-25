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

// The importer reads the URL once at module load, so the plan link must be in
// place before the module is imported. The decoder loads on demand.
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

describe('SharedLayoutImporter with a plan link from a newer app', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useLibraryStore.setState({ isLoaded: true });
  });

  it('updates the app and keeps the link for the reload', async () => {
    vi.mocked(recoverStaleBundle).mockResolvedValue(true);
    render(<SharedLayoutImporter />);
    await waitFor(() => expect(recoverStaleBundle).toHaveBeenCalledWith('plan_link_version'));
    expect(clearSharedLayoutFromURL).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});
