// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SyncRing } from './SyncRing';

describe('SyncRing', () => {
  it('renders the initial inside the ring', () => {
    const { getByText } = render(<SyncRing state="idle" initial="A" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('applies the spin class while syncing', () => {
    const { container } = render(<SyncRing state="syncing" initial="A" />);
    const spinner = container.querySelector('.animate-sync-ring-spin');
    expect(spinner).toBeTruthy();
  });

  it('uses a dashed border when offline (no rotating animation)', () => {
    const { container } = render(<SyncRing state="offline" initial="A" />);
    expect(container.querySelector('.animate-sync-ring-spin')).toBeNull();
    const ring = container.querySelector('span > span');
    expect((ring as HTMLElement).style.border).toContain('dashed');
  });

  it('applies the breathing animation on error', () => {
    const { container } = render(<SyncRing state="error" initial="A" />);
    expect(container.querySelector('.animate-sync-ring-breath')).toBeTruthy();
  });

  it('renders a neutral border in the "none" (anonymous) state', () => {
    const { container } = render(<SyncRing state="none" initial="+" />);
    expect(container.querySelector('.animate-sync-ring-spin')).toBeNull();
    expect(container.querySelector('.animate-sync-ring-breath')).toBeNull();
  });
});
