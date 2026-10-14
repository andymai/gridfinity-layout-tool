import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldLabel, Hint, OptionNotes, Readout } from './panelText';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('panelText', () => {
  it('renders a hint', () => {
    render(<Hint>Limited by the tray wall.</Hint>);
    expect(screen.getByText('Limited by the tray wall.')).toBeInTheDocument();
  });

  it('renders a readout with tabular figures so digits do not jitter as values change', () => {
    render(<Readout>1.5mm deep</Readout>);
    expect(screen.getByText('1.5mm deep')).toHaveClass('tabular-nums');
  });

  it("keeps a label's explanation behind its info dot", async () => {
    render(<FieldLabel info="Swings from this wall.">Hinge on</FieldLabel>);
    expect(screen.getByText('Hinge on')).toBeInTheDocument();
    expect(screen.queryByText('Swings from this wall.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'common.aboutLabel' }));
    expect(screen.getByText('Swings from this wall.')).toBeInTheDocument();
  });

  it('explains every option of a choice, not just the one picked', async () => {
    render(
      <FieldLabel
        info={
          <OptionNotes
            options={[
              { label: 'Snap', note: 'Clicks shut.' },
              { label: 'Magnets', note: 'Pulls shut.' },
            ]}
          />
        }
      >
        Holds shut with
      </FieldLabel>
    );
    await userEvent.click(screen.getByRole('button', { name: 'common.aboutLabel' }));
    expect(screen.getByText('Clicks shut.')).toBeInTheDocument();
    expect(screen.getByText('Pulls shut.')).toBeInTheDocument();
  });
});
