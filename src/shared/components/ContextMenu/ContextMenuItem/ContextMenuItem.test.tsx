import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenuItem } from './ContextMenuItem';

describe('ContextMenuItem', () => {
  const mockIcon = <svg data-testid="test-icon" />;

  it('renders label text', () => {
    render(<ContextMenuItem icon={mockIcon} label="Edit" onClick={vi.fn()} />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<ContextMenuItem icon={mockIcon} label="Test" onClick={vi.fn()} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<ContextMenuItem icon={mockIcon} label="Click Me" onClick={handleClick} />);
    fireEvent.click(screen.getByRole('menuitem'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies destructive styling when destructive prop is true', () => {
    render(<ContextMenuItem icon={mockIcon} label="Delete" onClick={vi.fn()} destructive />);
    expect(screen.getByRole('menuitem')).toHaveClass('text-error');
  });

  it('does not apply destructive styling by default', () => {
    render(<ContextMenuItem icon={mockIcon} label="Edit" onClick={vi.fn()} />);
    const button = screen.getByRole('menuitem');
    expect(button).toHaveClass('text-content');
    expect(button).not.toHaveClass('text-error');
  });

  it('is disabled when disabled prop is true', () => {
    render(<ContextMenuItem icon={mockIcon} label="Disabled" onClick={vi.fn()} disabled />);
    expect(screen.getByRole('menuitem')).toBeDisabled();
  });

  it('is enabled by default', () => {
    render(<ContextMenuItem icon={mockIcon} label="Enabled" onClick={vi.fn()} />);
    expect(screen.getByRole('menuitem')).toBeEnabled();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<ContextMenuItem icon={mockIcon} label="Disabled" onClick={handleClick} disabled />);
    fireEvent.click(screen.getByRole('menuitem'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('has menuitem role', () => {
    render(<ContextMenuItem icon={mockIcon} label="Menu Item" onClick={vi.fn()} />);
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
  });
});
