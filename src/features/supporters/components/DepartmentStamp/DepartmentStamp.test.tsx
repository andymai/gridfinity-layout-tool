import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DepartmentStamp } from './DepartmentStamp';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
const motion = { reduced: false };
vi.mock('@/shared/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => motion.reduced,
}));

beforeEach(() => localStorage.clear());

describe('DepartmentStamp', () => {
  it('names the department it assigns', () => {
    render(<DepartmentStamp department="Spaghetti Incident Response" />);
    expect(screen.getByText('supporters.panel.assignedTo')).toBeInTheDocument();
    expect(screen.getByText('Spaghetti Incident Response')).toBeInTheDocument();
  });

  it('slams down the first time it is shown, then never again', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const first = render(<DepartmentStamp department="X" />);
    expect(animate).toHaveBeenCalledTimes(1);
    first.unmount();
    render(<DepartmentStamp department="X" />);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('just sits there under reduced motion', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    motion.reduced = true;
    render(<DepartmentStamp department="X" />);
    expect(animate).not.toHaveBeenCalled();
    motion.reduced = false;
  });
});
