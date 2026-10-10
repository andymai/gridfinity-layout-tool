import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PullTabSection } from './PullTabSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_PULL_TAB } from '@/shared/utils/pullTabPlan';

describe('PullTabSection', () => {
  beforeEach(() =>
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, pullTab: { ...DEFAULT_PULL_TAB, enabled: true } },
      ui: { ...DEFAULT_UI_STATE },
    })
  );
  it('offers exactly two wall choices and independent rounding controls', () => {
    render(<PullTabSection />);
    expect(screen.getByRole('button', { name: 'Width wall' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Depth wall' }));
    expect(useDesignerStore.getState().params.pullTab?.wall).toBe('depth');
    expect(screen.getByText('Top corner radius')).toBeDefined();
    expect(screen.getByText('Wall transition radius')).toBeDefined();
    expect(screen.getByText('Recess outside fillet')).toBeDefined();
    expect(screen.getByText('Recess inside fillet')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
  it('changes the common border and reports the resulting recess width', () => {
    render(<PullTabSection />);
    const input = screen.getByLabelText('Recess border width');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    expect(useDesignerStore.getState().params.pullTab?.recessBorder).toBe(2);
    expect(screen.getByText(/Recess width: 38.0 mm/)).toBeDefined();
  });
  it('changes the inside fillet independently of the outside fillet', () => {
    render(<PullTabSection />);
    const input = screen.getByLabelText('Recess inside fillet');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(useDesignerStore.getState().params.pullTab?.recessInsideRadius).toBe(0);
    expect(useDesignerStore.getState().params.pullTab?.recessEdgeRadius).toBe(0.4);
  });
  it('enables the optional back recess and constrains its shared depth', () => {
    render(<PullTabSection />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Back recess' }));
    expect(useDesignerStore.getState().params.pullTab?.backRecess).toBe(true);
    expect(screen.getByLabelText('Recess depth').getAttribute('max')).toBe('1.1');
    expect(useDesignerStore.getState().params.pullTab?.recessDepth).toBe(1);
  });
  it('accepts larger recess fillets and switches between mm and percent', () => {
    render(<PullTabSection />);
    for (const label of ['Recess outside fillet', 'Recess inside fillet']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '2' } });
      fireEvent.blur(screen.getByLabelText(label));
      expect(screen.getByLabelText(label).getAttribute('max')).toBe('6');
    }
    expect(useDesignerStore.getState().params.pullTab).toMatchObject({
      recessEdgeRadius: 2,
      recessInsideRadius: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: '%' }));
    fireEvent.change(screen.getByLabelText('Tab width'), { target: { value: '60' } });
    fireEvent.blur(screen.getByLabelText('Tab width'));
    expect(useDesignerStore.getState().params.pullTab).toMatchObject({
      widthMode: 'percent',
      widthPercent: 60,
    });
    fireEvent.click(screen.getByRole('button', { name: 'mm' }));
    expect(useDesignerStore.getState().params.pullTab).toMatchObject({
      widthMode: 'mm',
      width: 44.4,
    });
  });
});
