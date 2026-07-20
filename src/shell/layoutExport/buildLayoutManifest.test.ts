import { describe, it, expect } from 'vitest';
import { buildLayoutManifest } from './buildLayoutManifest';
import type { LayoutManifestInput } from './buildLayoutManifest';

function base(overrides: Partial<LayoutManifestInput> = {}): LayoutManifestInput {
  return {
    layoutName: 'My Drawer',
    format: 'stl',
    bins: [
      {
        path: 'bins/box_1x1x6.stl',
        designName: 'box',
        widthUnits: 1,
        depthUnits: 1,
        heightUnits: 6,
        quantity: 12,
        filamentGrams: 8.4,
        printTimeMinutes: 35,
      },
    ],
    baseplate: { pieceCount: 4, guidePath: 'baseplate/print-guide.txt' },
    skipped: { unlinkedBins: 0, nonBinDesigns: 0, missingDesigns: 0 },
    totals: { filamentGrams: 100.8, printTimeMinutes: 420 },
    ...overrides,
  };
}

describe('buildLayoutManifest', () => {
  it('lists the layout, bins, quantities, and estimates', () => {
    const text = buildLayoutManifest(base());
    expect(text).toContain('Layout:   My Drawer');
    expect(text).toContain('Format:   STL');
    expect(text).toContain('bins/box_1x1x6.stl');
    expect(text).toContain('Quantity:  12');
    expect(text).toContain('1 × 1 × 6 units');
    // 12 bins of qty → header counts units and unique designs
    expect(text).toContain('Bins:     12 (1 unique design)');
  });

  it('formats total print time as hours and minutes', () => {
    const text = buildLayoutManifest(base());
    expect(text).toContain('~7h'); // 420 minutes
  });

  it('includes the estimate disclaimer when bins are present', () => {
    expect(buildLayoutManifest(base())).toContain('Estimates assume a standard bin');
  });

  it('lists companion parts when a design has them', () => {
    const text = buildLayoutManifest(
      base({
        bins: [{ ...base().bins[0], companions: ['lid', 'dividers'] }],
      })
    );
    expect(text).toContain('Includes:  lid, dividers');
  });

  it('references the baseplate guide and piece count', () => {
    const text = buildLayoutManifest(base());
    expect(text).toContain('4 files in the baseplate/ folder');
    expect(text).toContain('See baseplate/print-guide.txt');
  });

  it('renders a skipped section only when something was skipped', () => {
    expect(buildLayoutManifest(base())).not.toContain('─── Skipped ───');
    const withSkips = buildLayoutManifest(
      base({ skipped: { unlinkedBins: 28, nonBinDesigns: 1, missingDesigns: 2 } })
    );
    expect(withSkips).toContain('─── Skipped ───');
    expect(withSkips).toContain('28 grid bins skipped (not linked to a saved design)');
    expect(withSkips).toContain('1 linked design skipped (not a bin');
    expect(withSkips).toContain('2 linked designs skipped (could not be loaded)');
  });

  it('renders the imported-mesh STEP skip line', () => {
    const manifest = buildLayoutManifest(
      base({
        skipped: {
          unlinkedBins: 0,
          nonBinDesigns: 0,
          missingDesigns: 0,
          meshDesignsStepSkipped: 2,
        },
      })
    );
    expect(manifest).toContain(
      '2 imported designs skipped (STEP is not available for imported meshes — export STL or 3MF)'
    );
  });

  it('handles a bins-only or baseplate-absent export', () => {
    const text = buildLayoutManifest(base({ bins: [], baseplate: null }));
    expect(text).toContain('(no linked bin designs to export)');
    expect(text).not.toContain('─── Baseplate ───');
  });
});
