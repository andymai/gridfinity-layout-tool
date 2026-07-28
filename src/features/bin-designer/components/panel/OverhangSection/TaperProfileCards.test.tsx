import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaperProfileCards } from './TaperProfileCards';

const labels = { chamferLabel: 'Chamfer', filletLabel: 'Fillet', groupLabel: 'Profile' };

describe('TaperProfileCards', () => {
  it('exposes both profiles as radios in a labelled group', () => {
    render(<TaperProfileCards value="chamfer" onChange={vi.fn()} {...labels} />);
    expect(screen.getByRole('radiogroup', { name: 'Profile' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('marks only the active profile as checked', () => {
    render(<TaperProfileCards value="fillet" onChange={vi.fn()} {...labels} />);
    expect(screen.getByRole('radio', { name: 'Chamfer' }).getAttribute('aria-checked')).toBe(
      'false'
    );
    expect(screen.getByRole('radio', { name: 'Fillet' }).getAttribute('aria-checked')).toBe('true');
  });

  it('reports the picked profile', () => {
    const onChange = vi.fn();
    render(<TaperProfileCards value="chamfer" onChange={onChange} {...labels} />);
    screen.getByRole('radio', { name: 'Fillet' }).click();
    expect(onChange).toHaveBeenCalledWith('fillet');
  });

  it('draws a different cross-section per profile', () => {
    const { container } = render(
      <TaperProfileCards value="chamfer" onChange={vi.fn()} {...labels} />
    );
    // The band edge is what distinguishes the two: chamfer is a straight
    // segment, fillet an arc. Without that the cards would be interchangeable.
    const paths = [...container.querySelectorAll('path')].map((p) => p.getAttribute('d') ?? '');
    expect(paths.some((d) => d.includes('A'))).toBe(true);
    expect(paths.filter((d) => d.startsWith('M34 4')).length).toBe(2);
  });

  it('moves the selection with the arrow keys', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaperProfileCards value="chamfer" onChange={onChange} {...labels} />
    );
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('fillet');
    // Roving tabindex: only the active card is reachable by Tab.
    const tabbable = [...container.querySelectorAll('[role="radio"]')].filter(
      (el) => el.getAttribute('tabindex') === '0'
    );
    expect(tabbable).toHaveLength(1);
  });

  it('hides the drawings from assistive tech, leaving the text label', () => {
    const { container } = render(
      <TaperProfileCards value="chamfer" onChange={vi.fn()} {...labels} />
    );
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
