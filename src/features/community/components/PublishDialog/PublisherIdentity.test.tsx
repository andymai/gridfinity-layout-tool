import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PublisherIdentity } from './PublisherIdentity';

describe('PublisherIdentity', () => {
  it('opens expanded for someone who has never chosen a name', () => {
    render(<PublisherIdentity value="" firstTime onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Public name/)).toBeInTheDocument();
    expect(screen.queryByText('Publishing as')).not.toBeInTheDocument();
  });

  it('collapses to a single line once a name is saved', () => {
    render(<PublisherIdentity value="andy" firstTime={false} onChange={vi.fn()} />);
    expect(screen.getByText('Publishing as')).toBeInTheDocument();
    expect(screen.getByText('andy')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Public name/)).not.toBeInTheDocument();
  });

  it('reopens the field on request, which the separate identity step never allowed', () => {
    render(<PublisherIdentity value="andy" firstTime={false} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByLabelText(/Public name/)).toHaveValue('andy');
  });

  it('reports every edit so the parent stays the source of truth', () => {
    const onChange = vi.fn();
    render(<PublisherIdentity value="andy" firstTime onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Public name/), { target: { value: 'ada' } });
    expect(onChange).toHaveBeenCalledWith('ada');
  });

  it('forces the field open when the server rejected the name', () => {
    render(
      <PublisherIdentity
        value="andy"
        firstTime={false}
        error="That name is not allowed."
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Public name/)).toBeInTheDocument();
    expect(screen.getByText('That name is not allowed.')).toBeInTheDocument();
  });

  it('will not let an edit collapse on an empty name', () => {
    const { rerender } = render(
      <PublisherIdentity value="andy" firstTime={false} onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Change'));
    rerender(<PublisherIdentity value="" firstTime={false} onChange={vi.fn()} />);
    expect(screen.getByText('Done')).toBeDisabled();
  });
});
