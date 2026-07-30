import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { binId, gridUnits } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import { BinLabelField } from './BinLabelField';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));
import { trackEvent } from '@/shared/analytics/posthog';

describe('BinLabelField', () => {
  beforeEach(() => vi.clearAllMocks());

  const target = createTestBin({ id: binId('t'), x: gridUnits(2), label: '' });
  const bins = [
    target,
    createTestBin({ id: binId('a'), x: gridUnits(0), label: 'M3 screws' }),
    createTestBin({ id: binId('b'), x: gridUnits(1), label: 'M4 screws' }),
  ];

  it('predicts the next label in a series and tags the reason', () => {
    render(<BinLabelField bin={target} bins={bins} onChange={vi.fn()} variant="desktop" />);
    const input = screen.getByRole('combobox', { name: 'Bin label' });

    fireEvent.focus(input);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('M5 screws')).toBeInTheDocument();
    expect(within(listbox).getByText('next in set')).toBeInTheDocument();
  });

  it('commits a chosen suggestion and reports acceptance', () => {
    const onChange = vi.fn();
    render(<BinLabelField bin={target} bins={bins} onChange={onChange} variant="desktop" />);
    const input = screen.getByRole('combobox', { name: 'Bin label' });

    fireEvent.focus(input);
    const option = within(screen.getByRole('listbox')).getByText('M5 screws');
    fireEvent.mouseDown(option);
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('M5 screws');
    expect(trackEvent).toHaveBeenCalledWith(
      'label_suggestion_accepted',
      expect.objectContaining({ reason: 'nextInSet', via_ghost: false })
    );
  });

  it('forwards typing to onChange', () => {
    const onChange = vi.fn();
    render(<BinLabelField bin={target} bins={bins} onChange={onChange} variant="desktop" />);
    const input = screen.getByRole('combobox', { name: 'Bin label' });
    fireEvent.change(input, { target: { value: 'scr' } });
    expect(onChange).toHaveBeenCalledWith('scr');
  });

  it('disables the inline ghost on mobile', () => {
    render(<BinLabelField bin={target} bins={bins} onChange={vi.fn()} variant="mobile" />);
    const input = screen.getByRole('combobox', { name: 'Bin label' });
    fireEvent.focus(input);
    // The ghost overlay would duplicate the predicted text outside the listbox.
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('M5 screws')).toBeInTheDocument();
    // Only the listbox copy exists — no ghost overlay.
    expect(screen.getAllByText('M5 screws')).toHaveLength(1);
  });
});
