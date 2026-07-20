/**
 * Pure planning step for the bin half of a whole-layout export.
 *
 * Given the layout's bins and the resolved (loaded) linked designs, it decides
 * which designs are exportable, dedupes their file names, computes per-design
 * quantities + estimates, and buckets everything that gets skipped. Kept pure
 * (no bridge, no IndexedDB) so the orchestration hook stays a thin shell.
 */

import type { Bin, DesignId, Drawer, MagnetAnchor, StoredBaseplateParams } from '@/core/types';
import type { SavedDesign, BinParams } from '@/features/bin-designer';
import { generateFileName } from '@/features/bin-designer';
// Deep import (not the barrel): the bin-designer barrel is eagerly loaded by App,
// and this code only runs inside the lazy layout-export chunk.
import { shouldGenerateLid } from '@/features/bin-designer/utils/lidCompatibility';
import { resolveBinMarginOverhang } from '@/shared/utils/drawerMargin';
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

export interface LayoutExportable {
  readonly params: BinParams;
  /** ZIP path for the design's main body, e.g. `bins/box_1x1x6.stl`. */
  readonly path: string;
  /**
   * Companion parts the design ships (`lid`, `dividers`). When non-empty the
   * design is exported via the combined flow so those parts are included.
   */
  readonly companions: readonly string[];
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

export interface LayoutBinExportPlan {
  readonly exportable: readonly LayoutExportable[];
  readonly meshExportable: readonly LayoutMeshExportable[];
  readonly manifestBins: ManifestBinEntry[];
  readonly skipped: ManifestSkipped;
  readonly totals: { readonly filamentGrams: number; readonly printTimeMinutes: number };
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
 *  dedupe together; empty for a non-extended bin. */
function overhangKey(overhang: BinParams['overhang'] | null): string {
  if (!overhang) return '';
  return `${overhang.left},${overhang.right},${overhang.front},${overhang.back},${overhang.feet ?? false}`;
}

/** Insert an `_extended` marker before the extension so a drawer-margin variant
 *  reads distinctly from the plain design in the ZIP. */
function withExtendedSuffix(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot);
  return `${base}_extended${ext}`;
}

interface BinExportGroup {
  readonly design: SavedDesign;
  readonly params: BinParams;
  readonly extended: boolean;
  quantity: number;
}

export function planLayoutBinExport(
  bins: Bin[],
  loaded: readonly LoadedDesign[],
  format: ExportFileFormat,
  fileNameConfig: ExportFileNameConfig,
  printSettings: PrintSettings,
  drawer: Pick<Drawer, 'width' | 'depth'>,
  baseplate: StoredBaseplateParams | undefined,
  magnetAnchor?: MagnetAnchor
): LayoutBinExportPlan {
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

  // Group linked bins by (design, resolved overhang). A bin that extends into
  // the drawer margin resolves its overhang live and forms its own group;
  // identical bins (extended or not) still share one mesh. The overhang
  // REPLACES the design's own overhang for that instance.
  const groups = new Map<string, BinExportGroup>();
  const usable: BinExportGroup[] = [];
  for (const b of bins) {
    if (b.linkedDesignId === undefined) continue;
    const design = designById.get(b.linkedDesignId);
    if (!design?.params) continue; // missing/non-bin already tallied above
    const overhang = resolveBinMarginOverhang(b, drawer, baseplate);
    // Inject the layout's magnet anchor (source of truth), overriding any value
    // saved on the design, so exported bins mate with the baseplate's magnets.
    const params: BinParams = overhang
      ? { ...design.params, overhang, magnetAnchor }
      : { ...design.params, magnetAnchor };
    const key = `${b.linkedDesignId}|${overhangKey(overhang)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity++;
      continue;
    }
    const group: BinExportGroup = { design, params, extended: overhang !== null, quantity: 1 };
    groups.set(key, group);
    usable.push(group);
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
      return u.extended ? withExtendedSuffix(name) : name;
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
      u.params.heightUnitMm
    );
    totalGrams += est.gramsFilament * u.quantity;
    totalMinutes += est.printTimeMinutes * u.quantity;
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
