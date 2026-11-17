import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadTestTypeMeasurer } from '@/test/testTypeMeasurer';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { LABEL_LIST_MAX, useLabelListStore } from '../../store/labelListStore';
import { LABEL_DETAIL_FONT, LABEL_NAME_FONT, planLabel } from '../../utils/planLabel';
import type { LabelPlan } from '../../utils/planLabel';
import { LabelListEditor } from './LabelListEditor';

let measurer: TypeMeasurer;
const initial = useLabelListStore.getState();

beforeAll(async () => {
  measurer = await loadTestTypeMeasurer([LABEL_NAME_FONT, LABEL_DETAIL_FONT]);
});

beforeEach(() => {
  localStorage.clear();
  useLabelListStore.setState(initial, true);
});

function plansFor(lengthMm: number): Map<string, LabelPlan> {
  return new Map(
    useLabelListStore
      .getState()
      .entries.map((entry) => [entry.id, planLabel(entry, { heightMm: 9, lengthMm }, measurer)])
  );
}

describe('LabelListEditor', () => {
  it('turns a pasted order into labels with their part numbers', async () => {
    const { rerender } = render(<LabelListEditor plans={new Map()} measurer={measurer} />);
    expect(screen.getByText('No labels yet. Type or paste a list above.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('textbox', { name: 'Add labels' }));
    await userEvent.paste('91290A113 Socket head screw\n90592A085 Hex nut');
    await userEvent.click(screen.getByRole('button', { name: 'Add to list' }));

    expect(
      useLabelListStore.getState().entries.map(({ name, detail }) => ({ name, detail }))
    ).toEqual([
      { name: 'Socket head screw', detail: '91290A113' },
      { name: 'Hex nut', detail: '90592A085' },
    ]);
    expect(screen.getByRole('textbox', { name: 'Add labels' })).toHaveValue('');

    rerender(<LabelListEditor plans={plansFor(36)} measurer={measurer} />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getAllByRole('textbox', { name: 'Second line' })[1]).toHaveValue('90592A085');
  });

  it('edits and removes a label', async () => {
    useLabelListStore.getState().addEntries([{ name: 'Nuts', detail: '' }]);
    render(<LabelListEditor plans={new Map()} measurer={measurer} />);

    const name = screen.getByRole('textbox', { name: 'Label text' });
    await userEvent.type(name, ' M4');
    expect(useLabelListStore.getState().entries[0].name).toBe('Nuts M4');

    await userEvent.click(screen.getByRole('button', { name: 'Remove label' }));
    expect(useLabelListStore.getState().entries).toEqual([]);
  });

  it('flags a label whose text does not fit', () => {
    useLabelListStore
      .getState()
      .addEntries([
        { name: 'Black-oxide alloy steel socket head screws with a long name', detail: '' },
      ]);
    render(<LabelListEditor plans={plansFor(12)} measurer={measurer} />);

    const row = screen.getByRole('listitem');
    expect(within(row).getByText(/Too long for this label/)).toBeInTheDocument();
    expect(within(row).getByRole('textbox', { name: 'Label text' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('adds nothing and says why when the paste would overfill the list', async () => {
    useLabelListStore
      .getState()
      .addEntries(Array.from({ length: LABEL_LIST_MAX - 1 }, () => ({ name: 'x', detail: '' })));
    render(<LabelListEditor plans={new Map()} measurer={null} />);

    await userEvent.click(screen.getByRole('textbox', { name: 'Add labels' }));
    await userEvent.paste('a\nb');
    await userEvent.click(screen.getByRole('button', { name: 'Add to list' }));

    expect(useLabelListStore.getState().entries).toHaveLength(LABEL_LIST_MAX - 1);
    expect(screen.getByRole('status')).toHaveTextContent(`up to ${LABEL_LIST_MAX} labels`);
    expect(screen.getByRole('textbox', { name: 'Add labels' })).toHaveValue('a\nb');
  });
});
