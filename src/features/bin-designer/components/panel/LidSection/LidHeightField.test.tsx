import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LidHeightField } from './LidHeightField';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { lidTopAboveRimMm } from '@/shared/printSettings/assembledHeight';

function seed(
  lid: Partial<typeof DEFAULT_BIN_PARAMS.lid> = {},
  base: Partial<typeof DEFAULT_BIN_PARAMS.base> = {}
) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, ...base },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid },
    },
    ui: { ...DEFAULT_UI_STATE },
  });
}

const lid = () => useDesignerStore.getState().params.lid;
const unitSwitch = () => screen.getByRole('radiogroup', { name: 'Lid height unit' });

describe('LidHeightField', () => {
  beforeEach(() => {
    seed();
  });

  it('starts in millimetres', () => {
    render(<LidHeightField />);
    expect(screen.getByLabelText('Extra lid height in millimeters')).toBeInTheDocument();
    expect(within(unitSwitch()).getByRole('radio', { name: 'mm' })).toBeChecked();
  });

  it('switches to whole units and lines the lid up with a bin one unit taller', () => {
    render(<LidHeightField />);
    fireEvent.click(within(unitSwitch()).getByRole('radio', { name: 'u' }));
    expect(lid().heightUnits).toBe(1);
    const { params } = useDesignerStore.getState();
    expect(lidTopAboveRimMm(params)).toBeCloseTo(params.heightUnitMm, 6);
    expect(screen.getByLabelText('Lid height in height units')).toHaveValue(1);
    expect(screen.getByText('Level with the rim of a bin 1u taller')).toBeInTheDocument();
  });

  it('rounds a taller lid up to the next unit, never down', () => {
    seed({ extraHeightMm: 5 });
    render(<LidHeightField />);
    fireEvent.click(within(unitSwitch()).getByRole('radio', { name: 'u' }));
    expect(lid().heightUnits).toBe(2);
  });

  it('takes whole units and holds them inside what the lid can reach', () => {
    seed({ heightUnits: 1 });
    render(<LidHeightField />);
    const input = screen.getByRole('spinbutton', { name: 'Lid height in height units' });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);
    expect(lid().heightUnits).toBe(3);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(lid().heightUnits).toBe(14);
  });

  it('keeps the lid where it is when switching back to millimetres', () => {
    seed({ heightUnits: 2 });
    useDesignerStore.getState().updateLid({});
    const sized = lid().extraHeightMm;
    render(<LidHeightField />);
    fireEvent.click(within(unitSwitch()).getByRole('radio', { name: 'mm' }));
    expect(lid().heightUnits).toBeUndefined();
    expect(lid().extraHeightMm).toBe(sized);
  });

  it('leaves a lid at the millimetre cap in millimetres', () => {
    seed({ extraHeightMm: 100 });
    render(<LidHeightField />);
    fireEvent.click(within(unitSwitch()).getByRole('radio', { name: 'u' }));
    expect(lid().heightUnits).toBeUndefined();
    expect(lid().extraHeightMm).toBe(100);
  });

  it('drops stored units when millimetres are edited while no lid seats', () => {
    seed({ heightUnits: 2 }, { stackingLip: false });
    render(<LidHeightField />);
    const input = screen.getByRole('spinbutton', { name: 'Extra lid height in millimeters' });
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);
    expect(lid().heightUnits).toBeUndefined();
    useDesignerStore.getState().updateBase({ stackingLip: true });
    expect(lid().extraHeightMm).toBe(12);
  });

  it('offers no units when no lid seats on the rim', () => {
    seed({}, { stackingLip: false });
    render(<LidHeightField />);
    expect(screen.queryByRole('radiogroup', { name: 'Lid height unit' })).toBeNull();
  });
});
