// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

afterEach(() => cleanup());

describe('StatusBadge', () => {
  it('shows a static success dot when idle', () => {
    const { container } = render(<StatusBadge state="idle" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-success');
    expect(badge.className).not.toContain('animate-');
  });

  it('animates while syncing', () => {
    const { container } = render(<StatusBadge state="syncing" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-info');
    expect(badge.className).toContain('animate-status-syncing');
    expect(badge.className).toContain('motion-reduce:animate-none');
  });

  it('breathes on error', () => {
    const { container } = render(<StatusBadge state="error" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-error');
    expect(badge.className).toContain('animate-status-error');
  });

  it('shows a static warning dot when offline', () => {
    const { container } = render(<StatusBadge state="offline" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-warning');
    expect(badge.className).not.toContain('animate-');
  });

  it('is decorative for screen readers', () => {
    const { container } = render(<StatusBadge state="idle" />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });
});
