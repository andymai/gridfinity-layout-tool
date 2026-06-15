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
    render(
      <PaddingSchematic
        baseplateParams={DEFAULT_BASEPLATE_PARAMS}
        updateParam={vi.fn()}
        updateParams={vi.fn()}
      />
    );
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
    render(
      <PaddingSchematic baseplateParams={params} updateParam={vi.fn()} updateParams={vi.fn()} />
    );
    expect(screen.getByLabelText('baseplate.paddingBack')).toHaveValue(2);
    expect(screen.getByLabelText('baseplate.paddingFront')).toHaveValue(3);
    expect(screen.getByLabelText('baseplate.paddingLeft')).toHaveValue(1.5);
    expect(screen.getByLabelText('baseplate.paddingRight')).toHaveValue(4.25);
  });

  it('calls updateParam with the correct key when each side is changed via typed input', () => {
    const updateParam = vi.fn();
    render(
      <PaddingSchematic
        baseplateParams={DEFAULT_BASEPLATE_PARAMS}
        updateParam={updateParam}
        updateParams={vi.fn()}
      />
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
      <PaddingSchematic
        baseplateParams={DEFAULT_BASEPLATE_PARAMS}
        updateParam={updateParam}
        updateParams={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Increase baseplate.paddingFront'));
    expect(updateParam).toHaveBeenCalledWith('paddingFront', 0.25);
  });

  it('picking the anchor redistributes current X/Y padding sums in a single batch update', () => {
    const updateParams = vi.fn();
    const params = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingBack: mm(5),
      paddingFront: mm(15),
      paddingLeft: mm(10),
      paddingRight: mm(10),
    };
    render(
      <PaddingSchematic
        baseplateParams={params}
        updateParam={vi.fn()}
        updateParams={updateParams}
      />
    );

    fireEvent.click(screen.getByLabelText('baseplate.paddingAnchor.tl'));

    expect(updateParams).toHaveBeenCalledWith({
      paddingLeft: 0,
      paddingRight: 20,
      paddingBack: 0,
      paddingFront: 20,
      paddingAnchor: 'tl',
    });
  });

  it('editing a single side flips paddingAnchor to "custom" alongside the value update', () => {
    const updateParam = vi.fn();
    const updateParams = vi.fn();
    const params = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingAnchor: 'tl' as const,
    };
    render(
      <PaddingSchematic
        baseplateParams={params}
        updateParam={updateParam}
        updateParams={updateParams}
      />
    );

    fireEvent.click(screen.getByLabelText('Increase baseplate.paddingRight'));

    expect(updateParams).toHaveBeenCalledWith({
      paddingRight: 0.25,
      paddingAnchor: 'custom',
    });
    expect(updateParam).not.toHaveBeenCalled();
  });

  it('shows the clamp warning after an anchor pick that exceeds PADDING_MAX', () => {
    const params = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: mm(95),
      paddingRight: mm(95),
    };
    render(
      <PaddingSchematic baseplateParams={params} updateParam={vi.fn()} updateParams={vi.fn()} />
    );

    expect(screen.queryByLabelText('baseplate.paddingAnchor.clampedWarning')).toBeNull();
    fireEvent.click(screen.getByLabelText('baseplate.paddingAnchor.tl'));
    expect(screen.getByLabelText('baseplate.paddingAnchor.clampedWarning')).toBeInTheDocument();
  });

  it('clears the clamp warning when a padding stepper is edited', () => {
    const params = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingLeft: mm(95),
      paddingRight: mm(95),
    };
    render(
      <PaddingSchematic baseplateParams={params} updateParam={vi.fn()} updateParams={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('baseplate.paddingAnchor.tl'));
    expect(screen.getByLabelText('baseplate.paddingAnchor.clampedWarning')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Increase baseplate.paddingFront'));
    expect(screen.queryByLabelText('baseplate.paddingAnchor.clampedWarning')).toBeNull();
  });

  it('shows the "Custom" caption only when the anchor is custom', () => {
    const { rerender } = render(
      <PaddingSchematic
        baseplateParams={{ ...DEFAULT_BASEPLATE_PARAMS, paddingAnchor: 'custom' }}
        updateParam={vi.fn()}
        updateParams={vi.fn()}
      />
    );
    expect(screen.getByText('baseplate.paddingAnchor.custom')).toBeInTheDocument();

    rerender(
      <PaddingSchematic
        baseplateParams={{ ...DEFAULT_BASEPLATE_PARAMS, paddingAnchor: 'tl' }}
        updateParam={vi.fn()}
        updateParams={vi.fn()}
      />
    );
    expect(screen.queryByText('baseplate.paddingAnchor.custom')).toBeNull();
  });

  it('does not touch paddingAnchor when already custom (uses single-key update)', () => {
    const updateParam = vi.fn();
    const updateParams = vi.fn();
    const params = {
      ...DEFAULT_BASEPLATE_PARAMS,
      paddingAnchor: 'custom' as const,
    };
    render(
      <PaddingSchematic
        baseplateParams={params}
        updateParam={updateParam}
        updateParams={updateParams}
      />
    );

    fireEvent.click(screen.getByLabelText('Increase baseplate.paddingRight'));

    expect(updateParam).toHaveBeenCalledWith('paddingRight', 0.25);
    expect(updateParams).not.toHaveBeenCalled();
  });
});
