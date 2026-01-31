import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinContextMenu } from './BinContextMenu';
import { resetAllStores, createTestBin } from '@/test/testUtils';

// Mock dependencies
vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({
    deleteBin: vi.fn(),
    moveBinToStaging: vi.fn(),
    duplicateBin: vi.fn(),
    updateBin: vi.fn(),
  }),
}));

vi.mock('@/shared/components/ContextMenu', () => ({
  ContextMenuContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu">{children}</div>
  ),
  ContextMenuItem: ({ label }: { label: string }) => <div data-testid="menu-item">{label}</div>,
  ContextMenuDivider: () => <div data-testid="divider" />,
}));

vi.mock('@/components/STLSearchDropdown', () => ({
  STLSearchDropdown: () => <div data-testid="stl-search" />,
}));

vi.mock('@/hooks/useContextMenu', () => ({
  useContextMenu: () => ({ menuRef: { current: null } }),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'inspector.bin') return `${params?.width}×${params?.depth} Bin`;
    return key;
  },
}));

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackDeletion: vi.fn(),
    trackQuickCorrect: vi.fn(),
    trackPlacement: vi.fn(),
  },
}));

describe('BinContextMenu', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const bin = createTestBin();
    const onClose = vi.fn();
    render(<BinContextMenu bin={bin} position={{ x: 0, y: 0 }} onClose={onClose} />);
  });

  it('displays bin dimensions in header', () => {
    const bin = createTestBin({ width: 2, depth: 3 });
    const onClose = vi.fn();
    render(<BinContextMenu bin={bin} position={{ x: 0, y: 0 }} onClose={onClose} />);
    expect(screen.getByText('2×3 Bin')).toBeInTheDocument();
  });

  it('displays bin label when present', () => {
    const bin = createTestBin({ label: 'Test Label' });
    const onClose = vi.fn();
    render(<BinContextMenu bin={bin} position={{ x: 0, y: 0 }} onClose={onClose} />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('renders context menu container', () => {
    const bin = createTestBin();
    const onClose = vi.fn();
    render(<BinContextMenu bin={bin} position={{ x: 0, y: 0 }} onClose={onClose} />);
    expect(screen.getByTestId('context-menu')).toBeInTheDocument();
  });

  it('renders STL search dropdown', () => {
    const bin = createTestBin();
    const onClose = vi.fn();
    render(<BinContextMenu bin={bin} position={{ x: 0, y: 0 }} onClose={onClose} />);
    expect(screen.getByTestId('stl-search')).toBeInTheDocument();
  });

  it('renders divider', () => {
    const bin = createTestBin();
    const onClose = vi.fn();
    render(<BinContextMenu bin={bin} position={{ x: 0, y: 0 }} onClose={onClose} />);
    expect(screen.getByTestId('divider')).toBeInTheDocument();
  });
});
