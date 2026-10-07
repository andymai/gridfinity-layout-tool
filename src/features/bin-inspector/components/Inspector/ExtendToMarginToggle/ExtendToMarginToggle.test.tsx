import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtendToMarginToggle } from './ExtendToMarginToggle';
import { createTestBin } from '@/test/testUtils';
import { designId, gridUnits, heightUnits, mm } from '@/core/types';
import type { Bin, Drawer, StoredBaseplateParams } from '@/core/types';
import { resetCustomBinsCache } from '@/features/bin-designer/hooks/useCustomBins';
import { upsertRegistryEntry } from '@/features/bin-designer/store/customBinRegistry';
import type { CustomBinRef } from '@/features/bin-designer/store/customBinRegistry';

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

function registerDesign(kind: CustomBinRef['kind']): void {
  upsertRegistryEntry({
    id: designId('d1'),
    name: 'd1',
    width: 1,
    depth: 1,
    height: 3,
    kind,
    updatedAt: '2026-10-07T00:00:00.000Z',
  });
}

describe('ExtendToMarginToggle', () => {
  beforeEach(() => {
    updateBin.mockClear();
    localStorage.clear();
    resetCustomBinsCache();
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

  it.each(['importedMesh', 'assembly'] as const)(
    'disables the toggle with a hint when the linked design is %s',
    (kind) => {
      registerDesign(kind);
      render(
        <ExtendToMarginToggle
          bin={edgeBin()}
          drawer={DRAWER}
          baseplate={baseplate({ paddingLeft: mm(3) })}
        />
      );
      const box = screen.getByRole('checkbox', { name: /extend into drawer margin/i });
      expect(box).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText(/keep their saved shape/i)).toBeDefined();
      expect(screen.queryByText(/fills the baseplate/i)).toBeNull();
    }
  );

  it('shows a saved flag as off, without taper controls, on an imported mesh', () => {
    registerDesign('importedMesh');
    render(
      <ExtendToMarginToggle
        bin={edgeBin({ extendToMargin: true })}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: mm(3) })}
      />
    );
    expect(screen.getByRole('checkbox', { name: /extend into drawer margin/i })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /taper walls/i })).toBeNull();
  });

  it('keeps the toggle enabled for a design registered as a parametric bin', () => {
    registerDesign('bin');
    render(
      <ExtendToMarginToggle
        bin={edgeBin()}
        drawer={DRAWER}
        baseplate={baseplate({ paddingLeft: mm(3) })}
      />
    );
    expect(
      screen.getByRole('checkbox', { name: /extend into drawer margin/i })
    ).not.toHaveAttribute('aria-disabled');
  });
});
