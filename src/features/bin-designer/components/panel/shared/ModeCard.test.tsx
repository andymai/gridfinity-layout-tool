import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeCard } from './ModeCard';

function renderCard(overrides: Partial<Parameters<typeof ModeCard>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <ModeCard
      icon={<div data-testid="icon" />}
      title="Standard"
      description="Feet, floor and walls"
      selected={false}
      onSelect={onSelect}
      {...overrides}
    />
  );
  return { onSelect };
}

describe('ModeCard', () => {
  it('renders the icon, title and description', () => {
    renderCard();

    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Feet, floor and walls')).toBeInTheDocument();
  });

  it('calls onSelect when the header is clicked', () => {
    const { onSelect } = renderCard();

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('reports selection to assistive tech, not just through colour', () => {
    const { rerender } = render(
      <ModeCard icon={null} title="Standard" description="d" selected={false} onSelect={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<ModeCard icon={null} title="Standard" description="d" selected onSelect={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders children only while selected', () => {
    const { rerender } = render(
      <ModeCard icon={null} title="Standard" description="d" selected={false} onSelect={vi.fn()}>
        <div data-testid="options" />
      </ModeCard>
    );
    expect(screen.queryByTestId('options')).not.toBeInTheDocument();

    rerender(
      <ModeCard icon={null} title="Standard" description="d" selected onSelect={vi.fn()}>
        <div data-testid="options" />
      </ModeCard>
    );
    expect(screen.getByTestId('options')).toBeInTheDocument();
  });

  it('keeps the options outside the button so their controls stay valid HTML', () => {
    const onSelect = vi.fn();
    render(
      <ModeCard icon={null} title="Standard" description="d" selected onSelect={onSelect}>
        <button type="button" data-testid="nested">
          nested
        </button>
      </ModeCard>
    );

    fireEvent.click(screen.getByTestId('nested'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders a badge beside the title when given one', () => {
    renderCard({ badge: <span data-testid="badge" /> });

    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('marks the selected card on the wrapper', () => {
    renderCard({ selected: true });

    const wrapper = screen.getByRole('button').parentElement;
    expect(wrapper?.className).toContain('border-accent');
  });
});
