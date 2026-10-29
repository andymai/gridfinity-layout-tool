import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SupportersHeader } from './SupportersHeader';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const setup = (status: string | null = null) => {
  const props = { query: 'Ada', onQueryChange: vi.fn(), onFind: vi.fn(), status, onBack: vi.fn() };
  render(<SupportersHeader {...props} />);
  return props;
};

describe('SupportersHeader', () => {
  it('searches on submit and reports typing', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('supporters.find.placeholder'), {
      target: { value: 'Grace' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'supporters.find.submit' }));
    expect(props.onQueryChange).toHaveBeenCalledWith('Grace');
    expect(props.onFind).toHaveBeenCalledTimes(1);
  });

  it('shows the search result and goes back', () => {
    const props = setup('Ada is in Spaghetti Incident Response.');
    expect(screen.getByRole('status')).toHaveTextContent('Ada is in');
    fireEvent.click(screen.getByRole('button', { name: /supporters\.back/ }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
