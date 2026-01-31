import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinListModal } from './BinListModal';
import { resetAllStores } from '@/test/testUtils';

vi.mock('./BinListDashboard', () => ({
  BinListDashboard: () => <div data-testid="bin-list-dashboard" />,
}));

vi.mock('./BinListTable', () => ({
  BinListTable: () => <div data-testid="bin-list-table" />,
}));

vi.mock('./MobileBinList', () => ({
  MobileBinList: () => <div data-testid="mobile-bin-list" />,
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ isMobile: false, isDesktop: true }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    if (key === 'mobile.binList.title') return 'Bin List';
    if (key === 'common.close') return 'Close';
    if (key === 'binList.closeBinList') return 'Close';
    return key;
  },
}));

describe('BinListModal', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing when open', () => {
    const onClose = vi.fn();
    render(<BinListModal isOpen={true} onClose={onClose} />);
  });

  it('renders nothing when closed', () => {
    const onClose = vi.fn();
    const { container } = render(<BinListModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays close button when open', () => {
    const onClose = vi.fn();
    render(<BinListModal isOpen={true} onClose={onClose} />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});
