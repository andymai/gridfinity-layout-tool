import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BodyTypeTiles } from './BodyTypeTiles';
import { BODY_TYPES } from './bodyType';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('BodyTypeTiles', () => {
  it('offers every archetype as a tile', () => {
    render(<BodyTypeTiles value="standard" onChange={vi.fn()} />);

    expect(screen.getAllByRole('radio')).toHaveLength(BODY_TYPES.length);
  });

  it('describes the chosen archetype, and only it', () => {
    render(<BodyTypeTiles value="spacer" onChange={vi.fn()} />);

    expect(screen.getByText('binDesigner.base.bodyType.spacer.description')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.base.bodyType.standard.description')).toBeNull();
  });

  it('marks exactly one tile as chosen', () => {
    render(<BodyTypeTiles value="spacer" onChange={vi.fn()} />);

    const checked = screen
      .getAllByRole('radio')
      .filter((tile) => tile.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
  });

  it('reports the chosen archetype', () => {
    const onChange = vi.fn();
    render(<BodyTypeTiles value="standard" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'binDesigner.spacer' }));

    expect(onChange).toHaveBeenCalledWith('spacer');
  });

  it("shows only the chosen archetype's options", () => {
    const options = {
      spacer: <div data-testid="spacer-options" />,
      tray: <div data-testid="tray-options" />,
    };
    const { rerender } = render(
      <BodyTypeTiles value="spacer" onChange={vi.fn()} options={options} />
    );

    expect(screen.getByTestId('spacer-options')).toBeInTheDocument();
    expect(screen.queryByTestId('tray-options')).not.toBeInTheDocument();

    rerender(<BodyTypeTiles value="tray" onChange={vi.fn()} options={options} />);

    expect(screen.queryByTestId('spacer-options')).not.toBeInTheDocument();
    expect(screen.getByTestId('tray-options')).toBeInTheDocument();
  });

  it('groups the tiles so the choice is announced as one control', () => {
    render(<BodyTypeTiles value="standard" onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-label',
      'binDesigner.base.bodyType'
    );
  });
});
