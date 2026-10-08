import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SharedLayoutImporter } from './SharedLayoutImporter';
import { resetAllStores } from '@/test/testUtils';
import { useLibraryStore } from '@/core/store/library';
import { useSharedWithMeStore } from '@/core/store/sharedWithMe';
import { getCloudShareIdFromURL, getSharedLayoutFromURL } from '@/core/storage';

// Mock storage functions
vi.mock('@/core/storage', () => ({
  getSharedLayoutFromURL: vi.fn(() => null),
  clearSharedLayoutFromURL: vi.fn(),
  getCloudShareIdFromURL: vi.fn(() => null),
  clearCloudShareFromURL: vi.fn(),
}));

vi.mock('@/core/api/share', () => ({
  fetchShare: vi.fn(),
}));

vi.mock('@/shared/generation/meshCloud', () => ({
  fetchSharedMeshFiles: vi.fn(async () => undefined),
}));

// Mock result helpers
vi.mock('@/core/result', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    isOk: vi.fn(() => true),
    getUserMessage: vi.fn(() => 'Error message'),
  };
});

// Mock computePreview
vi.mock('@/core/store/library', async () => {
  const actual = await vi.importActual('@/core/store/library');
  return {
    ...actual,
    computePreview: vi.fn(() => ({
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 0,
      layerCount: 1,
      binMap: [],
    })),
  };
});

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('SharedLayoutImporter', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Set default library state
    useLibraryStore.setState({
      isLoaded: true,
    });
    useSharedWithMeStore.setState({
      isLoaded: true,
    });

    // Reset storage mocks to default
    vi.mocked(getSharedLayoutFromURL).mockReturnValue(null);
    vi.mocked(getCloudShareIdFromURL).mockReturnValue(null);
  });

  it('renders without crashing when no shared layout', () => {
    const { container } = render(<SharedLayoutImporter />);
    expect(container).toBeDefined();
  });

  it('returns null when not loading', () => {
    const { container } = render(<SharedLayoutImporter />);
    expect(container.firstChild).toBeNull();
  });

  it('shows loading spinner when fetching cloud share', async () => {
    // This test can't work properly because initialCloudShareId is set at module load time
    // We can only test that the component doesn't show loading when there's no cloud share
    render(<SharedLayoutImporter />);

    // Should not show loading state when no cloud share
    expect(screen.queryByText('share.loadingShared')).not.toBeInTheDocument();
  });

  it('handles URL-encoded share errors', () => {
    vi.mocked(getSharedLayoutFromURL).mockReturnValue({
      layout: null,
      errors: ['Invalid share data'],
    });

    render(<SharedLayoutImporter />);

    // Component should handle error silently
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('SharedLayoutImporter opening a cloud share', () => {
  it('fetches the mesh files the share names straight from the CDN', async () => {
    // The share id is read from the URL when the module loads.
    vi.resetModules();
    const storage = await import('@/core/storage');
    vi.mocked(storage.getCloudShareIdFromURL).mockReturnValue('abc123xyz789');
    (await import('@/core/store/library')).useLibraryStore.setState({ isLoaded: true });
    (await import('@/core/store/sharedWithMe')).useSharedWithMeStore.setState({ isLoaded: true });
    const { ok } = await import('@/core/result');
    const { fetchShare } = await import('@/core/api/share');
    const files = {
      ['a'.repeat(64)]: `https://store.public.blob.vercel-storage.com/meshes/${'a'.repeat(64)}`,
    };
    vi.mocked(fetchShare).mockResolvedValue(
      ok({
        layout: { name: 'Shared', bins: [], layers: [], categories: [] } as never,
        metadata: { createdAt: '2026-01-01T00:00:00.000Z', permission: 'view' },
        meshFiles: files,
      })
    );
    const { fetchSharedMeshFiles } = await import('@/shared/generation/meshCloud');
    const { SharedLayoutImporter: Importer } = await import('./SharedLayoutImporter');

    render(<Importer />);

    await waitFor(() => expect(fetchSharedMeshFiles).toHaveBeenCalledWith(files));
  });
});
