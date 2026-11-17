import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLabelListStore } from '../../store/labelListStore';
import { LabelPrinterSettings } from './LabelPrinterSettings';

const initial = useLabelListStore.getState();

beforeEach(() => {
  localStorage.clear();
  useLabelListStore.setState(initial, true);
});

describe('LabelPrinterSettings', () => {
  it('offers tape lengths for a tape printer and stores the choice', async () => {
    render(<LabelPrinterSettings />);

    expect(screen.getByRole('combobox', { name: 'Label size' })).toHaveValue('12');
    await userEvent.click(screen.getByRole('radio', { name: '2U' }));
    expect(useLabelListStore.getState().tapeLength).toBe(2);
  });

  it('moves to the new printer default size and hides the length for die-cut labels', async () => {
    render(<LabelPrinterSettings />);

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Label printer' }),
      'niimbot-d'
    );

    expect(useLabelListStore.getState()).toMatchObject({
      printerId: 'niimbot-d',
      mediaId: '12x40',
    });
    expect(screen.getByRole('combobox', { name: 'Label size' })).toHaveValue('12x40');
    expect(screen.getByRole('option', { name: '15 × 30 mm label' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Length' })).toBeNull();
  });
});
