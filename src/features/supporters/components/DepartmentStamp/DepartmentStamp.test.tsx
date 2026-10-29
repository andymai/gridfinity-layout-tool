import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DepartmentStamp } from './DepartmentStamp';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
const motion = { reduced: false };
vi.mock('@/shared/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => motion.reduced,
}));

describe('DepartmentStamp', () => {
  it('names the department it assigns', () => {
    render(<DepartmentStamp department="Spaghetti Incident Response" animate={false} />);
    expect(screen.getByText('supporters.panel.assignedTo')).toBeInTheDocument();
    expect(screen.getByText('Spaghetti Incident Response')).toBeInTheDocument();
  });

  it('slams down once when asked, and not under reduced motion', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const { unmount } = render(<DepartmentStamp department="X" animate />);
    expect(animate).toHaveBeenCalledTimes(1);
    unmount();
    motion.reduced = true;
    render(<DepartmentStamp department="X" animate />);
    expect(animate).toHaveBeenCalledTimes(1);
    motion.reduced = false;
  });
});
