import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BodyTypeCards } from './BodyTypeCards';
import { BODY_TYPES } from './bodyType';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('BodyTypeCards', () => {
  it('offers every archetype as a card', () => {
    render(<BodyTypeCards value="standard" onChange={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(BODY_TYPES.length);
  });

  it('describes each archetype, not just names it', () => {
    render(<BodyTypeCards value="standard" onChange={vi.fn()} />);

    for (const type of BODY_TYPES) {
      expect(screen.getByText(`binDesigner.base.bodyType.${type}.description`)).toBeInTheDocument();
    }
  });

  it('marks exactly one card as chosen', () => {
    render(<BodyTypeCards value="spacer" onChange={vi.fn()} />);

    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
  });

  it('reports the chosen archetype', () => {
    const onChange = vi.fn();
    render(<BodyTypeCards value="standard" onChange={onChange} />);

    fireEvent.click(screen.getByText('binDesigner.spacer'));

    expect(onChange).toHaveBeenCalledWith('spacer');
  });

  it("shows only the chosen archetype's options", () => {
    const options = {
      spacer: <div data-testid="spacer-options" />,
      tray: <div data-testid="tray-options" />,
    };
    const { rerender } = render(
      <BodyTypeCards value="spacer" onChange={vi.fn()} options={options} />
    );

    expect(screen.getByTestId('spacer-options')).toBeInTheDocument();
    expect(screen.queryByTestId('tray-options')).not.toBeInTheDocument();

    rerender(<BodyTypeCards value="tray" onChange={vi.fn()} options={options} />);

    expect(screen.queryByTestId('spacer-options')).not.toBeInTheDocument();
    expect(screen.getByTestId('tray-options')).toBeInTheDocument();
  });

  it('groups the cards so the choice is announced as one control', () => {
    render(<BodyTypeCards value="standard" onChange={vi.fn()} />);

    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'binDesigner.base.bodyType');
  });
});
