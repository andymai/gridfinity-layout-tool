// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FractionalEdgeMismatchBanner } from './FractionalEdgeMismatchBanner';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('FractionalEdgeMismatchBanner', () => {
  it('renders the warning and match-drawer action', () => {
    render(<FractionalEdgeMismatchBanner onMatchDrawer={() => {}} />);
    expect(screen.getByText('binDesigner.fractionalEdgeMismatch')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'binDesigner.fractionalEdgeMatchDrawer' })
    ).toBeInTheDocument();
  });

  it('invokes onMatchDrawer when the button is clicked', async () => {
    const onMatchDrawer = vi.fn();
    render(<FractionalEdgeMismatchBanner onMatchDrawer={onMatchDrawer} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'binDesigner.fractionalEdgeMatchDrawer' })
    );

    expect(onMatchDrawer).toHaveBeenCalledTimes(1);
  });
});
