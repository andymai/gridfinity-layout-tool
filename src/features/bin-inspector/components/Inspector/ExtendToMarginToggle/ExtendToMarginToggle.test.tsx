import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtendToMarginToggle } from './ExtendToMarginToggle';
import { useLabsStore } from '@/core/store';
import { createTestBin } from '@/test/testUtils';
import { designId, gridUnits, heightUnits } from '@/core/types';
import type { Bin, Drawer, StoredBaseplateParams } from '@/core/types';

const updateBin = vi.fn();
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ updateBin }),
}));

const DRAWER: Drawer = { width: gridUnits(5), depth: gridUnits(4), height: heightUnits(6) };

function baseplate(overrides: Partial<StoredBaseplateParams> = {}): StoredBaseplateParams {
  return {
    magnetHoles: false,
    magnetDiameter: 6,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    ...overrides,
  };
}

function edgeBin(overrides: Partial<Bin> = {}): Bin {
  // Bottom-left corner, linked → abuts the left/front edges.
  return createTestBin({
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    linkedDesignId: designId('d1'),
    ...overrides,
  });
}

function setFlag(on: boolean) {
  useLabsStore.setState((prev) => ({
    preferences: {
      ...prev.preferences,
      enabledFeatures: { ...prev.preferences.enabledFeatures, layout_overhang: on },
    },
  }));
}

describe('ExtendToMarginToggle', () => {
  beforeEach(() => {
    updateBin.mockClear();
    setFlag(true);
  });

  it('renders nothing when the labs flag is off', () => {
    setFlag(false);
    const { container } = render(
      <ExtendToMarginToggle
        bin={edgeBin()}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: 3 })}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an interior bin (no adjacent margin)', () => {
    const { container } = render(
      <ExtendToMarginToggle
        bin={edgeBin({ x: 1, y: 1 })}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: 3 })}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows an enabled toggle when the bin abuts a padded edge and is linked', () => {
    render(
      <ExtendToMarginToggle
        bin={edgeBin()}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: 3 })}
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
      <ExtendToMarginToggle bin={bin} drawer={DRAWER} baseplate={baseplate({ paddingLeft: 3 })} />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /extend into drawer margin/i }));
    expect(updateBin).toHaveBeenCalledWith(bin.id, { extendToMargin: true });
  });

  it('disables the toggle and hints to link a design when unlinked', () => {
    render(
      <ExtendToMarginToggle
        bin={edgeBin({ linkedDesignId: undefined })}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: 3 })}
      />
    );
    expect(screen.getByRole('checkbox', { name: /extend into drawer margin/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByText(/link a design/i)).toBeDefined();
  });
});
