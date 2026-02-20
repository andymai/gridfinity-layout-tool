import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrawerPresetPicker } from './DrawerPresetPicker';
import { useSettingsStore } from '@/core/store/settings';
import { DRAWER_PRESETS } from '@/features/layout-library/constants';

// Actual English translations used by the component (i18n mock returns real en.ts values)
const LABELS = {
  chooseSize: 'Choose a drawer size preset or use your saved defaults:',
  custom: 'My Defaults',
  savedDefaults: 'From settings',
  createLayout: 'Create Layout',
  cancel: 'Cancel',
  // Preset labels
  ikeaAlex: 'IKEA Alex',
  ikeaHelmer: 'IKEA Helmer',
  harborFreight: 'Harbor Freight 44"',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
} as const;

describe('DrawerPresetPicker', () => {
  const mockOnSelect = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.getState().resetSettings();
  });

  function renderPicker() {
    return render(<DrawerPresetPicker onSelect={mockOnSelect} onCancel={mockOnCancel} />);
  }

  describe('rendering', () => {
    it('renders all preset labels', () => {
      renderPicker();
      expect(screen.getByText(LABELS.ikeaAlex)).toBeInTheDocument();
      expect(screen.getByText(LABELS.ikeaHelmer)).toBeInTheDocument();
      expect(screen.getByText(LABELS.harborFreight)).toBeInTheDocument();
      expect(screen.getByText(LABELS.small)).toBeInTheDocument();
      expect(screen.getByText(LABELS.medium)).toBeInTheDocument();
      expect(screen.getByText(LABELS.large)).toBeInTheDocument();
    });

    it('renders the custom My Defaults option', () => {
      renderPicker();
      expect(screen.getByText(LABELS.custom)).toBeInTheDocument();
      expect(screen.getByText(LABELS.savedDefaults)).toBeInTheDocument();
    });

    it('renders the total count of preset buttons (6 presets + 1 custom = 7)', () => {
      renderPicker();
      // All 7 preset buttons are rendered
      expect(
        screen
          .getAllByRole('button')
          .filter(
            (b) =>
              b !== screen.getByText(LABELS.cancel).closest('button') &&
              b !== screen.getByText(LABELS.createLayout).closest('button')
          )
      ).toHaveLength(DRAWER_PRESETS.length + 1);
    });

    it('renders the introductory prompt text', () => {
      renderPicker();
      expect(screen.getByText(LABELS.chooseSize)).toBeInTheDocument();
    });

    it('renders Cancel and Create Layout buttons', () => {
      renderPicker();
      expect(screen.getByRole('button', { name: LABELS.cancel })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: LABELS.createLayout })).toBeInTheDocument();
    });

    it('shows custom drawer dimensions from settings defaults (width=10, depth=8, height=12)', () => {
      renderPicker();
      // The custom button shows dimensions as "10 × 8 × 12"
      // (rendered as three separate text nodes around the × separator)
      const customButton = screen.getByText(LABELS.custom).closest('button');
      expect(customButton).toHaveTextContent('10');
      expect(customButton).toHaveTextContent('8');
      expect(customButton).toHaveTextContent('12');
    });

    it('shows updated dimensions when settings are changed', () => {
      useSettingsStore.setState((state) => ({
        settings: {
          ...state.settings,
          defaultDrawerWidth: 5,
          defaultDrawerDepth: 6,
          defaultDrawerHeight: 3,
        },
      }));
      renderPicker();
      const customButton = screen.getByText(LABELS.custom).closest('button');
      expect(customButton).toHaveTextContent('5');
      expect(customButton).toHaveTextContent('6');
      expect(customButton).toHaveTextContent('3');
    });

    it('renders mm dimensions for presets using gridUnitMm', () => {
      // Default gridUnitMm = 42. IKEA Alex: width=7, depth=12 → 294 × 504mm
      renderPicker();
      const alexButton = screen.getByText(LABELS.ikeaAlex).closest('button');
      expect(alexButton).toHaveTextContent('294');
      expect(alexButton).toHaveTextContent('504mm');
    });
  });

  describe('Create Layout button disabled state', () => {
    it('is disabled initially before any selection', () => {
      renderPicker();
      expect(screen.getByRole('button', { name: LABELS.createLayout })).toBeDisabled();
    });

    it('becomes enabled after selecting a preset', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.ikeaAlex));
      expect(screen.getByRole('button', { name: LABELS.createLayout })).not.toBeDisabled();
    });

    it('becomes enabled after selecting the custom option', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.custom));
      expect(screen.getByRole('button', { name: LABELS.createLayout })).not.toBeDisabled();
    });
  });

  describe('selecting a preset and confirming', () => {
    it('calls onSelect with IKEA Alex drawer dimensions', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.ikeaAlex));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledOnce();
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 7, depth: 12, height: 6 });
    });

    it('calls onSelect with IKEA Helmer drawer dimensions', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.ikeaHelmer));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 6, depth: 8, height: 4 });
    });

    it('calls onSelect with Harbor Freight drawer dimensions', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.harborFreight));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 13, depth: 11, height: 8 });
    });

    it('calls onSelect with Small preset dimensions', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.small));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 5, depth: 5, height: 4 });
    });

    it('calls onSelect with Medium preset dimensions', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.medium));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 10, depth: 8, height: 6 });
    });

    it('calls onSelect with Large preset dimensions', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.large));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 15, depth: 12, height: 10 });
    });

    it('does not call onSelect when Create Layout is clicked with no selection', () => {
      renderPicker();
      // The button is disabled; verify the guard in handleConfirm also protects against
      // programmatic invocation by asserting no call happens
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('calls onSelect exactly once per confirmation', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.small));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledOnce();
    });
  });

  describe('selecting the custom option', () => {
    it('calls onSelect with settings default drawer dimensions', () => {
      // Default settings: width=10, depth=8, height=12
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.custom));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 10, depth: 8, height: 12 });
    });

    it('calls onSelect with customised settings values', () => {
      useSettingsStore.setState((state) => ({
        settings: {
          ...state.settings,
          defaultDrawerWidth: 3,
          defaultDrawerDepth: 4,
          defaultDrawerHeight: 5,
        },
      }));
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.custom));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 3, depth: 4, height: 5 });
    });
  });

  describe('cancellation', () => {
    it('calls onCancel when Cancel is clicked', () => {
      renderPicker();
      fireEvent.click(screen.getByRole('button', { name: LABELS.cancel }));
      expect(mockOnCancel).toHaveBeenCalledOnce();
    });

    it('does not call onSelect when Cancel is clicked', () => {
      renderPicker();
      fireEvent.click(screen.getByRole('button', { name: LABELS.cancel }));
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('calls onCancel regardless of selection state', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.ikeaAlex));
      fireEvent.click(screen.getByRole('button', { name: LABELS.cancel }));
      expect(mockOnCancel).toHaveBeenCalledOnce();
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('switching selections', () => {
    it('remains enabled when switching between presets', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.ikeaAlex));
      fireEvent.click(screen.getByText(LABELS.medium));
      expect(screen.getByRole('button', { name: LABELS.createLayout })).not.toBeDisabled();
    });

    it('calls onSelect with the last selected preset when switching from one preset to another', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.ikeaAlex));
      fireEvent.click(screen.getByText(LABELS.large));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 15, depth: 12, height: 10 });
    });

    it('calls onSelect with custom when switching from preset to custom', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.ikeaAlex));
      fireEvent.click(screen.getByText(LABELS.custom));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      // Default settings dimensions
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 10, depth: 8, height: 12 });
    });

    it('calls onSelect with preset when switching from custom to preset', () => {
      renderPicker();
      fireEvent.click(screen.getByText(LABELS.custom));
      fireEvent.click(screen.getByText(LABELS.small));
      fireEvent.click(screen.getByRole('button', { name: LABELS.createLayout }));
      expect(mockOnSelect).toHaveBeenCalledWith({ width: 5, depth: 5, height: 4 });
    });
  });
});
