import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaddingSchematic } from './PaddingSchematic';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { mm } from '@/core/types';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, params?: Record<string, unknown>): string => {
      if (key === 'baseplate.increasePadding' && typeof params?.label === 'string') {
        return `Increase ${params.label}`;
      }
      if (key === 'baseplate.decreasePadding' && typeof params?.label === 'string') {
        return `Decrease ${params.label}`;
      }
      return key;
    },
}));

describe('PaddingSchematic', () => {
  it('renders all four padding steppers (back, front, left, right)', () => {
    render(<PaddingSchematic baseplateParams={DEFAULT_BASEPLATE_PARAMS} updateParam={vi.fn()} />);
    expect(screen.getByLabelText('baseplate.paddingBack')).toBeInTheDocument();
    expect(screen.getByLabelText('baseplate.paddingFront')).toBeInTheDocument();
    expect(screen.getByLabelText('baseplate.paddingLeft')).toBeInTheDocument();
    expect(screen.getByLabelText('baseplate.paddingRight')).toBeInTheDocument();
  });

  it('shows current padding values in steppers', () => {
    const params = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingBack: mm(2),
      paddingFront: mm(3),
      paddingLeft: mm(1.5),
      paddingRight: mm(4.25),
    };
    render(<PaddingSchematic baseplateParams={params} updateParam={vi.fn()} />);
    expect(screen.getByLabelText('baseplate.paddingBack')).toHaveValue('2');
    expect(screen.getByLabelText('baseplate.paddingFront')).toHaveValue('3');
    expect(screen.getByLabelText('baseplate.paddingLeft')).toHaveValue('1.5');
    expect(screen.getByLabelText('baseplate.paddingRight')).toHaveValue('4.25');
  });

  it('calls updateParam with the correct key when each side is changed via typed input', () => {
    const updateParam = vi.fn();
    render(
      <PaddingSchematic baseplateParams={DEFAULT_BASEPLATE_PARAMS} updateParam={updateParam} />
    );

    const back = screen.getByLabelText('baseplate.paddingBack');
    fireEvent.focus(back);
    fireEvent.change(back, { target: { value: '7' } });
    fireEvent.keyDown(back, { key: 'Enter' });
    expect(updateParam).toHaveBeenCalledWith('paddingBack', 7);

    const left = screen.getByLabelText('baseplate.paddingLeft');
    fireEvent.focus(left);
    fireEvent.change(left, { target: { value: '2.5' } });
    fireEvent.keyDown(left, { key: 'Enter' });
    expect(updateParam).toHaveBeenCalledWith('paddingLeft', 2.5);
  });

  it('calls updateParam when increment buttons are clicked', () => {
    const updateParam = vi.fn();
    render(
      <PaddingSchematic baseplateParams={DEFAULT_BASEPLATE_PARAMS} updateParam={updateParam} />
    );
    fireEvent.click(screen.getByLabelText('Increase baseplate.paddingFront'));
    expect(updateParam).toHaveBeenCalledWith('paddingFront', 0.25);
  });
});
