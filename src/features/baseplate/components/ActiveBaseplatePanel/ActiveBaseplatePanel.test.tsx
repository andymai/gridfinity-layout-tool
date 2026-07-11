import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { baseplateDesignId } from '@/core/types';
import { ActiveBaseplatePanel } from './ActiveBaseplatePanel';

const switchActive = vi.fn();
const setShowBaseplateLibrary = vi.fn();

const libraryState = {
  list: [
    { id: baseplateDesignId('bp-1'), name: 'One', updatedAt: '2024-01-01' },
    { id: baseplateDesignId('bp-2'), name: 'Two', updatedAt: '2024-01-02' },
  ],
  activeBaseplateId: baseplateDesignId('bp-1'),
  switchActive,
};

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => libraryState,
}));

vi.mock('@/core/store/view', () => ({
  useViewStore: (selector: (s: unknown) => unknown) => selector({ setShowBaseplateLibrary }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ActiveBaseplatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the library entries as options', () => {
    render(<ActiveBaseplatePanel />);
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('switches the active design when a different option is selected', () => {
    render(<ActiveBaseplatePanel />);
    const select = screen.getByLabelText('baseplate.library.selectLabel');
    fireEvent.change(select, { target: { value: 'bp-2' } });
    expect(switchActive).toHaveBeenCalledWith(baseplateDesignId('bp-2'));
  });

  it('opens the library modal from Manage', () => {
    render(<ActiveBaseplatePanel />);
    fireEvent.click(screen.getByText('baseplate.library.manage'));
    expect(setShowBaseplateLibrary).toHaveBeenCalledWith(true);
  });
});
