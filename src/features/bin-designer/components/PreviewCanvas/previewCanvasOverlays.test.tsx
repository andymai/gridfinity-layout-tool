import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TouchHint } from './previewCanvasOverlays';
import { useSettingsStore } from '@/core/store/settings';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isTouchDevice: true, isDesktop: false, isMobile: true, isTablet: false }),
}));

describe('TouchHint', () => {
  beforeEach(() => {
    resetAllStores();
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        dismissedHints: [],
      },
    });
  });

  it('shows the gesture hint on a touch device that has not dismissed it', () => {
    render(<TouchHint />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('dismissing hides the hint and persists the dismissal', () => {
    render(<TouchHint />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    expect(useSettingsStore.getState().settings.dismissedHints).toContain('designer-touch');
  });
});
