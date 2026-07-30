import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtendToMarginToggle } from './ExtendToMarginToggle';
import { createTestBin } from '@/test/testUtils';
import { designId, gridUnits, heightUnits, mm } from '@/core/types';
import type { Bin, Drawer, StoredBaseplateParams } from '@/core/types';

const updateBin = vi.fn();
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ updateBin }),
}));

const DRAWER: Drawer = { width: gridUnits(5), depth: gridUnits(4), height: heightUnits(6) };

function baseplate(overrides: Partial<StoredBaseplateParams> = {}): StoredBaseplateParams {
  return {
    magnetHoles: false,
    magnetDiameter: mm(6),
    magnetDepth: mm(2),
    paddingLeft: mm(0),
    paddingRight: mm(0),
    paddingFront: mm(0),
    paddingBack: mm(0),
    ...overrides,
  };
}

function edgeBin(overrides: Partial<Bin> = {}): Bin {
  // Bottom-left corner, linked → abuts the left/front edges.
  return createTestBin({
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    linkedDesignId: designId('d1'),
    ...overrides,
  });
}

describe('ExtendToMarginToggle', () => {
  beforeEach(() => {
    updateBin.mockClear();
  });

  it('renders nothing for an interior bin (no adjacent margin)', () => {
    const { container } = render(
      <ExtendToMarginToggle
        bin={edgeBin({ x: gridUnits(1), y: gridUnits(1) })}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: mm(3) })}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows an enabled toggle when the bin abuts a padded edge and is linked', () => {
    render(
      <ExtendToMarginToggle
        bin={edgeBin()}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: mm(3) })}
      />
    );
    const box = screen.getByRole('checkbox', { name: /extend into drawer margin/i });
    expect(box).toBeDefined();
    expect(box).not.toHaveAttribute('aria-disabled');
    expect(screen.getByText(/fills the baseplate/i)).toBeDefined();
  });

  it('dispatches updateBin with the new flag when toggled', () => {
    const bin = edgeBin();
    render(
      <ExtendToMarginToggle
        bin={bin}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: mm(3) })}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /extend into drawer margin/i }));
    expect(updateBin).toHaveBeenCalledWith(bin.id, { extendToMargin: true });
  });

  it('disables the toggle and hints to link a design when unlinked', () => {
    render(
      <ExtendToMarginToggle
        bin={edgeBin({ linkedDesignId: undefined })}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: mm(3) })}
      />
    );
    expect(screen.getByRole('checkbox', { name: /extend into drawer margin/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByText(/link a design/i)).toBeDefined();
  });
});
