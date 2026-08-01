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

  it('points at the folder a split bin writes, not the unwritten whole path', () => {
    const text = buildLayoutManifest(base({ bins: [{ ...base().bins[0], splitPieces: 4 }] }));
    // The archive holds `bins/box_1x1x6/<piece>.stl`; the unsplit name is never
    // written, so pointing at it would send the reader after a missing file.
    expect(text).toContain('bins/box_1x1x6/');
    expect(text).not.toContain('  bins/box_1x1x6.stl\n');
    expect(text).toContain('Split:     4 pieces');
  });

  it('does not promise printed connectors when the design turned them off', () => {
    const withConnectors = buildLayoutManifest(
      base({ bins: [{ ...base().bins[0], splitPieces: 2, splitConnectors: true }] })
    );
    expect(withConnectors).toContain('join them with the printed connectors');

    const without = buildLayoutManifest(
      base({ bins: [{ ...base().bins[0], splitPieces: 2, splitConnectors: false }] })
    );
    expect(without).toContain('join them at the cut faces');
    expect(without).not.toContain('printed connectors');
  });

  it('warns that a split bin ships its companions at full size', () => {
    // Only the body is cut, so a big design's lid can still overrun the bed.
    const text = buildLayoutManifest(
      base({
        bins: [
          {
            ...base().bins[0],
            splitPieces: 4,
            companions: ['lid'],
            oversizedCompanions: ['lid'],
          },
        ],
      })
    );
    expect(text).toContain('lid ship at full size');
  });

  it('keeps the plain path for a bin that prints whole', () => {
    const text = buildLayoutManifest(base({ bins: [{ ...base().bins[0], splitPieces: 1 }] }));
    expect(text).toContain('bins/box_1x1x6.stl');
    expect(text).not.toContain('Split:');
  });

  it('references the baseplate guide and piece count', () => {
    const text = buildLayoutManifest(base());
    expect(text).toContain('4 files in the baseplate/ folder');
    expect(text).toContain('See baseplate/print-guide.txt');
  });

  it('references the assembly-map image when present', () => {
    const text = buildLayoutManifest(
      base({
        baseplate: {
          pieceCount: 4,
          guidePath: 'baseplate/print-guide.txt',
          imagePath: 'baseplate/assembly-map.png',
        },
      })
    );
    expect(text).toContain('See baseplate/assembly-map.png');
    expect(text).toContain('labeled top-view');
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

  it('renders the label plates section with quantities and sheet paths', () => {
    const text = buildLayoutManifest(
      base({
        labels: [
          {
            designName: 'Hardware',
            sheetPaths: ['labels/hardware_plates_1.stl'],
            plates: [
              { widthU: 1, text: 'SCREWS', quantity: 2 },
              { widthU: 2, text: '', quantity: 1 },
            ],
          },
        ],
      })
    );
    expect(text).toContain('Label plates');
    expect(text).toContain('labels/hardware_plates_1.stl');
    expect(text).toContain('2\u00d7 1U "SCREWS"');
    expect(text).toContain('1\u00d7 2U (blank)');
  });

  it('omits the label plates section when absent', () => {
    expect(buildLayoutManifest(base())).not.toContain('Label plates');
    expect(buildLayoutManifest(base({ labels: null }))).not.toContain('Label plates');
  });

  // Three columns on one design differ only by overhang, so the file name alone
  // can't say which goes where; the manifest is the mapping.
  it('states the grid position of a single-placement extended variant', () => {
    const text = buildLayoutManifest(
      base({
        bins: [
          {
            ...base().bins[0],
            path: 'bins/box_pos2p5-0.stl',
            quantity: 1,
            atPositions: [{ x: 2.5, y: 0 }],
          },
        ],
      })
    );
    expect(text).toContain('Position:  grid (2.5, 0) \u2014 extended to fit');
  });

  // One file legitimately serves several positions when identical bins share a
  // design AND an overhang; a singular label would misread as a single spot.
  it('lists every position when one variant covers several placements', () => {
    const text = buildLayoutManifest(
      base({
        bins: [
          {
            ...base().bins[0],
            quantity: 3,
            atPositions: [
              { x: 0, y: 0 },
              { x: 2.5, y: 0 },
              { x: 5, y: 0 },
            ],
          },
        ],
      })
    );
    expect(text).toContain('Positions: grid (0, 0), (2.5, 0), (5, 0) \u2014 extended to fit');
  });

  it('states the remainder rather than silently truncating a long list', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ x: i, y: 0 }));
    const text = buildLayoutManifest(
      base({ bins: [{ ...base().bins[0], quantity: 9, atPositions: many }] })
    );
    expect(text).toContain('+3 more');
  });

  it('omits the position line for a plain (non-extended) bin', () => {
    expect(buildLayoutManifest(base())).not.toContain('Position:');
  });
});
