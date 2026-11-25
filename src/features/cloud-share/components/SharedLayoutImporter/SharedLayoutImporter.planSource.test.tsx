import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import { useLibraryStore } from '@/core/store/library';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';

// The importer reads the URL once at module load, so the plan link must be in
// place before the module is imported. The decoder loads on demand.
vi.mock('@/core/storage', () => ({
  getSharedLayoutFromURL: vi.fn(() => null),
  getPlanLinkFromURL: vi.fn(() => 'v1.abc'),
  clearSharedLayoutFromURL: vi.fn(),
  getCloudShareIdFromURL: vi.fn(() => null),
  clearCloudShareFromURL: vi.fn(),
  restoreSharedDesigns: vi.fn(),
  PLAN_LINK_NEEDS_UPDATE: 'needs update',
}));

vi.mock('@/core/storage/planLinkImport', () => ({
  importPlanLink: vi.fn(async () => ({ layout: createTestLayout({ name: 'Plan' }), errors: [] })),
}));

vi.mock('@/i18n', () => ({ useTranslation: () => (key: string) => key }));

const { SharedLayoutImporter } = await import('./SharedLayoutImporter');

describe('SharedLayoutImporter with a plan link', () => {
  beforeEach(() => {
    resetAllStores();
    useLibraryStore.setState({ isLoaded: true });
  });

  it('opens the plan as a preview that knows it came from a plan link', async () => {
    render(<SharedLayoutImporter />);
    await waitFor(() =>
      expect(useSharedPreviewStore.getState().sharedPreview?.source).toBe('plan')
    );
  });
});
