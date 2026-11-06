import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MobileGridToolbar } from './MobileGridToolbar';
import { useInteractionStore } from '@/core/store';
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

  it('shows the find-bins button only while armed, as the way to cancel', () => {
    render(<MobileGridToolbar onFitToScreen={vi.fn()} />);
    expect(screen.queryByTestId('mobile-toolbar-find-bins-that-fit')).not.toBeInTheDocument();

    act(() => useInteractionStore.getState().setGapSelectArmed(true));
    fireEvent.click(screen.getByTestId('mobile-toolbar-find-bins-that-fit'));

    expect(useInteractionStore.getState().gapSelectArmed).toBe(false);
    expect(screen.queryByTestId('mobile-toolbar-find-bins-that-fit')).not.toBeInTheDocument();
  });
});
