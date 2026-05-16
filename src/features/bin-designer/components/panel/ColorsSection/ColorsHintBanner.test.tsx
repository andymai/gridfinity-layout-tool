import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsHintBanner } from './ColorsHintBanner';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_SETTINGS } from '@/core/store/settings.types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ColorsHintBanner', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  });

  it('renders when the multi-color hint is not dismissed', () => {
    render(<ColorsHintBanner />);
    expect(screen.getByText('binDesigner.colors.firstTimeHint')).toBeInTheDocument();
  });

  it('hides when the multi-color hint has been dismissed', () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, dismissedHints: ['multi-color-export'] },
    });
    const { container } = render(<ColorsHintBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('persists the dismissal when the close button is clicked', () => {
    render(<ColorsHintBanner />);
    fireEvent.click(screen.getByLabelText('binDesigner.colors.firstTimeHint.dismiss'));
    expect(useSettingsStore.getState().settings.dismissedHints).toContain('multi-color-export');
  });
});
