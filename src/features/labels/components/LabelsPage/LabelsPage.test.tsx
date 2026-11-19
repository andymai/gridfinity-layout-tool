import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLabelListStore } from '../../store/labelListStore';
import { LabelsPage } from './LabelsPage';

vi.mock('@/shared/hooks/useTypeMeasurer', () => ({
  useTypeMeasurer: () => null,
  useTypeFontsFailed: () => false,
}));
vi.mock('@/shared/components/HeaderSupportLinks', () => ({
  HeaderSupportLinks: () => null,
}));

const initial = useLabelListStore.getState();

beforeEach(() => {
  localStorage.clear();
  useLabelListStore.setState(initial, true);
});

describe('LabelsPage', () => {
  it('puts the label maker on its own page, with the tools to leave it', () => {
    useLabelListStore.getState().addEntries([{ name: 'Nuts', detail: 'M3' }]);
    render(<LabelsPage />);

    expect(screen.getByRole('heading', { name: 'Labels' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('combobox', { name: 'Label printer' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Label text' })).toHaveValue('Nuts');
    expect(screen.getByText('Loading fonts…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  });
});
