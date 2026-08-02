import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardSizeEditor } from './CardSizeEditor';
import { DEFAULT_CARD_SIZE } from '@/features/scan-capture/cardSize';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function setup(size = DEFAULT_CARD_SIZE) {
  const onChange = vi.fn();
  render(<CardSizeEditor size={size} onChange={onChange} />);
  return { onChange };
}

function open(): void {
  fireEvent.click(screen.getByText('scan.cardSize.change'));
}

describe('CardSizeEditor', () => {
  it('shows the size in effect without opening the fields', () => {
    setup();
    expect(screen.getByText('scan.cardSize.value')).toBeInTheDocument();
    expect(screen.queryByLabelText('scan.cardSize.longSide')).toBeNull();
  });

  it('commits a measured side as soon as it parses', () => {
    const { onChange } = setup();
    open();

    fireEvent.change(screen.getByLabelText('scan.cardSize.longSide'), {
      target: { value: '85.72' },
    });

    expect(onChange).toHaveBeenCalledWith({ longMm: 85.72, shortMm: 53.98 });
  });

  it('accepts a comma decimal separator', () => {
    const { onChange } = setup();
    open();

    fireEvent.change(screen.getByLabelText('scan.cardSize.shortSide'), {
      target: { value: '54,03' },
    });

    expect(onChange).toHaveBeenCalledWith({ longMm: 85.6, shortMm: 54.03 });
  });

  it('stays silent while a field is mid-edit but flags an impossible size', () => {
    const { onChange } = setup();
    open();
    const longSide = screen.getByLabelText('scan.cardSize.longSide');

    fireEvent.change(longSide, { target: { value: '' } });
    expect(screen.queryByText('scan.cardSize.range')).toBeNull();

    fireEvent.change(longSide, { target: { value: '856' } });
    expect(screen.getByText('scan.cardSize.range')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers the standard card only once a custom one is in effect', () => {
    const { onChange } = setup({ longMm: 85.72, shortMm: 54.03 });
    open();

    fireEvent.click(screen.getByText('scan.cardSize.useStandard'));

    expect(onChange).toHaveBeenCalledWith(DEFAULT_CARD_SIZE);
  });

  it('hides the revert action while the standard card is in effect', () => {
    setup();
    open();
    expect(screen.queryByText('scan.cardSize.useStandard')).toBeNull();
  });

  it('collapses the fields again', () => {
    setup();
    open();
    expect(screen.getByLabelText('scan.cardSize.longSide')).toBeInTheDocument();

    fireEvent.click(screen.getByText('scan.cardSize.close'));

    expect(screen.queryByLabelText('scan.cardSize.longSide')).toBeNull();
  });
});
