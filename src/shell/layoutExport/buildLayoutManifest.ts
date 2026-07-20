/**
 * Renders the root `manifest.txt` for a whole-layout export ZIP.
 *
 * Plain English (it ships inside a downloaded archive, not the UI), listing every
 * exported bin with its quantity + size + rough estimate, the skipped bins, and a
 * pointer to the baseplate print guide. Pure: all data is passed in.
 */

import type { ExportFileFormat } from '@/shared/types/bin';

export interface ManifestBinEntry {
  /** Path inside the ZIP, e.g. `bins/box_1x1x6.stl`. */
  readonly path: string;
  readonly designName: string;
  readonly widthUnits: number;
  readonly depthUnits: number;
  readonly heightUnits: number;
  readonly quantity: number;
  readonly filamentGrams: number;
  readonly printTimeMinutes: number;
  /** Companion parts included alongside the body (e.g. `lid`, `dividers`). */
  readonly companions?: readonly string[];
}

export interface ManifestSkipped {
  /** Grid bins with no linked design (no printable geometry). */
  readonly unlinkedBins: number;
  /** Linked designs that aren't bins (no exportable params). */
  readonly nonBinDesigns: number;
  /** Linked design ids that failed to load (deleted/stale). */
  readonly missingDesigns: number;
  /** Imported-mesh designs skipped under STEP (a mesh has no BREP solid). */
  readonly meshDesignsStepSkipped?: number;
}

export interface LayoutManifestInput {
  readonly layoutName: string;
  /** The per-file format inside the ZIP. */
  readonly format: ExportFileFormat;
  readonly bins: readonly ManifestBinEntry[];
  /** Present when a baseplate is included; guidePath is set when it ships a guide. */
  readonly baseplate?: { readonly pieceCount: number; readonly guidePath?: string } | null;
  readonly skipped: ManifestSkipped;
  readonly totals: { readonly filamentGrams: number; readonly printTimeMinutes: number };
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

function formatTime(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function buildLayoutManifest(input: LayoutManifestInput): string {
  const { layoutName, format, bins, baseplate, skipped, totals } = input;
  const totalBinFiles = bins.length;
  const totalBinUnits = bins.reduce((sum, b) => sum + b.quantity, 0);

  const lines: string[] = [
    '═══════════════════════════════════════════════════',
    '  Gridfinity Layout Export',
    '═══════════════════════════════════════════════════',
    '',
    `  Layout:   ${layoutName}`,
    `  Format:   ${format.toUpperCase()}`,
    `  Bins:     ${totalBinUnits} (${totalBinFiles} unique ${plural(totalBinFiles, 'design')})`,
  ];
  if (baseplate) {
    lines.push(`  Baseplate: ${baseplate.pieceCount} ${plural(baseplate.pieceCount, 'file')}`);
  }
  lines.push('');

  lines.push('─── Bins ────────────────────────────────────────', '');
  if (bins.length === 0) {
    lines.push('  (no linked bin designs to export)', '');
  } else {
    for (const b of bins) {
      lines.push(`  ${b.path}`);
      lines.push(`    Design:    ${b.designName}`);
      lines.push(`    Size:      ${b.widthUnits} × ${b.depthUnits} × ${b.heightUnits} units`);
      lines.push(`    Quantity:  ${b.quantity}`);
      if (b.companions && b.companions.length > 0) {
        lines.push(`    Includes:  ${b.companions.join(', ')}`);
      }
      lines.push(
        `    Estimate:  ~${b.filamentGrams.toFixed(1)} g, ~${formatTime(b.printTimeMinutes)} each`
      );
      lines.push('');
    }
    lines.push(
      `  Estimated total: ~${totals.filamentGrams.toFixed(0)} g, ~${formatTime(totals.printTimeMinutes)}`,
      '  Estimates assume a standard bin (walls + floor + lip); custom features such',
      '  as cutouts, dividers and compartments are not accounted for.',
      ''
    );
  }

  if (baseplate) {
    lines.push('─── Baseplate ───────────────────────────────────', '');
    lines.push(
      `  ${baseplate.pieceCount} ${plural(baseplate.pieceCount, 'file')} in the baseplate/ folder.`
    );
    if (baseplate.guidePath) {
      lines.push(`  See ${baseplate.guidePath} for the assembly map and per-piece details.`);
    }
    lines.push('');
  }

  const skippedLines: string[] = [];
  if (skipped.unlinkedBins > 0) {
    skippedLines.push(
      `  ${skipped.unlinkedBins} grid ${plural(skipped.unlinkedBins, 'bin')} skipped (not linked to a saved design).`
    );
  }
  if (skipped.nonBinDesigns > 0) {
    skippedLines.push(
      `  ${skipped.nonBinDesigns} linked ${plural(skipped.nonBinDesigns, 'design')} skipped (not a bin — no printable geometry).`
    );
  }
  if (skipped.missingDesigns > 0) {
    skippedLines.push(
      `  ${skipped.missingDesigns} linked ${plural(skipped.missingDesigns, 'design')} skipped (could not be loaded).`
    );
  }
  if (skipped.meshDesignsStepSkipped !== undefined && skipped.meshDesignsStepSkipped > 0) {
    skippedLines.push(
      `  ${skipped.meshDesignsStepSkipped} imported ${plural(skipped.meshDesignsStepSkipped, 'design')} skipped (STEP is not available for imported meshes — export STL or 3MF).`
    );
  }
  if (skippedLines.length > 0) {
    lines.push('─── Skipped ─────────────────────────────────────', '');
    lines.push(
      '  Only bins linked to a saved bin-designer design are exported. Skipped:',
      ...skippedLines,
      ''
    );
  }

  lines.push(
    '─────────────────────────────────────────────────',
    '  Generated by Gridfinity Layout Tool',
    '  https://gridfinitylayouttool.com',
    '─────────────────────────────────────────────────'
  );

  return lines.join('\n');
}
