import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { baseplateDesignId } from '@/core/types';
import { ActiveBaseplatePanel } from './ActiveBaseplatePanel';

const mocks = vi.hoisted(() => {
  const switchActive = vi.fn();
  return {
    switchActive,
    setShowBaseplateLibrary: vi.fn(),
    libraryState: {
      list: [
        {
          id: 'bp-1' as ReturnType<typeof baseplateDesignId>,
          name: 'One',
          updatedAt: '2024-01-01',
        },
        {
          id: 'bp-2' as ReturnType<typeof baseplateDesignId>,
          name: 'Two',
          updatedAt: '2024-01-02',
        },
      ],
      activeBaseplateId: 'bp-1' as ReturnType<typeof baseplateDesignId>,
      switchActive,
    },
  };
});

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => mocks.libraryState,
}));

vi.mock('@/core/store/view', () => ({
  useViewStore: (selector: (s: unknown) => unknown) =>
    selector({ setShowBaseplateLibrary: mocks.setShowBaseplateLibrary }),
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
    expect(mocks.switchActive).toHaveBeenCalledWith(baseplateDesignId('bp-2'));
  });

  it('opens the library modal from Manage', () => {
    render(<ActiveBaseplatePanel />);
    fireEvent.click(screen.getByText('baseplate.library.manage'));
    expect(mocks.setShowBaseplateLibrary).toHaveBeenCalledWith(true);
  });
});
