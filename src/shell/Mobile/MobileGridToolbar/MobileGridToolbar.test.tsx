import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileGridToolbar } from './MobileGridToolbar';
import { useInteractionStore, useLabsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('MobileGridToolbar', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const onFitToScreen = vi.fn();
    render(<MobileGridToolbar onFitToScreen={onFitToScreen} />);
  });

  it('displays zoom percentage', () => {
    const onFitToScreen = vi.fn();
    render(<MobileGridToolbar onFitToScreen={onFitToScreen} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('hides the find-bins button while community_showcase is off', () => {
    render(<MobileGridToolbar onFitToScreen={vi.fn()} />);
    expect(screen.queryByTestId('mobile-toolbar-find-bins-that-fit')).not.toBeInTheDocument();
  });

  it('toggles the armed gap-select mode with the flag on', () => {
    useLabsStore.setState((s) => ({
      preferences: {
        ...s.preferences,
        enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: true },
      },
    }));
    render(<MobileGridToolbar onFitToScreen={vi.fn()} />);

    const button = screen.getByTestId('mobile-toolbar-find-bins-that-fit');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(useInteractionStore.getState().gapSelectArmed).toBe(true);

    fireEvent.click(button);
    expect(useInteractionStore.getState().gapSelectArmed).toBe(false);
  });
});
