import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DefaultsTab } from './DefaultsTab';

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
      },
      updateSetting: vi.fn(),
    }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: vi.fn() }),
}));

vi.mock('@/hooks/useDrawerSettings', () => ({
  useDrawerSettings: () => ({
    drawer: { width: 4, depth: 4, height: 6 },
    gridUnitMm: 42,
    printBedSize: 256,
    activeLayerHeight: 3,
    currentCategories: [],
    showSaveCategoriesConfirm: false,
    setShowSaveCategoriesConfirm: vi.fn(),
    handleSaveCategoriesAsDefaults: vi.fn(),
    hasCustomCategoryDefaults: false,
  }),
}));

vi.mock('@/shared/components/StepperControl', () => ({
  StepperControl: ({ ariaLabel }: { ariaLabel: string }) => (
    <div data-testid={`stepper-${ariaLabel}`}>{ariaLabel}</div>
  ),
}));

vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

describe('DefaultsTab', () => {
  it('renders default preferences heading', () => {
    render(<DefaultsTab />);
    expect(screen.getByText('settings.defaultPreferences')).toBeInTheDocument();
  });

  it('renders stepper controls for dimensions', () => {
    render(<DefaultsTab />);
    expect(screen.getByTestId('stepper-settings.defaultDrawerWidth')).toBeInTheDocument();
    expect(screen.getByTestId('stepper-settings.defaultDrawerDepth')).toBeInTheDocument();
  });

  it('renders copy from layout button', () => {
    render(<DefaultsTab />);
    expect(screen.getByText('settings.copyFromCurrentLayout')).toBeInTheDocument();
  });
});
