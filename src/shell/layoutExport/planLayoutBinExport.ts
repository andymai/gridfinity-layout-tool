/**
 * Pure planning step for the bin half of a whole-layout export.
 *
 * Given the layout's bins and the resolved (loaded) linked designs, it decides
 * which designs are exportable, dedupes their file names, computes per-design
 * quantities + estimates, and buckets everything that gets skipped. Kept pure
 * (no bridge, no IndexedDB) so the orchestration hook stays a thin shell.
 */

import type {
  Bin,
  DesignId,
  Drawer,
  MagnetAnchor,
  OverhangConfig,
  StoredBaseplateParams,
} from '@/core/types';
import type { SavedDesign, BinParams } from '@/features/bin-designer';
import { generateFileName } from '@/features/bin-designer';
// Deep import (not the barrel): the bin-designer barrel is eagerly loaded by App,
// and this code only runs inside the lazy layout-export chunk.
import { shouldGenerateLid } from '@/features/bin-designer/utils/lidCompatibility';
import { calcMaxGridUnits } from '@/core/constants';
import { getSplitPieceCount, getSplitPlanePositionsMm } from '@/shared/utils/splitPositions';
import { resolveBinOverhang } from '@/shared/utils/drawerMargin';
import { overhangKey as resolvedOverhangKey, resolveOverhang } from '@/shared/utils/overhang';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { importedMeshDescriptor } from '@/shared/items/importedMesh/descriptor';
import type { ImportedMeshStructure, ItemEnvelope } from '@/shared/types/item';
import type { PrintSettings } from '@/shared/printSettings';
import {
  estimateMeshFilament,
  estimateStandardBinFilament,
} from '@/shared/printSettings/standardBinVolume';
import { dedupeFileNames } from './dedupeFileNames';
import type { ManifestBinEntry, ManifestSkipped } from './buildLayoutManifest';

/** A linked design id resolved against storage; `design` is null when it failed to load. */
export interface LoadedDesign {
  readonly id: DesignId;
  readonly design: SavedDesign | null;
}

/** Cut planes for a bin too large to print in one piece. */
export interface LayoutSplitPlan {
  readonly cutPlanesX: number[];
  readonly cutPlanesY: number[];
  readonly totalPieceCount: number;
}

export interface LayoutExportable {
  readonly params: BinParams;
  /** ZIP path for the design's main body, e.g. `bins/box_1x1x6.stl`. */
  readonly path: string;
  /**
   * Companion parts the design ships (`lid`, `dividers`). When non-empty the
   * design is exported via the combined flow so those parts are included.
   */
  readonly companions: readonly string[];
  /**
   * Set when the bin exceeds the print bed and has to ship as several pieces
   * (#3074). Null for a bin that fits, and always null under STEP — that format
   * carries exact BREP for downstream CAD, which the split path can't produce
   * (the bin designer refuses split STEP for the same reason).
   */
  readonly split: LayoutSplitPlan | null;
}

/** An imported-mesh design to export: the stored asset IS the geometry —
 *  decoded and re-serialized on the main thread, no worker round-trip. */
export interface LayoutMeshExportable {
  readonly asset: MeshAsset;
  /** ZIP path, e.g. `bins/widget_bin.stl`. */
  readonly path: string;
  readonly quantity: number;
  readonly designName: string;
}

/** The layout's print bed, used to decide which bins have to be split. */
export interface PrintBedSize {
  readonly widthMm: number;
  readonly depthMm: number;
}

export interface LayoutBinExportPlan {
  readonly exportable: readonly LayoutExportable[];
  readonly meshExportable: readonly LayoutMeshExportable[];
  readonly manifestBins: ManifestBinEntry[];
  readonly skipped: ManifestSkipped;
  readonly totals: { readonly filamentGrams: number; readonly printTimeMinutes: number };
}

/**
 * Cut planes for `params` against the layout's print bed, or null when the bin
 * fits whole. Mirrors the bin designer's `downloadSplit` so a bin exported from
 * the layout ZIP arrives in the same pieces it would from the designer.
 *
 * An overhang is charged against the bed before the grid capacity is derived.
 * It extends the part in millimetres beyond its nominal footprint, so a bin
 * that just fits on nominal dimensions can still overrun the plate — and unlike
 * the designer, layout bins routinely carry one (`resolveBinOverhang` grows
 * them into the drawer margin).
 */
function binSplitPlan(
  params: BinParams,
  printBed: PrintBedSize,
  format: ExportFileFormat
): LayoutSplitPlan | null {
  if (format === 'step') return null;
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const over = resolveOverhang(params.overhang ?? undefined);
  const maxGrid = calcMaxGridUnits(
    Math.max(0, printBed.widthMm - over.left - over.right),
    params.gridUnitMm,
    Math.max(0, printBed.depthMm - over.front - over.back),
    gridUnitMmY
  );
  if (params.width <= maxGrid.width && params.depth <= maxGrid.depth) return null;
  return {
    cutPlanesX: getSplitPlanePositionsMm(params.width, maxGrid.width, params.gridUnitMm),
    cutPlanesY: getSplitPlanePositionsMm(params.depth, maxGrid.depth, gridUnitMmY),
    totalPieceCount: getSplitPieceCount(params.width, params.depth, maxGrid.width, maxGrid.depth),
  };
}

/** Printable companion parts (lid, removable dividers) a bin design ships beyond its body. */
function binCompanions(params: BinParams): string[] {
  const companions: string[] = [];
  if (shouldGenerateLid(params)) companions.push('lid');
  if (params.style === 'slotted' && (params.slotConfig.x.enabled || params.slotConfig.y.enabled)) {
    companions.push('dividers');
  }
  return companions;
}

/** Stable identity for a resolved overhang so bins with identical extension
 *  dedupe together; `'0'` for a non-extended bin. */
function overhangKey(overhang: OverhangConfig | null): string {
  return resolvedOverhangKey(resolveOverhang(overhang ?? undefined));
}

/** Grid coordinate as a filename-safe token: `2.5` → `2p5` (a literal dot would
 *  read as a file extension). */
function posToken(value: number): string {
  return String(value).replace('.', 'p');
}

/**
 * Mark an extended variant with the grid position it was generated for.
 *
 * Several bins sharing one design can resolve to different overhangs — three
 * equal columns across a span that isn't a whole number of grid units produce
 * three distinct meshes. Naming them from position makes each file traceable to
 * a spot in the layout; the alternative (`dedupeFileNames` appending `-2`, `-3`)
 * distinguishes them only by the order the planner happened to encounter them,
 * which tells the user nothing about which one to print where.
 *
 * `_pos` rather than bare coordinates because generated names already carry a
 * `WxDxH` token, so an `x`-prefixed suffix would read as another dimension.
 */
function withPositionSuffix(name: string, x: number, y: number): string {
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot);
  return `${base}_pos${posToken(x)}-${posToken(y)}${ext}`;
}

interface BinExportGroup {
  readonly design: SavedDesign;
  readonly params: BinParams;
  readonly extended: boolean;
  quantity: number;
  /**
   * Every grid position this group's mesh is placed at. A group is keyed by
   * (design, resolved overhang), so identical extended bins share one file and
   * one file legitimately serves several positions. Sorted so the first entry is
   * a deterministic naming anchor regardless of bin iteration order.
   */
  positions: { x: number; y: number }[];
}

export interface LayoutBinExportInput {
  readonly bins: Bin[];
  readonly loaded: readonly LoadedDesign[];
  readonly format: ExportFileFormat;
  readonly fileNameConfig: ExportFileNameConfig;
  readonly printSettings: PrintSettings;
  readonly drawer: Pick<Drawer, 'width' | 'depth'>;
  readonly baseplate: StoredBaseplateParams | undefined;
  /** Decides which bins have to ship as several pieces. */
  readonly printBed: PrintBedSize;
  readonly magnetAnchor?: MagnetAnchor;
}

export function planLayoutBinExport(input: LayoutBinExportInput): LayoutBinExportPlan {
  const {
    bins,
    loaded,
    format,
    fileNameConfig,
    printSettings,
    drawer,
    baseplate,
    printBed,
    magnetAnchor,
  } = input;
  const unlinkedBins = bins.filter((b) => b.linkedDesignId === undefined).length;

  // Design-level skip tally + lookups of usable designs. Imported-mesh
  // designs export their stored asset directly; other paramsless kinds
  // (tool racks) stay in the skipped bucket.
  let nonBinDesigns = 0;
  let missingDesigns = 0;
  const designById = new Map<DesignId, SavedDesign>();
  const meshDesignById = new Map<
    DesignId,
    { design: SavedDesign; envelope: ItemEnvelope; structure: ImportedMeshStructure }
  >();
  for (const { id, design } of loaded) {
    if (!design) {
      missingDesigns++;
      continue;
    }
    if (!design.params) {
      if (design.structure?.kind === 'importedMesh' && design.envelope) {
        meshDesignById.set(id, {
          design,
          envelope: design.envelope,
          structure: design.structure,
        });
      } else {
        nonBinDesigns++;
      }
      continue;
    }
    designById.set(id, design);
  }

  // Group linked bins by (design, resolved overhang). A bin that carries an
  // explicit overhang or extends into the drawer margin forms its own group;
  // identical bins (extended or not) still share one mesh. The overhang
  // REPLACES the design's own overhang for that instance.
  const groups = new Map<string, BinExportGroup>();
  const usable: BinExportGroup[] = [];
  for (const b of bins) {
    if (b.linkedDesignId === undefined) continue;
    const design = designById.get(b.linkedDesignId);
    if (!design?.params) continue; // missing/non-bin already tallied above
    const overhang = resolveBinOverhang(b, drawer, baseplate);
    // Inject the layout's magnet anchor (source of truth), overriding any value
    // saved on the design, so exported bins mate with the baseplate's magnets.
    const params: BinParams = overhang
      ? { ...design.params, overhang, magnetAnchor }
      : { ...design.params, magnetAnchor };
    const key = `${b.linkedDesignId}|${overhangKey(overhang)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity++;
      existing.positions.push({ x: b.x, y: b.y });
      continue;
    }
    const group: BinExportGroup = {
      design,
      params,
      extended: overhang !== null,
      quantity: 1,
      positions: [{ x: b.x, y: b.y }],
    };
    groups.set(key, group);
    usable.push(group);
  }

  // Sort so the naming anchor (and the manifest listing) don't depend on the
  // order bins happen to appear in the layout.
  for (const g of groups.values()) {
    g.positions.sort((a, b) => a.x - b.x || a.y - b.y);
  }

  // Group linked bins on imported-mesh designs by design id (no overhang or
  // margin variants — a stored mesh is not extendable). STEP cannot carry a
  // mesh (no BREP solid), so under STEP these become a skip tally instead.
  interface MeshExportGroup {
    readonly design: SavedDesign;
    readonly envelope: ItemEnvelope;
    readonly structure: ImportedMeshStructure;
    quantity: number;
  }
  const meshGroups = new Map<DesignId, MeshExportGroup>();
  for (const b of bins) {
    if (b.linkedDesignId === undefined) continue;
    const mesh = meshDesignById.get(b.linkedDesignId);
    if (!mesh) continue;
    const existing = meshGroups.get(b.linkedDesignId);
    if (existing) {
      existing.quantity++;
    } else {
      meshGroups.set(b.linkedDesignId, { ...mesh, quantity: 1 });
    }
  }
  const meshUsable = format === 'step' ? [] : [...meshGroups.values()];
  const meshDesignsStepSkipped = format === 'step' ? meshGroups.size : 0;

  // One dedupe pass across bin AND mesh names so an imported design can't
  // silently collide with a parametric design of the same stem.
  const fileNames = dedupeFileNames([
    ...usable.map((u) => {
      const name = generateFileName(
        u.params,
        format,
        u.design.exportFileNameConfig ?? fileNameConfig,
        u.design.name
      );
      return u.extended ? withPositionSuffix(name, u.positions[0].x, u.positions[0].y) : name;
    }),
    ...meshUsable.map(
      (m) => `${importedMeshDescriptor.exportFileName(m.envelope, m.structure)}.${format}`
    ),
  ]);
  const meshFileNames = fileNames.slice(usable.length);

  const paths = fileNames.slice(0, usable.length).map((name) => `bins/${name}`);
  const meshPaths = meshFileNames.map((name) => `bins/${name}`);
  const companions = usable.map((u) => binCompanions(u.params));
  const exportable = usable.map((u, i) => ({
    params: u.params,
    path: paths[i],
    companions: companions[i],
    split: binSplitPlan(u.params, printBed, format),
  }));

  let totalGrams = 0;
  let totalMinutes = 0;
  const manifestBins: ManifestBinEntry[] = usable.map((u, i) => {
    const est = estimateStandardBinFilament(
      u.params.width,
      u.params.depth,
      u.params.height,
      printSettings,
      u.params.gridUnitMm,
      u.params.heightUnitMm,
      u.params.gridUnitMmY
    );
    totalGrams += est.gramsFilament * u.quantity;
    totalMinutes += est.printTimeMinutes * u.quantity;
    const split = exportable[i].split;
    return {
      path: paths[i],
      designName: u.design.name,
      widthUnits: u.params.width,
      depthUnits: u.params.depth,
      heightUnits: u.params.height,
      quantity: u.quantity,
      filamentGrams: est.gramsFilament,
      printTimeMinutes: est.printTimeMinutes,
      companions: companions[i],
      ...(split
        ? {
            splitPieces: split.totalPieceCount,
            splitConnectors: u.params.splitConnectors?.enabled ?? true,
            // Only the body is cut; a lid or divider set on an oversized design
            // still ships whole and may not fit the bed.
            ...(companions[i].length > 0 ? { oversizedCompanions: companions[i] } : {}),
          }
        : {}),
      ...(u.extended ? { atPositions: u.positions } : {}),
    };
  });

  const meshExportable: LayoutMeshExportable[] = meshUsable.map((m, i) => ({
    asset: m.structure.asset,
    path: meshPaths[i],
    quantity: m.quantity,
    designName: m.design.name,
  }));

  for (let i = 0; i < meshUsable.length; i++) {
    const m = meshUsable[i];
    // Measured solid volume beats the standard-bin wall model when present
    // (pre-volume imports fall back to the analytical estimate).
    const est = m.structure.volumeMm3
      ? estimateMeshFilament(m.structure.volumeMm3, printSettings)
      : estimateStandardBinFilament(
          m.envelope.width,
          m.envelope.depth,
          m.structure.heightUnits,
          printSettings,
          m.envelope.gridUnitMm,
          m.envelope.heightUnitMm
        );
    totalGrams += est.gramsFilament * m.quantity;
    totalMinutes += est.printTimeMinutes * m.quantity;
    manifestBins.push({
      path: meshPaths[i],
      designName: m.design.name,
      widthUnits: m.envelope.width,
      depthUnits: m.envelope.depth,
      heightUnits: m.structure.heightUnits,
      quantity: m.quantity,
      filamentGrams: est.gramsFilament,
      printTimeMinutes: est.printTimeMinutes,
    });
  }

  return {
    exportable,
    meshExportable,
    manifestBins,
    skipped: { unlinkedBins, nonBinDesigns, missingDesigns, meshDesignsStepSkipped },
    totals: { filamentGrams: totalGrams, printTimeMinutes: totalMinutes },
  };
}
