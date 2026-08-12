import { describe, it, expect } from 'vitest';
import { designId, gridUnits, mm } from '@/core/types';
import type { Bin, Drawer, StoredBaseplateParams } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { SavedDesign, BinParams } from '@/features/bin-designer';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import { planLayoutBinExport } from './planLayoutBinExport';
import type { LoadedDesign } from './planLayoutBinExport';

const DRAWER: Pick<Drawer, 'width' | 'depth'> = { width: gridUnits(5), depth: gridUnits(4) };

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

function design(id: string, name: string, params: Partial<BinParams> = {}): SavedDesign {
  return {
    id: designId(id),
    name,
    params: { ...DEFAULT_BIN_PARAMS, ...params },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exportFileNameConfig: null,
  };
}

/** A design carrying one visible, resolvable mesh imprint cutout (#3449). */
function imprintParams(): Partial<BinParams> {
  return {
    cutouts: [
      {
        id: 'c1',
        shape: 'mesh',
        meshId: 'a1',
        x: 10,
        y: 10,
        width: 10,
        depth: 10,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
      },
    ],
    meshAssets: {
      a1: {
        name: 'spanner',
        data: 'x',
        triangleCount: 12,
        sizeMm: { x: 10, y: 10, z: 5 },
        outlines: [],
      },
    },
  };
}

function linkedBin(idStr: string, overrides: Partial<Bin> = {}): Bin {
  return createTestBin({ linkedDesignId: designId(idStr), ...overrides });
}

const CONFIG = { style: 'descriptive', customName: '', format: 'stl' } as const;
/** Large enough that nothing in these cases splits; split cases set their own. */
const PRINT_BED = { widthMm: 256, depthMm: 256 };

describe('planLayoutBinExport', () => {
  it('dedupes by design and counts quantity per design', () => {
    const bins: Bin[] = [
      linkedBin('d1', { id: createTestBin({}).id }),
      { ...linkedBin('d1'), id: createTestBin({ x: gridUnits(1) }).id, x: gridUnits(1) },
      { ...linkedBin('d2'), id: createTestBin({ x: gridUnits(2) }).id, x: gridUnits(2) },
    ];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box', { width: 1, depth: 1, height: 6 }) },
      { id: designId('d2'), design: design('d2', 'Tray', { width: 2, depth: 2, height: 3 }) },
    ];

    const plan = planLayoutBinExport({
      bins,
      loaded,
      format: 'stl',
      fileNameConfig: CONFIG,
      printSettings: DEFAULT_PRINT_SETTINGS,
      drawer: DRAWER,
      baseplate: undefined,
      printBed: PRINT_BED,
    });

    expect(plan.exportable).toHaveLength(2);
    expect(plan.manifestBins.find((b) => b.designName === 'Box')?.quantity).toBe(2);
    expect(plan.manifestBins.find((b) => b.designName === 'Tray')?.quantity).toBe(1);
  });

  it('buckets unlinked, non-bin, and missing designs as skipped', () => {
    const bins: Bin[] = [
      linkedBin('d1'),
      createTestBin({ id: createTestBin({ x: gridUnits(9) }).id, x: gridUnits(9) }), // unlinked
    ];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box') },
      { id: designId('d2'), design: { ...design('d2', 'Rack'), params: undefined } }, // non-bin
      { id: designId('d3'), design: null }, // missing
    ];

    const plan = planLayoutBinExport({
      bins,
      loaded,
      format: 'stl',
      fileNameConfig: CONFIG,
      printSettings: DEFAULT_PRINT_SETTINGS,
      drawer: DRAWER,
      baseplate: undefined,
      printBed: PRINT_BED,
    });

    expect(plan.skipped.unlinkedBins).toBe(1);
    expect(plan.skipped.nonBinDesigns).toBe(1);
    expect(plan.skipped.missingDesigns).toBe(1);
    expect(plan.exportable).toHaveLength(1);
  });

  it('dedupes colliding file names so no bin overwrites another', () => {
    const bins: Bin[] = [linkedBin('d1'), { ...linkedBin('d2'), x: gridUnits(1) }];
    // Two distinct designs, identical dims + name → same generated name.
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box', { width: 1, depth: 1, height: 6 }) },
      { id: designId('d2'), design: design('d2', 'Box', { width: 1, depth: 1, height: 6 }) },
    ];

    const plan = planLayoutBinExport({
      bins,
      loaded,
      format: 'stl',
      fileNameConfig: CONFIG,
      printSettings: DEFAULT_PRINT_SETTINGS,
      drawer: DRAWER,
      baseplate: undefined,
      printBed: PRINT_BED,
    });
    const paths = plan.exportable.map((e) => e.path);
    expect(new Set(paths).size).toBe(2);
  });

  it('flags designs with removable dividers as companions', () => {
    const bins: Bin[] = [linkedBin('d1')];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Slotted', { style: 'slotted' }) },
    ];
    const plan = planLayoutBinExport({
      bins,
      loaded,
      format: 'stl',
      fileNameConfig: CONFIG,
      printSettings: DEFAULT_PRINT_SETTINGS,
      drawer: DRAWER,
      baseplate: undefined,
      printBed: PRINT_BED,
    });
    expect(plan.exportable[0].companions).toContain('dividers');
    expect(plan.manifestBins[0].companions).toContain('dividers');
  });

  it('marks plain designs as having no companions', () => {
    const bins: Bin[] = [linkedBin('d1')];
    const loaded: LoadedDesign[] = [{ id: designId('d1'), design: design('d1', 'Box') }];
    const plan = planLayoutBinExport({
      bins,
      loaded,
      format: 'stl',
      fileNameConfig: CONFIG,
      printSettings: DEFAULT_PRINT_SETTINGS,
      drawer: DRAWER,
      baseplate: undefined,
      printBed: PRINT_BED,
    });
    expect(plan.exportable[0].companions).toEqual([]);
  });

  it('sums totals as per-bin estimate × quantity', () => {
    const bins: Bin[] = [linkedBin('d1'), { ...linkedBin('d1'), x: gridUnits(1) }];
    const loaded: LoadedDesign[] = [
      { id: designId('d1'), design: design('d1', 'Box', { width: 1, depth: 1, height: 6 }) },
    ];
    const plan = planLayoutBinExport({
      bins,
      loaded,
      format: 'stl',
      fileNameConfig: CONFIG,
      printSettings: DEFAULT_PRINT_SETTINGS,
      drawer: DRAWER,
      baseplate: undefined,
      printBed: PRINT_BED,
    });
    const per = plan.manifestBins[0];
    expect(plan.totals.filamentGrams).toBeCloseTo(per.filamentGrams * 2, 5);
  });

  describe('extend into drawer margin', () => {
    const box = () => design('d1', 'Box', { width: 1, depth: 1, height: 6 });
    const unitBin = (x: number, y: number): Bin =>
      linkedBin('d1', {
        x: gridUnits(x),
        y: gridUnits(y),
        width: gridUnits(1),
        depth: gridUnits(1),
      });
    const extendedUnitBin = (x: number, y: number): Bin => ({
      ...unitBin(x, y),
      extendToMargin: true,
    });

    it('splits an extended bin into its own group with a position-suffixed name and overhang', () => {
      const bins: Bin[] = [
        extendedUnitBin(0, 0), // abuts left → extends
        unitBin(0, 2), // plain sibling
      ];
      const plan = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('d1'), design: box() }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: baseplate({ paddingLeft: mm(3) }),
        printBed: PRINT_BED,
      });

      expect(plan.exportable).toHaveLength(2);
      const ext = plan.exportable.find((e) => e.path.includes('_pos'));
      const plain = plan.exportable.find((e) => !e.path.includes('_pos'));
      expect(ext?.path).toContain('_pos0-0');
      expect(plain).toBeDefined();
      expect(ext?.params.overhang).toEqual({
        enabled: true,
        left: 3,
        right: 0,
        front: 0,
        back: 0,
        feet: false,
      });
    });

    // Identical extended bins share one mesh, so one file covers several spots.
    // The manifest has to carry all of them, sorted, or it misreports placement.
    it('records every position of a shared extended variant, sorted', () => {
      const bins: Bin[] = [extendedUnitBin(0, 2), extendedUnitBin(0, 0), extendedUnitBin(0, 1)];
      const plan = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('d1'), design: box() }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: baseplate({ paddingLeft: mm(3) }),
        printBed: PRINT_BED,
      });

      expect(plan.manifestBins).toHaveLength(1);
      expect(plan.manifestBins[0].quantity).toBe(3);
      expect(plan.manifestBins[0].atPositions).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ]);
      // Name anchors on the sorted first position, not the encounter order.
      expect(plan.manifestBins[0].path).toContain('_pos0-0');
    });

    it('leaves atPositions off a plain (non-extended) entry', () => {
      const plan = planLayoutBinExport({
        bins: [unitBin(1, 1)],
        loaded: [{ id: designId('d1'), design: box() }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: baseplate({ paddingLeft: mm(3) }),
        printBed: PRINT_BED,
      });
      expect(plan.manifestBins[0].atPositions).toBeUndefined();
    });

    it('dedupes two identically-extended bins into one group', () => {
      const bins: Bin[] = [extendedUnitBin(0, 0), extendedUnitBin(0, 1)];
      const plan = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('d1'), design: box() }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: baseplate({ paddingLeft: mm(3) }),
        printBed: PRINT_BED,
      });
      expect(plan.exportable).toHaveLength(1);
      expect(plan.manifestBins[0].quantity).toBe(2);
    });

    it('leaves an opted-in bin dormant when it abuts no padded edge', () => {
      const bins: Bin[] = [
        extendedUnitBin(1, 1), // interior
        unitBin(2, 1),
      ];
      const plan = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('d1'), design: box() }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        // padding only on an edge this bin doesn't touch
        baseplate: baseplate({ paddingBack: mm(3) }),
        printBed: PRINT_BED,
      });
      expect(plan.exportable).toHaveLength(1);
      expect(plan.exportable[0].path).not.toContain('_extended');
    });

    it('is inert without a baseplate', () => {
      const bins: Bin[] = [extendedUnitBin(0, 0)];
      const plan = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('d1'), design: box() }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });
      expect(plan.exportable[0].path).not.toContain('_extended');
    });
  });

  describe('imported-mesh designs', () => {
    function meshDesign(id: string, name: string, volumeMm3?: number): SavedDesign {
      return {
        id: designId(id),
        name,
        kind: 'importedMesh',
        envelope: {
          width: 2,
          depth: 1,
          gridUnitMm: 42,
          heightUnitMm: 7,
          attachment: {
            magnetHoles: false,
            magnetDiameter: 6.5,
            magnetDepth: 2.4,
            screwHoles: false,
            screwDiameter: 3,
          },
          featureColors: DEFAULT_BIN_PARAMS.featureColors,
        },
        structure: {
          kind: 'importedMesh',
          heightUnits: 3,
          asset: {
            name,
            data: 'AAAA',
            triangleCount: 12,
            sizeMm: { x: 83.5, y: 41.5, z: 21 },
            outlines: [],
          },
          ...(volumeMm3 !== undefined ? { volumeMm3 } : {}),
        },
        thumbnail: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        exportFileNameConfig: null,
      };
    }

    it('exports a mesh design with quantity grouping and a manifest entry', () => {
      const bins: Bin[] = [
        linkedBin('m1'),
        { ...linkedBin('m1'), id: createTestBin({ x: gridUnits(3) }).id, x: gridUnits(3) },
      ];
      const loaded: LoadedDesign[] = [{ id: designId('m1'), design: meshDesign('m1', 'widget') }];

      const plan = planLayoutBinExport({
        bins,
        loaded,
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });

      expect(plan.skipped.nonBinDesigns).toBe(0);
      expect(plan.meshExportable).toHaveLength(1);
      expect(plan.meshExportable[0].path).toBe('bins/widget.stl');
      expect(plan.meshExportable[0].quantity).toBe(2);
      const entry = plan.manifestBins.find((b) => b.designName === 'widget');
      expect(entry?.widthUnits).toBe(2);
      expect(entry?.heightUnits).toBe(3);
      expect(entry?.quantity).toBe(2);
      expect(plan.totals.filamentGrams).toBeGreaterThan(0);
    });

    it('uses the measured volume for the estimate when present', () => {
      const bins: Bin[] = [linkedBin('m1')];
      const withVolume = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('m1'), design: meshDesign('m1', 'widget', 10_000) }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });
      // 10 cm³ of PLA ≈ 12.4 g — clearly distinct from the standard-bin model.
      const entry = withVolume.manifestBins[0];
      expect(entry.filamentGrams).toBeCloseTo(12.4, 0);
    });

    it('dedupes a mesh name against a parametric design with the same stem', () => {
      const bins: Bin[] = [
        linkedBin('d1'),
        { ...linkedBin('m1'), id: createTestBin({ x: gridUnits(3) }).id, x: gridUnits(3) },
      ];
      const loaded: LoadedDesign[] = [
        { id: designId('d1'), design: design('d1', 'widget') },
        { id: designId('m1'), design: meshDesign('m1', 'widget') },
      ];
      const plan = planLayoutBinExport({
        bins,
        loaded,
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });
      const allPaths = [...plan.exportable.map((e) => e.path), plan.meshExportable[0].path];
      expect(new Set(allPaths).size).toBe(allPaths.length);
    });

    it('skips mesh designs under STEP with a dedicated tally', () => {
      const bins: Bin[] = [linkedBin('m1')];
      const plan = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('m1'), design: meshDesign('m1', 'widget') }],
        format: 'step',
        fileNameConfig: { ...CONFIG, format: 'step' },
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });
      expect(plan.meshExportable).toHaveLength(0);
      expect(plan.skipped.meshDesignsStepSkipped).toBe(1);
      expect(plan.manifestBins).toHaveLength(0);
    });

    it('skips a bin design carrying a mesh imprint under STEP, keeping the rest', () => {
      const imprint = design('i1', 'Shadow board', imprintParams());
      const plan = planLayoutBinExport({
        bins: [linkedBin('i1'), { ...linkedBin('d1'), x: gridUnits(2) }],
        loaded: [
          { id: designId('i1'), design: imprint },
          { id: designId('d1'), design: design('d1', 'Box') },
        ],
        format: 'step',
        fileNameConfig: { ...CONFIG, format: 'step' },
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });
      // The imprint pocket is cut after tessellation, so `binExporter` throws
      // on STEP — and one throw used to abort the whole ZIP (#3449). The plain
      // bin beside it must still come out.
      expect(plan.skipped.imprintDesignsStepSkipped).toBe(1);
      expect(plan.manifestBins.map((b) => b.designName)).toEqual(['Box']);
    });

    it('exports that same imprint design under STL', () => {
      const imprint = design('i1', 'Shadow board', imprintParams());
      const plan = planLayoutBinExport({
        bins: [linkedBin('i1')],
        loaded: [{ id: designId('i1'), design: imprint }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });
      expect(plan.skipped.imprintDesignsStepSkipped).toBe(0);
      expect(plan.exportable).toHaveLength(1);
    });

    it('still tallies tool racks (non-mesh paramsless designs) as nonBinDesigns', () => {
      const bins: Bin[] = [linkedBin('r1')];
      const rack: SavedDesign = { ...design('r1', 'Rack'), params: undefined, kind: 'toolRack' };
      const plan = planLayoutBinExport({
        bins,
        loaded: [{ id: designId('r1'), design: rack }],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });
      expect(plan.skipped.nonBinDesigns).toBe(1);
      expect(plan.meshExportable).toHaveLength(0);
    });
  });

  describe('oversized bins (#3074)', () => {
    // 256mm bed at the stock 42mm pitch fits 6 units per axis.
    const bigBin = (w: number, d: number): LoadedDesign => ({
      id: designId('big'),
      design: design('big', 'Long', { width: w, depth: d, height: 3 }),
    });

    it('plans cut planes for a bin wider than the print bed', () => {
      const plan = planLayoutBinExport({
        bins: [linkedBin('big')],
        loaded: [bigBin(11, 2)],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });

      const split = plan.exportable[0].split;
      expect(split).not.toBeNull();
      expect(split?.totalPieceCount).toBeGreaterThan(1);
      expect(split?.cutPlanesX.length).toBeGreaterThan(0);
      expect(split?.cutPlanesY).toEqual([]);
      expect(plan.manifestBins[0].splitPieces).toBe(split?.totalPieceCount);
    });

    it('charges an overhang against the bed before deciding the fit', () => {
      // 6 units at the 42mm pitch is 252mm — inside a 256mm bed on nominal
      // dimensions, but a 9mm overhang pushes the printed part past the plate.
      const overhung: LoadedDesign = {
        id: designId('big'),
        design: design('big', 'Wide', {
          width: 6,
          depth: 2,
          height: 3,
          overhang: { left: 9, right: 0, front: 0, back: 0, feet: false },
        }),
      };
      const plan = planLayoutBinExport({
        bins: [linkedBin('big')],
        loaded: [overhung],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });

      expect(plan.exportable[0].split).not.toBeNull();
    });

    it('leaves the same bin whole without the overhang', () => {
      const plan = planLayoutBinExport({
        bins: [linkedBin('big')],
        loaded: [bigBin(6, 2)],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });

      expect(plan.exportable[0].split).toBeNull();
    });

    it('leaves a bin that fits unsplit', () => {
      const plan = planLayoutBinExport({
        bins: [linkedBin('big')],
        loaded: [bigBin(2, 2)],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });

      expect(plan.exportable[0].split).toBeNull();
      expect(plan.manifestBins[0].splitPieces).toBeUndefined();
    });

    it('never splits under STEP — that format ships exact BREP for downstream CAD', () => {
      const plan = planLayoutBinExport({
        bins: [linkedBin('big')],
        loaded: [bigBin(11, 2)],
        format: 'step',
        fileNameConfig: { ...CONFIG, format: 'step' },
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: PRINT_BED,
      });

      expect(plan.exportable[0].split).toBeNull();
    });

    it('splits on the depth axis against a non-square bed', () => {
      const plan = planLayoutBinExport({
        bins: [linkedBin('big')],
        loaded: [bigBin(2, 8)],
        format: 'stl',
        fileNameConfig: CONFIG,
        printSettings: DEFAULT_PRINT_SETTINGS,
        drawer: DRAWER,
        baseplate: undefined,
        printBed: { widthMm: 256, depthMm: 128 },
      });

      const split = plan.exportable[0].split;
      expect(split?.cutPlanesX).toEqual([]);
      expect(split?.cutPlanesY.length).toBeGreaterThan(0);
    });
  });
});
