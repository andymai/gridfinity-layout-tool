import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultsTab } from './DefaultsTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());
const mockAddToast = vi.hoisted(() => vi.fn());
const mockSetShowSaveCategoriesConfirm = vi.hoisted(() => vi.fn());
const mockHandleSaveCategoriesAsDefaults = vi.hoisted(() => vi.fn());
const mockDrawerState = vi.hoisted(() => ({
  hasCustomCategoryDefaults: false,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: {
        defaultDrawerWidth: 4,
        defaultDrawerDepth: 4,
        defaultDrawerHeight: 6,
        defaultLayerHeight: 3,
        defaultPrintBedSize: 256,
        defaultGridUnitMm: 42,
        defaultCategories: null,
        printSettings: {
          filamentCostPerKg: 20,
          layerHeightMm: 0.2,
          infillPercent: 15,
        },
      },
      updateSetting: mockUpdateSetting,
    }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
  INITIAL_TOAST_STATE: {},
}));

vi.mock('@/shared/hooks/useDrawerSettings', () => ({
  useDrawerSettings: () => ({
    drawer: { width: 4, depth: 4, height: 6 },
    gridUnitMm: 42,
    printBedSize: 256,
    activeLayerHeight: 3,
    currentCategories: [
      { id: 'coral', name: 'Coral', color: '#f87171' },
      { id: 'sky', name: 'Sky', color: '#38bdf8' },
    ],
    showSaveCategoriesConfirm: false,
    setShowSaveCategoriesConfirm: mockSetShowSaveCategoriesConfirm,
    handleSaveCategoriesAsDefaults: mockHandleSaveCategoriesAsDefaults,
    hasCustomCategoryDefaults: mockDrawerState.hasCustomCategoryDefaults,
  }),
}));

vi.mock('@/shared/components/StepperControl', () => ({
  StepperControl: ({ ariaLabel }: { ariaLabel: string }) => (
    <div data-testid={`stepper-${ariaLabel}`}>{ariaLabel}</div>
  ),
}));

vi.mock('@/shared/components/DeferredNumberInput', () => ({
  DeferredNumberInput: ({ id }: { id: string }) => <input data-testid={`input-${id}`} />,
}));

vi.mock('@/shared/components/SettingsRow', () => ({
  SettingsRow: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid={`settings-row-${label}`}>{children}</div>
  ),
}));

vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
    title,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button data-testid="confirm-btn" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

describe('DefaultsTab', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockAddToast.mockClear();
    mockDrawerState.hasCustomCategoryDefaults = false;
  });

  it('renders default preferences heading', () => {
    render(<DefaultsTab />);
    expect(screen.getByText('settings.defaultPreferences')).toBeInTheDocument();
  });

  it('renders stepper controls for dimensions', () => {
    render(<DefaultsTab />);
    expect(screen.getByTestId('stepper-common.width')).toBeInTheDocument();
    expect(screen.getByTestId('stepper-common.depth')).toBeInTheDocument();
  });

  it('renders copy from layout button', () => {
    render(<DefaultsTab />);
    expect(screen.getByText('settings.copyFromCurrentLayout')).toBeInTheDocument();
  });

  it('renders default categories section', () => {
    render(<DefaultsTab />);
    expect(screen.getByText('settings.defaultCategories')).toBeInTheDocument();
  });

  it('clicking copy-from-layout button shows confirm dialog', () => {
    render(<DefaultsTab />);
    const copyBtn = screen.getByText('settings.copyFromCurrentLayout');
    fireEvent.click(copyBtn);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('renders category color chips from defaults', () => {
    render(<DefaultsTab />);
    // With defaultCategories: null, it falls back to DEFAULT_CATEGORIES from constants
    // The component renders (settings.defaultCategories ?? DEFAULT_CATEGORIES)
    expect(screen.getByText('settings.usingBuiltInCategories')).toBeInTheDocument();
  });

  it('shows reset-to-built-in button when hasCustomCategoryDefaults is true', () => {
    mockDrawerState.hasCustomCategoryDefaults = true;
    render(<DefaultsTab />);
    expect(screen.getByText('settings.resetToBuiltIn')).toBeInTheDocument();
  });
});
