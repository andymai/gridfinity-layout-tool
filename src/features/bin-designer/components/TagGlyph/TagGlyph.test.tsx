// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TagGlyph } from './TagGlyph';

describe('TagGlyph', () => {
  it('renders nothing without an appearance', () => {
    const { container } = render(<TagGlyph appearance={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the icon when set', () => {
    const { container } = render(<TagGlyph appearance={{ icon: '🔧', color: '#f87171' }} />);
    expect(container.textContent).toBe('🔧');
  });

  it('falls back to a color dot when only a color is set', () => {
    const { container } = render(<TagGlyph appearance={{ color: '#f87171' }} />);
    const dot = container.querySelector('span');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('style')).toContain('background-color');
  });
});
