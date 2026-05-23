import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaddingAnchor } from './PaddingAnchor';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('PaddingAnchor', () => {
  it('renders nine radio buttons in a radiogroup', () => {
    render(<PaddingAnchor value="custom" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(9);
  });

  it('marks the selected anchor with aria-checked=true and others false', () => {
    render(<PaddingAnchor value="tr" onChange={vi.fn()} />);
    const tr = screen.getByLabelText('baseplate.paddingAnchor.tr');
    expect(tr).toHaveAttribute('aria-checked', 'true');
    const c = screen.getByLabelText('baseplate.paddingAnchor.c');
    expect(c).toHaveAttribute('aria-checked', 'false');
  });

  it('no anchor is checked when value is "custom"', () => {
    render(<PaddingAnchor value="custom" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    for (const r of radios) expect(r).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the clicked anchor value', () => {
    const onChange = vi.fn();
    render(<PaddingAnchor value="custom" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('baseplate.paddingAnchor.bl'));
    expect(onChange).toHaveBeenCalledWith('bl');
  });

  it('arrow keys move selection within the 3×3 grid', () => {
    const onChange = vi.fn();
    render(<PaddingAnchor value="c" onChange={onChange} />);
    const center = screen.getByLabelText('baseplate.paddingAnchor.c');
    fireEvent.keyDown(center, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('mr');
    fireEvent.keyDown(center, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('tc');
    fireEvent.keyDown(center, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('bc');
    fireEvent.keyDown(center, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('ml');
  });

  it('arrow keys at the grid edge do not fire onChange', () => {
    const onChange = vi.fn();
    render(<PaddingAnchor value="tl" onChange={onChange} />);
    const tl = screen.getByLabelText('baseplate.paddingAnchor.tl');
    fireEvent.keyDown(tl, { key: 'ArrowLeft' });
    fireEvent.keyDown(tl, { key: 'ArrowUp' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('roving tabindex: only the selected anchor is in tab order', () => {
    render(<PaddingAnchor value="mr" onChange={vi.fn()} />);
    for (const radio of screen.getAllByRole('radio')) {
      const expected =
        radio.getAttribute('aria-label') === 'baseplate.paddingAnchor.mr' ? '0' : '-1';
      expect(radio).toHaveAttribute('tabindex', expected);
    }
  });

  it('roving tabindex: when value is "custom", only the first anchor (tl) is tabbable', () => {
    render(<PaddingAnchor value="custom" onChange={vi.fn()} />);
    for (const radio of screen.getAllByRole('radio')) {
      const expected =
        radio.getAttribute('aria-label') === 'baseplate.paddingAnchor.tl' ? '0' : '-1';
      expect(radio).toHaveAttribute('tabindex', expected);
    }
  });

  it('shows clamp warning badge only when showClampWarning is true', () => {
    const { rerender } = render(
      <PaddingAnchor value="tl" onChange={vi.fn()} showClampWarning={false} />
    );
    expect(screen.queryByLabelText('baseplate.paddingAnchor.clampedWarning')).toBeNull();
    rerender(<PaddingAnchor value="tl" onChange={vi.fn()} showClampWarning={true} />);
    expect(screen.getByLabelText('baseplate.paddingAnchor.clampedWarning')).toBeInTheDocument();
  });
});
