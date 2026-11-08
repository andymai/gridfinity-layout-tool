import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorSurfacePicker } from './ColorSurfacePicker';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const segment = (choice: string) =>
  screen.getByRole('button', { name: `binDesigner.cutouts.color.${choice}` });

describe('ColorSurfacePicker', () => {
  it('shows all three choices at once, with only the value pressed', () => {
    render(<ColorSurfacePicker value="off" onChange={vi.fn()} ariaLabel="surface" />);

    expect(segment('off')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('floor')).toHaveAttribute('aria-pressed', 'false');
    expect(segment('floorAndWalls')).toHaveAttribute('aria-pressed', 'false');
  });

  it('presses nothing for a mixed selection', () => {
    render(<ColorSurfacePicker value={null} onChange={vi.fn()} ariaLabel="surface" />);

    for (const choice of ['off', 'floor', 'floorAndWalls']) {
      expect(segment(choice)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('reports the clicked choice', () => {
    const onChange = vi.fn();
    render(<ColorSurfacePicker value="off" onChange={onChange} ariaLabel="surface" />);

    fireEvent.click(segment('floor'));

    expect(onChange).toHaveBeenCalledWith('floor');
  });

  it('ignores a click on the pressed choice', () => {
    const onChange = vi.fn();
    render(<ColorSurfacePicker value="floor" onChange={onChange} ariaLabel="surface" />);

    fireEvent.click(segment('floor'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks every choice when disabled', () => {
    const onChange = vi.fn();
    render(<ColorSurfacePicker value="off" onChange={onChange} ariaLabel="surface" disabled />);

    fireEvent.click(segment('floorAndWalls'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
