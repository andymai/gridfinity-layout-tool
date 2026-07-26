import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpandedFootprint } from './ExpandedFootprint';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { gridUnits } from '@/core/types';
import type { Bin, Layout, OverhangConfig } from '@/core/types';

const updateBin = vi.fn();
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ updateBin }),
}));

function layout(overrides: Partial<Layout> = {}): Layout {
  return { ...createTestLayout(), gridUnitMm: 42, ...overrides } as Layout;
}

function bin(overhang?: OverhangConfig): Bin {
  return createTestBin({ x: gridUnits(0), y: gridUnits(0), width: 2, depth: 12, overhang });
}

describe('ExpandedFootprint', () => {
  beforeEach(() => {
    updateBin.mockClear();
  });

  it('renders nothing for a bin with no explicit overhang', () => {
    const { container } = render(<ExpandedFootprint bin={bin()} layout={layout()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the overhang is disabled or all-zero', () => {
    const disabled = render(
      <ExpandedFootprint
        bin={bin({ enabled: false, left: 7, right: 7, front: 0, back: 0 })}
        layout={layout()}
      />
    );
    expect(disabled.container.firstChild).toBeNull();

    const zero = render(
      <ExpandedFootprint
        bin={bin({ enabled: true, left: 0, right: 0, front: 0, back: 0 })}
        layout={layout()}
      />
    );
    expect(zero.container.firstChild).toBeNull();
  });

  // The number the whole feature exists for: a 2u bin reading as 98mm wide.
  it('leads with the true outer size in mm', () => {
    render(
      <ExpandedFootprint
        bin={bin({ enabled: true, left: 0, right: 14, front: 0, back: 0 })}
        layout={layout()}
      />
    );
    expect(screen.getByText('98 × 504 mm')).toBeInTheDocument();
  });

  it('uses the Y grid pitch for depth on a non-square grid', () => {
    render(
      <ExpandedFootprint
        bin={bin({ enabled: true, left: 0, right: 14, front: 0, back: 0 })}
        layout={layout({ gridUnitMmY: 21 })}
      />
    );
    expect(screen.getByText('98 × 252 mm')).toBeInTheDocument();
  });

  it('clears the overhang via Reset rather than relying on undo', () => {
    const b = bin({ enabled: true, left: 0, right: 14, front: 0, back: 0 });
    render(<ExpandedFootprint bin={b} layout={layout()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(updateBin).toHaveBeenCalledWith(b.id, { overhang: null });
  });
});
