/**
 * Pure planning step for the bin half of a whole-layout export.
 *
 * Given the layout's bins and the resolved (loaded) linked designs, it decides
 * which designs are exportable, dedupes their file names, computes per-design
 * quantities + estimates, and buckets everything that gets skipped. Kept pure
 * (no bridge, no IndexedDB) so the orchestration hook stays a thin shell.
 */

import type { Bin, DesignId } from '@/core/types';
import type { SavedDesign, BinParams } from '@/features/bin-designer';
import { generateFileName } from '@/features/bin-designer';
import { countLinkedBins } from '@/features/design-linking';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import type { PrintSettings } from '@/shared/printSettings';
import { estimateStandardBinFilament } from '@/shared/printSettings/standardBinVolume';
import { dedupeFileNames } from './dedupeFileNames';
import type { ManifestBinEntry, ManifestSkipped } from './buildLayoutManifest';

/** A linked design id resolved against storage; `design` is null when it failed to load. */
export interface LoadedDesign {
  readonly id: DesignId;
  readonly design: SavedDesign | null;
}

export interface LayoutBinExportPlan {
  /** Exportable bins, in order, with their unique ZIP paths (`bins/<name>`). */
  readonly exportable: readonly { readonly params: BinParams; readonly path: string }[];
  readonly manifestBins: ManifestBinEntry[];
  readonly skipped: ManifestSkipped;
  readonly totals: { readonly filamentGrams: number; readonly printTimeMinutes: number };
}

export function planLayoutBinExport(
  bins: Bin[],
  loaded: readonly LoadedDesign[],
  format: ExportFileFormat,
  fileNameConfig: ExportFileNameConfig,
  printSettings: PrintSettings
): LayoutBinExportPlan {
  const linkedCount = bins.filter((b) => b.linkedDesignId !== undefined).length;
  const unlinkedBins = bins.length - linkedCount;
  let nonBinDesigns = 0;
  let missingDesigns = 0;

  const usable: { params: BinParams; design: SavedDesign; quantity: number }[] = [];
  for (const { id, design } of loaded) {
    if (!design) {
      missingDesigns++;
      continue;
    }
    if (!design.params) {
      nonBinDesigns++;
      continue;
    }
    usable.push({ params: design.params, design, quantity: countLinkedBins(bins, id) });
  }

  const fileNames = dedupeFileNames(
    usable.map((u) =>
      generateFileName(
        u.params,
        format,
        u.design.exportFileNameConfig ?? fileNameConfig,
        u.design.name
      )
    )
  );

  const paths = fileNames.map((name) => `bins/${name}`);
  const exportable = usable.map((u, i) => ({ params: u.params, path: paths[i] }));

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
    };
  });

  return {
    exportable,
    manifestBins,
    skipped: { unlinkedBins, nonBinDesigns, missingDesigns },
    totals: { filamentGrams: totalGrams, printTimeMinutes: totalMinutes },
  };
}
