import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SelectableCard } from './SelectableCard';

describe('SelectableCard', () => {
  it('renders as a radio with the label and reflects selection', () => {
    render(<SelectableCard selected label="Dark" onSelect={vi.fn()} />);
    const radio = screen.getByRole('radio', { name: 'Dark' });
    expect(radio).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('is unchecked when not selected', () => {
    render(<SelectableCard selected={false} label="Light" onSelect={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<SelectableCard selected={false} label="System" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders an optional description and preview', () => {
    render(
      <SelectableCard
        selected={false}
        label="English"
        description="English"
        preview={<span data-testid="preview" />}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });
});
