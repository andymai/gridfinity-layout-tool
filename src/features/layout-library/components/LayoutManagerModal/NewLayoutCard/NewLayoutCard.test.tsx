import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewLayoutCard } from './NewLayoutCard';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('NewLayoutCard', () => {
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<NewLayoutCard onCreate={mockOnCreate} />);
    expect(screen.getByText('layouts.newLayout')).toBeInTheDocument();
  });

  it('displays new layout title', () => {
    render(<NewLayoutCard onCreate={mockOnCreate} />);
    expect(screen.getByText('layouts.newLayout')).toBeInTheDocument();
  });

  it('shows creation hint', () => {
    render(<NewLayoutCard onCreate={mockOnCreate} />);
    expect(screen.getByText('layouts.createNewLayoutHint')).toBeInTheDocument();
  });

  it('calls onCreate when clicked', () => {
    render(<NewLayoutCard onCreate={mockOnCreate} />);

    const button = screen.getByLabelText('layouts.newLayout');
    fireEvent.click(button);

    expect(mockOnCreate).toHaveBeenCalledTimes(1);
  });

  it('has dashed border styling', () => {
    const { container } = render(<NewLayoutCard onCreate={mockOnCreate} />);
    const button = container.querySelector('button');

    expect(button).toHaveClass('border-dashed');
  });

  it('shows hover state', () => {
    const { container } = render(<NewLayoutCard onCreate={mockOnCreate} />);
    const button = container.querySelector('button');

    expect(button).toHaveClass('hover:border-accent');
  });

  it('is accessible with aria-label', () => {
    render(<NewLayoutCard onCreate={mockOnCreate} />);

    const button = screen.getByLabelText('layouts.newLayout');
    expect(button).toBeInTheDocument();
  });

  it('renders plus icon', () => {
    const { container } = render(<NewLayoutCard onCreate={mockOnCreate} />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
  });
});
