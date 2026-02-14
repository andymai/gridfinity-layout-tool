import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppearanceTab } from './AppearanceTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({
  theme: 'dark' as string,
  accentColor: 'amber' as string,
  uiDensity: 'default' as string,
  gridShowLines: true,
  gridShowHalfLines: true,
  gridLineOpacity: 40,
  reduceMotion: false,
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
      settings: mockState,
      updateSetting: mockUpdateSetting,
    }),
}));

vi.mock('@/shared/components/Checkbox', () => ({
  Checkbox: ({ checked }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly />
  ),
}));

describe('AppearanceTab', () => {
  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockState.theme = 'dark';
    mockState.accentColor = 'amber';
    mockState.uiDensity = 'default';
    mockState.gridShowLines = true;
    mockState.gridShowHalfLines = true;
    mockState.gridLineOpacity = 40;
    mockState.reduceMotion = false;
  });

  it('renders all section headings', () => {
    render(<AppearanceTab />);
    expect(screen.getByText('settings.theme')).toBeInTheDocument();
    expect(screen.getByText('settings.accentColor')).toBeInTheDocument();
    expect(screen.getByText('settings.uiDensity')).toBeInTheDocument();
    expect(screen.getByText('settings.gridVisuals')).toBeInTheDocument();
    expect(screen.getByText('settings.reduceMotion')).toBeInTheDocument();
  });

  it('renders theme radio options', () => {
    render(<AppearanceTab />);
    expect(screen.getByText('settings.theme.dark')).toBeInTheDocument();
    expect(screen.getByText('settings.theme.light')).toBeInTheDocument();
    expect(screen.getByText('settings.theme.system')).toBeInTheDocument();
  });

  it('clicking light theme calls updateSetting', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('settings.theme.light'));
    expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'light');
  });

  it('clicking accent color calls updateSetting', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByRole('radio', { name: 'settings.accentColor.violet' }));
    expect(mockUpdateSetting).toHaveBeenCalledWith('accentColor', 'violet');
  });

  it('clicking density option calls updateSetting', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('settings.uiDensity.compact'));
    expect(mockUpdateSetting).toHaveBeenCalledWith('uiDensity', 'compact');
  });

  it('toggling grid lines calls updateSetting', () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('settings.gridShowLines'));
    expect(mockUpdateSetting).toHaveBeenCalledWith('gridShowLines', false);
  });

  it('toggling reduce motion calls updateSetting', () => {
    render(<AppearanceTab />);
    const checkboxes = screen.getAllByRole('checkbox');
    // Last checkbox is reduce motion (no separate heading — just the toggle)
    fireEvent.click(checkboxes[checkboxes.length - 1]);
    expect(mockUpdateSetting).toHaveBeenCalledWith('reduceMotion', true);
  });

  it('grid opacity slider updates setting', () => {
    render(<AppearanceTab />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '80' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('gridLineOpacity', 80);
  });

  it('disables half-lines and opacity when grid lines are off', () => {
    mockState.gridShowLines = false;
    render(<AppearanceTab />);
    const halfLinesToggle = screen
      .getByText('settings.gridShowHalfLines')
      .closest('[role="checkbox"]')!;
    expect(halfLinesToggle).toHaveAttribute('aria-disabled', 'true');
    expect(halfLinesToggle).toHaveAttribute('tabindex', '-1');
    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
  });

  it('does not fire toggle when disabled half-lines is clicked', () => {
    mockState.gridShowLines = false;
    render(<AppearanceTab />);
    fireEvent.click(screen.getByText('settings.gridShowHalfLines'));
    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  it('keyboard Enter triggers theme selection', () => {
    render(<AppearanceTab />);
    const lightOption = screen.getByText('settings.theme.light');
    fireEvent.keyDown(lightOption.closest('[role="radio"]')!, { key: 'Enter' });
    expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'light');
  });
});
