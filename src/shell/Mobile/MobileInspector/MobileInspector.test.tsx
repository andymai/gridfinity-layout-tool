import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MobileInspector } from './MobileInspector';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: () => <div data-testid="confirm-dialog" />,
}));

vi.mock('@/features/bin-inspector', () => ({
  useBinInspector: () => ({
    selectedBins: [],
    isMultiSelect: false,
    bin: null,
    deleteConfirmState: null,
    confirmDelete: vi.fn(),
    cancelDelete: vi.fn(),
  }),
  SingleBinInspector: () => <div data-testid="single-inspector" />,
  MultiBinInspector: () => <div data-testid="multi-inspector" />,
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('MobileInspector', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MobileInspector />);
  });
});
