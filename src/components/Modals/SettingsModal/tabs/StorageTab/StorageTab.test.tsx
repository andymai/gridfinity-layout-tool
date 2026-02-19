import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageTab } from './StorageTab';
import type { StorageInfo } from './useStorageInfo';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const mockUseStorageInfo = vi.hoisted(() => vi.fn());

vi.mock('./useStorageInfo', () => ({
  useStorageInfo: mockUseStorageInfo,
}));

const baseInfo: StorageInfo = {
  backend: 'indexeddb',
  localStoragePercent: 10,
  indexedDBBytes: 1024,
  quotaBytes: 1024 * 1024,
  layoutCount: 5,
  loading: false,
};

beforeEach(() => {
  mockUseStorageInfo.mockReturnValue(baseInfo);
});

describe('StorageTab', () => {
  it('shows loading state when loading is true', () => {
    mockUseStorageInfo.mockReturnValue({ ...baseInfo, loading: true });
    render(<StorageTab />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows healthy status when backend is indexeddb', () => {
    render(<StorageTab />);
    expect(screen.getByText('settings.storage.statusHealthy')).toBeInTheDocument();
    expect(screen.getByText('settings.storage.statusHealthyHint')).toBeInTheDocument();
  });

  it('shows limited status when backend is localstorage', () => {
    mockUseStorageInfo.mockReturnValue({
      ...baseInfo,
      backend: 'localstorage',
      indexedDBBytes: null,
    });
    render(<StorageTab />);
    expect(screen.getByText('settings.storage.statusLimited')).toBeInTheDocument();
    expect(screen.getByText('settings.storage.statusLimitedHint')).toBeInTheDocument();
  });

  it('shows layout count with progress bar', () => {
    render(<StorageTab />);
    expect(screen.getByText('settings.storage.layoutCount')).toBeInTheDocument();
    const bar = screen.getAllByRole('progressbar')[0];
    expect(bar).toHaveAttribute('aria-valuenow', '5');
  });

  it('shows database size section when indexeddb backend and indexedDBBytes available', () => {
    render(<StorageTab />);
    expect(screen.getByText('settings.storage.databaseSize')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });

  it('hides database size section when backend is localstorage', () => {
    mockUseStorageInfo.mockReturnValue({
      ...baseInfo,
      backend: 'localstorage',
      indexedDBBytes: null,
    });
    render(<StorageTab />);
    expect(screen.queryByText('settings.storage.databaseSize')).not.toBeInTheDocument();
  });

  it('shows settings cache section with localStorage percent', () => {
    render(<StorageTab />);
    expect(screen.getByText('settings.storage.settingsCache')).toBeInTheDocument();
    expect(screen.getByText('settings.storage.percentUsed')).toBeInTheDocument();
  });

  it('shows warning styling on layout count when count exceeds warning threshold', () => {
    mockUseStorageInfo.mockReturnValue({ ...baseInfo, layoutCount: 85 });
    render(<StorageTab />);
    const maxLabel = screen.getByText('settings.storage.layoutMax');
    expect(maxLabel).toHaveClass('text-warning');
  });

  it('shows warning styling on settings cache when localStorage percent >= 80', () => {
    mockUseStorageInfo.mockReturnValue({ ...baseInfo, localStoragePercent: 85 });
    render(<StorageTab />);
    const limitLabel = screen.getByText('settings.storage.settingsCacheLimit');
    expect(limitLabel).toHaveClass('text-warning');
  });
});
