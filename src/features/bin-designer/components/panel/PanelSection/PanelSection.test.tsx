import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PanelSection } from './PanelSection';

describe('PanelSection', () => {
  it('renders its children', () => {
    render(
      <PanelSection>
        <span>contents</span>
      </PanelSection>
    );
    expect(screen.getByText('contents')).toBeInTheDocument();
  });

  it('exposes the help-jump anchor', () => {
    const { container } = render(<PanelSection helpTarget="bd-thing">x</PanelSection>);
    expect(container.querySelector('[data-help-target="bd-thing"]')).not.toBeNull();
  });

  it('owns the section padding and never draws its own divider', () => {
    const { container } = render(<PanelSection>x</PanelSection>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('px-4');
    expect(el.className).toContain('py-3');
    expect(el.className).not.toMatch(/border/);
  });

  it('appends a caller className onto the base padding', () => {
    const { container } = render(<PanelSection className="border-t">x</PanelSection>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('px-4');
    expect(el.className).toContain('border-t');
  });
});
