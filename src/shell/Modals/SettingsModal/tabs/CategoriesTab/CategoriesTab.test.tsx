import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoriesTab } from './CategoriesTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());
const mockSetShowSaveCategoriesConfirm = vi.hoisted(() => vi.fn());
const mockResetBinDefault = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({
  hasCustomCategoryDefaults: false,
  hasCustomBinDefault: false,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: { defaultCategories: null },
      updateSetting: mockUpdateSetting,
    }),
}));

vi.mock('@/shared/hooks/useDrawerSettings', () => ({
  useDrawerSettings: () => ({
    currentCategories: [
      { id: 'coral', name: 'Coral', color: '#f87171' },
      { id: 'sky', name: 'Sky', color: '#38bdf8' },
    ],
    showSaveCategoriesConfirm: false,
    setShowSaveCategoriesConfirm: mockSetShowSaveCategoriesConfirm,
    handleSaveCategoriesAsDefaults: vi.fn(),
    hasCustomCategoryDefaults: mockState.hasCustomCategoryDefaults,
  }),
}));

vi.mock('@/features/bin-designer', () => ({
  useBinDefaults: () => ({
    hasCustomDefault: mockState.hasCustomBinDefault,
    resetToFactory: mockResetBinDefault,
  }),
}));

vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
    isOpen ? <div data-testid="confirm-dialog">{title}</div> : null,
}));

describe('CategoriesTab', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockSetShowSaveCategoriesConfirm.mockClear();
    mockResetBinDefault.mockClear();
    mockState.hasCustomCategoryDefaults = false;
    mockState.hasCustomBinDefault = false;
  });

  it('renders the default categories and bin defaults sections', () => {
    render(<CategoriesTab />);
    expect(screen.getByText('settings.defaultCategories')).toBeInTheDocument();
    expect(screen.getByText('settings.binDefaults.title')).toBeInTheDocument();
  });

  it('shows the built-in categories notice when no custom defaults', () => {
    render(<CategoriesTab />);
    expect(screen.getByText('settings.usingBuiltInCategories')).toBeInTheDocument();
  });

  it('clicking save categories opens the confirm flow', () => {
    render(<CategoriesTab />);
    fireEvent.click(screen.getByText('settings.saveCategoriesAsDefaults'));
    expect(mockSetShowSaveCategoriesConfirm).toHaveBeenCalledWith(true);
  });

  it('hides the categories reset action until custom defaults exist', () => {
    const { rerender } = render(<CategoriesTab />);
    expect(screen.queryByText('settings.section.reset')).not.toBeInTheDocument();

    mockState.hasCustomCategoryDefaults = true;
    rerender(<CategoriesTab />);
    expect(screen.getAllByText('settings.section.reset').length).toBeGreaterThan(0);
  });
});
