import type {
  CombinedExportResult,
  ExportFormat,
  GenerationBridge,
} from '@/shared/generation/bridge';
import type { ZipBinaryFile } from '@/shared/generation/zipExport';
import type { ExportFileFormat } from '@/shared/types/bin';
import type { BinParams } from '@/features/bin-designer';
import { withSocketNozzle } from '@/shared/generation/socketNozzle';
// Deep imports (not the barrel): this code only runs inside the lazy
// layout-export chunk, and the bin-designer barrel is eagerly loaded by App.
import { buildBinDownloadPayload } from '@/features/bin-designer/utils/binDownloadHelpers';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { LayoutExportable, LayoutSplitPlan } from './planLayoutBinExport';

export function baseNameOf(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');
}

/**
 * Flatten a combined export (body + lid + dividers) into ZIP files. STL emits a
 * file per piece (`<base>.stl` for the body, `<base>_<part>.stl` for the rest);
 * 3MF packs everything into one multi-object file and STEP into one compound —
 * reusing the bin designer's packaging so colours/orientation match.
 */
/**
 * Format a part file can take. A whole-layout 3MF export is a PROJECT file, so
 * 3MF never reaches the per-part writers; naming that in the type keeps a dead
 * per-part 3MF branch from creeping back in.
 */
type PartFileFormat = Exclude<ExportFileFormat, '3mf'>;

export async function combinedFiles(
  result: CombinedExportResult,
  format: PartFileFormat,
  basePath: string,
  params: BinParams
): Promise<ZipBinaryFile[]> {
  if (format === 'stl') {
    const baseNoExt = basePath.replace(/\.[^.]+$/, '');
    return result.pieces.map((p) => ({
      path: p.label === 'bin' ? `${baseNoExt}.stl` : `${baseNoExt}_${p.label}.stl`,
      data: p.data,
    }));
  }

  const { blob } = buildBinDownloadPayload(format, result, params, baseNameOf(basePath), null);
  return [{ path: basePath, data: await blob.arrayBuffer() }];
}

/**
 * Cut one oversized bin into bed-sized pieces and flatten them into ZIP files.
 *
 * Every piece becomes its own file — including under 3MF, unlike
 * `combinedFiles`. The pieces are separate prints that get joined afterwards,
 * so packing them into one multi-object 3MF would stack parts on the plate.
 * Companion parts (lid, dividers) come from a second, combined pass because the
 * split export emits body pieces only.
 *
 * Pieces go in their own `bins/<design>/` folder rather than sharing `bins/`
 * with a `_<label>` suffix. Names are deduped before suffixes exist, so a flat
 * `<base>_A1.stl` could collide with another design that generates exactly that
 * name — and `packageFilesAsZip` keys by path, so the loser would vanish from
 * the archive silently. A folder can't collide with a sibling file name, and it
 * also groups the parts a user prints as one job.
 */
export async function splitFiles(
  bridge: GenerationBridge,
  exportable: LayoutExportable,
  split: LayoutSplitPlan,
  format: ExportFileFormat,
  printSettings: { layerHeightMm: number; infillPercent: number; nozzleSizeMm: number },
  workerFormat: ExportFormat
): Promise<ZipBinaryFile[]> {
  const params = withSocketNozzle(exportable.params, printSettings.nozzleSizeMm);
  const connectorConfig = {
    ...(exportable.params.splitConnectors ?? DEFAULT_SPLIT_CONNECTOR_CONFIG),
    nozzleSizeMm: printSettings.nozzleSizeMm,
  };
  const result = await bridge.exportSplitBin(params, split.cutPlanesX, split.cutPlanesY, {
    splitConnectorConfig: connectorConfig,
    format: workerFormat,
  });

  const baseNoExt = exportable.path.replace(/\.[^.]+$/, '');
  // Split and combined pieces carry different metadata (grid col/row vs none);
  // packaging only needs the bytes and the label.
  const pieces: { data: ArrayBuffer; label: string }[] = result.pieces.map((p) => ({
    data: p.data,
    label: p.label,
  }));

  if (exportable.companions.length > 0) {
    // `separatePieces` matters under STEP: the default compound assembly
    // bundles the bin in with its companions, and the body is already covered
    // by the split pieces above.
    const combined = await bridge.exportCombined(params, workerFormat, { separatePieces: true });
    // The body is already covered by the split pieces — take only the extras.
    for (const p of combined.pieces) {
      if (p.label !== 'bin') pieces.push({ data: p.data, label: p.label });
    }
  }

  return pieces.map((piece) => ({
    path: `${baseNoExt}/${piece.label}.${format}`,
    data: piece.data,
  }));
}
