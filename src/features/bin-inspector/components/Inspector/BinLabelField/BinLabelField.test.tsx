import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemo, useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { binId, gridUnits } from '@/core/types';
import type { Bin } from '@/core/types';
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

  describe('Enter after typing', () => {
    function TypedField({ initial }: { initial: Bin }) {
      const [label, setLabel] = useState(initial.label);
      const bin = useMemo(() => ({ ...initial, label }), [initial, label]);
      const layoutBins = useMemo(() => [bin], [bin]);
      return <BinLabelField bin={bin} bins={layoutBins} onChange={setLabel} variant="desktop" />;
    }

    function typeThenEnter(text: string) {
      render(<TypedField initial={createTestBin({ id: binId('t'), label: '' })} />);
      const input = screen.getByRole('combobox', { name: 'Bin label' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: text } });
      const topRow = within(screen.getByRole('listbox')).getAllByRole('option')[0];
      const topSuggestion = topRow.querySelector('span')?.textContent;
      fireEvent.keyDown(input, { key: 'Enter' });
      return { input, topSuggestion };
    }

    it('keeps "Drill bit" instead of taking an unrelated top suggestion', () => {
      const { input, topSuggestion } = typeThenEnter('Drill bit');

      expect(topSuggestion).toBe('Screw');
      expect(input).toHaveValue('Drill bit');
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('keeps "Drill bits" instead of taking the near-match "Drill bit"', () => {
      const { input, topSuggestion } = typeThenEnter('Drill bits');

      expect(topSuggestion).toBe('Drill bit');
      expect(input).toHaveValue('Drill bits');
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('takes a suggestion that the arrow keys highlight', () => {
      render(<TypedField initial={createTestBin({ id: binId('t'), label: '' })} />);
      const input = screen.getByRole('combobox', { name: 'Bin label' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Drill bits' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input).toHaveValue('Drill bit');
      expect(trackEvent).toHaveBeenCalledWith(
        'label_suggestion_accepted',
        expect.objectContaining({ rank: 0, via_ghost: false })
      );
    });
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
