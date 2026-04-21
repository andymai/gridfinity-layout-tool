import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureGate } from './FeatureGate';

describe('FeatureGate', () => {
  it('renders children unchanged when not disabled', () => {
    render(
      <FeatureGate disabled={false} reason="nope">
        <button>Click me</button>
      </FeatureGate>
    );
    const btn = screen.getByRole('button', { name: 'Click me' });
    const wrapper = btn.parentElement!;
    // `inert` is absent and the wrapper has no dimming class.
    expect(wrapper.hasAttribute('inert')).toBe(false);
    expect(wrapper.className).toBe('');
    expect(wrapper.getAttribute('aria-disabled')).toBe('false');
    expect(wrapper.getAttribute('title')).toBeNull();
  });

  it('marks descendants inert and shows the reason tooltip when disabled', () => {
    render(
      <FeatureGate disabled reason="custom shapes can’t do this">
        <button>Blocked</button>
      </FeatureGate>
    );
    const wrapper = screen.getByRole('button', { name: 'Blocked' }).parentElement!;
    expect(wrapper.hasAttribute('inert')).toBe(true);
    expect(wrapper.getAttribute('title')).toBe('custom shapes can’t do this');
    expect(wrapper.getAttribute('aria-disabled')).toBe('true');
    expect(wrapper.className).toContain('opacity-50');
    expect(wrapper.className).toContain('cursor-not-allowed');
  });
});
