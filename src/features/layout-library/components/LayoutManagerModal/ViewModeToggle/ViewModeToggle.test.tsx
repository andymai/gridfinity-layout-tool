import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewModeToggle } from './ViewModeToggle';
import type { ViewMode } from '@/shared/components';

// Mock shared component
vi.mock('@/shared/components', () => ({
  ViewModeToggle: ({
    value,
    onChange,
    ariaLabel,
    listLabel,
    gridLabel,
  }: {
    value: ViewMode;
    onChange: (mode: ViewMode) => void;
    ariaLabel: string;
    listLabel: string;
    gridLabel: string;
  }) => (
    <div role="radiogroup" aria-label={ariaLabel}>
      <button
        onClick={() => onChange('list')}
        aria-checked={value === 'list'}
        data-testid="list-button"
      >
        {listLabel}
      </button>
      <button
        onClick={() => onChange('grid')}
        aria-checked={value === 'grid'}
        data-testid="grid-button"
      >
        {gridLabel}
      </button>
    </div>
  ),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ViewModeToggle', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ViewModeToggle value="list" onChange={mockOnChange} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('displays list and grid buttons with translations', () => {
    render(<ViewModeToggle value="list" onChange={mockOnChange} />);

    expect(screen.getByText('layouts.listView')).toBeInTheDocument();
    expect(screen.getByText('layouts.gridView')).toBeInTheDocument();
  });

  it('shows list mode as active', () => {
    render(<ViewModeToggle value="list" onChange={mockOnChange} />);

    const listButton = screen.getByTestId('list-button');
    expect(listButton).toHaveAttribute('aria-checked', 'true');
  });

  it('shows grid mode as active', () => {
    render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

    const gridButton = screen.getByTestId('grid-button');
    expect(gridButton).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when list button is clicked', () => {
    render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

    const listButton = screen.getByTestId('list-button');
    fireEvent.click(listButton);

    expect(mockOnChange).toHaveBeenCalledWith('list');
  });

  it('calls onChange when grid button is clicked', () => {
    render(<ViewModeToggle value="list" onChange={mockOnChange} />);

    const gridButton = screen.getByTestId('grid-button');
    fireEvent.click(gridButton);

    expect(mockOnChange).toHaveBeenCalledWith('grid');
  });

  it('has correct aria-label', () => {
    render(<ViewModeToggle value="list" onChange={mockOnChange} />);

    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toHaveAttribute('aria-label', 'layouts.viewMode');
  });
});
