import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ColorSwatch } from './ColorSwatch';

describe('ColorSwatch', () => {
  it('applies the color as inline background', () => {
    render(<ColorSwatch color="#ff0000" aria-label="Red" />);
    expect(screen.getByRole('img', { name: 'Red' })).toHaveStyle({
      backgroundColor: '#ff0000',
    });
  });

  it('falls back to fallbackColor when color is null', () => {
    render(<ColorSwatch color={null} fallbackColor="#00ff00" aria-label="Hardware" />);
    expect(screen.getByRole('img', { name: 'Hardware' })).toHaveStyle({
      backgroundColor: '#00ff00',
    });
  });

  it('falls back to fallbackColor when color is undefined', () => {
    render(<ColorSwatch color={undefined} fallbackColor="#0000ff" aria-label="Screws" />);
    expect(screen.getByRole('img', { name: 'Screws' })).toHaveStyle({
      backgroundColor: '#0000ff',
    });
  });

  it('renders a neutral placeholder when both color and fallback are absent', () => {
    render(<ColorSwatch color={null} data-testid="swatch" />);
    const swatch = screen.getByTestId('swatch');
    expect(swatch.className).toContain('bg-surface-hover');
    expect(swatch.style.backgroundColor).toBe('');
  });

  it('renders as a dot by default', () => {
    render(<ColorSwatch color="#fff" data-testid="swatch" />);
    expect(screen.getByTestId('swatch').className).toContain('rounded-full');
  });

  it('applies square shape classes', () => {
    render(<ColorSwatch color="#fff" shape="square" data-testid="swatch" />);
    expect(screen.getByTestId('swatch').className).toContain('rounded-sm');
  });

  it('applies tile shape classes', () => {
    render(<ColorSwatch color="#fff" shape="tile" data-testid="swatch" />);
    expect(screen.getByTestId('swatch').className).toContain('rounded-lg');
  });

  it('renders at sm size by default', () => {
    render(<ColorSwatch color="#fff" data-testid="swatch" />);
    expect(screen.getByTestId('swatch').className).toContain('w-2.5');
  });

  it.each([
    ['md', 'w-3.5'],
    ['lg', 'w-4'],
    ['xl', 'w-10'],
  ] as const)('applies %s size classes', (size, expected) => {
    render(<ColorSwatch color="#fff" size={size} data-testid="swatch" />);
    expect(screen.getByTestId('swatch').className).toContain(expected);
  });

  it('exposes role img with accessible name when aria-label is provided', () => {
    render(<ColorSwatch color="#fff" aria-label="Electronics" />);
    const swatch = screen.getByRole('img', { name: 'Electronics' });
    expect(swatch).not.toHaveAttribute('aria-hidden');
  });

  it('is hidden from assistive tech when aria-label is omitted', () => {
    render(<ColorSwatch color="#fff" data-testid="swatch" />);
    const swatch = screen.getByTestId('swatch');
    expect(swatch).toHaveAttribute('aria-hidden', 'true');
    expect(swatch).not.toHaveAttribute('role');
  });

  it('merges className with variant classes', () => {
    render(<ColorSwatch color="#fff" className="custom-class" data-testid="swatch" />);
    const swatch = screen.getByTestId('swatch');
    expect(swatch).toHaveClass('custom-class');
    expect(swatch.className).toContain('shrink-0');
  });

  it('merges a custom style with the inline background', () => {
    render(<ColorSwatch color="#ff0000" style={{ opacity: 0.5 }} data-testid="swatch" />);
    const swatch = screen.getByTestId('swatch');
    expect(swatch).toHaveStyle({ backgroundColor: '#ff0000', opacity: 0.5 });
  });

  it('forwards ref to the span element', () => {
    const ref = vi.fn();
    render(<ColorSwatch color="#fff" ref={ref} />);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLSpanElement));
  });
});
