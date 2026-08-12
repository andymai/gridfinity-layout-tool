/**
 * Renders the root `manifest.txt` for a whole-layout export ZIP.
 *
 * Plain English (it ships inside a downloaded archive, not the UI), listing every
 * exported bin with its quantity + size + rough estimate, the skipped bins, and a
 * pointer to the baseplate print guide. Pure: all data is passed in.
 */

import type { ExportFileFormat } from '@/shared/types/bin';
import type { LabelPlateIconId, LabelPlateWidthU } from '@/shared/constants/labelPlates';

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
  /**
   * Number of pieces this bin ships as when it exceeds the print bed (#3074).
   * Absent for a bin that prints whole.
   */
  readonly splitPieces?: number;
  /** Whether those pieces carry printed alignment connectors. */
  readonly splitConnectors?: boolean;
  /**
   * Companion parts (lid, dividers) that ship at full size even though the body
   * was cut — they are not split, so an oversized design's lid may not fit the
   * bed. Absent when there is nothing to warn about.
   */
  readonly oversizedCompanions?: readonly string[];
  /**
   * Every grid position this entry's mesh is placed at, present only for an
   * extended variant. Several bins on one design can resolve to different
   * overhangs, so the file name alone can't say which goes where — this is the
   * readable mapping from part to place in the drawer.
   *
   * A list, not a single coordinate: entries are grouped by (design, resolved
   * overhang), so identical extended bins share one file and one file can
   * legitimately serve several positions. Sorted; the first element doubles as
   * the deterministic naming anchor.
   */
  readonly atPositions?: readonly { readonly x: number; readonly y: number }[];
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
  /**
   * Bin designs skipped under STEP for carrying a mesh imprint cutout — the
   * pocket is subtracted after tessellation, so the solid STEP would carry is
   * the one WITHOUT it. Skipping keeps the rest of the ZIP: the export used to
   * throw on the first such bin and take the whole layout with it (#3449).
   */
  readonly imprintDesignsStepSkipped?: number;
}

/** One swappable-label sheet family in the labels/ folder (#2666). */
export interface ManifestLabelGroup {
  readonly designName: string;
  readonly sheetPaths: readonly string[];
  /** Unique plates with physical quantities (identical plates collapsed). */
  readonly plates: readonly {
    readonly widthU: LabelPlateWidthU;
    readonly text: string;
    readonly icon?: LabelPlateIconId;
    readonly quantity: number;
  }[];
  /** Plates skipped because they exceed the usable print bed width. */
  readonly oversizedCount?: number;
}

export interface LayoutManifestInput {
  readonly layoutName: string;
  /** The per-file format inside the ZIP. */
  readonly format: ExportFileFormat;
  readonly bins: readonly ManifestBinEntry[];
  /** Present when a baseplate is included; guidePath is set when it ships a guide,
   *  imagePath when it ships a top-view assembly-map PNG. */
  readonly baseplate?: {
    readonly pieceCount: number;
    readonly guidePath?: string;
    readonly imagePath?: string;
  } | null;
  /** Present when socket-mode designs shipped swappable label plates. */
  readonly labels?: readonly ManifestLabelGroup[] | null;
  /**
   * Present when the parts were folded into one slicer project file. The
   * archive then holds a single model file, so the per-bin paths listed below
   * name objects inside it rather than files on disk.
   */
  readonly project?: {
    readonly fileName: string;
    readonly plateCount: number;
    readonly partCount: number;
    /** Parts that exceed the print bed and landed on a plate of their own. */
    readonly oversizeNames: readonly string[];
  } | null;
  readonly skipped: ManifestSkipped;
  readonly totals: { readonly filamentGrams: number; readonly printTimeMinutes: number };
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

/** Cap on listed positions — beyond this the list stops being readable, and the
 *  remainder is stated rather than silently dropped. */
const MAX_LISTED_POSITIONS = 6;

/**
 * `Position:  grid (2.5, 0)` for a single placement, `Positions: grid (0, 0),
 * (2.5, 0), (5, 0)` for several. Singular vs plural matters here: one file can
 * serve many positions, and a singular label would read as "this part goes at
 * exactly one spot".
 */
function positionLabel(positions: readonly { readonly x: number; readonly y: number }[]): string {
  const shown = positions.slice(0, MAX_LISTED_POSITIONS);
  const coords = shown.map((p, i) => (i === 0 ? `grid (${p.x}, ${p.y})` : `(${p.x}, ${p.y})`));
  const hidden = positions.length - shown.length;
  if (hidden > 0) coords.push(`+${hidden} more`);
  return positions.length === 1 ? `Position:  ${coords[0]}` : `Positions: ${coords.join(', ')}`;
}

/** `bins/box_2x2x3.stl` → `bins/box_2x2x3/`, the folder a split bin's pieces
 *  are written into instead of that single file. */
function splitPathPattern(path: string): string {
  const dot = path.lastIndexOf('.');
  return `${dot === -1 ? path : path.slice(0, dot)}/`;
}

function formatTime(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function buildLayoutManifest(input: LayoutManifestInput): string {
  const { layoutName, format, bins, baseplate, skipped, totals, project } = input;
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

  if (project) {
    lines.push(
      '─── Project file ────────────────────────────────',
      '',
      `  ${project.fileName}`,
      `    ${project.partCount} ${plural(project.partCount, 'part')} arranged on ` +
        `${project.plateCount} build ${plural(project.plateCount, 'plate')}.`,
      '    Open it in Bambu Studio or OrcaSlicer and every plate is ready to slice.',
      '    PrusaSlicer has no multi-plate concept and will load the parts onto one plate.'
    );
    if (project.oversizeNames.length > 0) {
      lines.push(
        `    Too large for the bed, each on its own plate: ${project.oversizeNames.join(', ')}`
      );
    }
    lines.push('');
  }

  lines.push('─── Bins ────────────────────────────────────────', '');
  if (bins.length === 0) {
    lines.push('  (no linked bin designs to export)', '');
  } else {
    for (const b of bins) {
      // A split bin ships as `<base>_<piece>.<ext>` — the unsplit path is never
      // written, so printing it verbatim would send the reader hunting for a
      // file the archive doesn't contain.
      lines.push(`  ${b.splitPieces && b.splitPieces > 1 ? splitPathPattern(b.path) : b.path}`);
      lines.push(`    Design:    ${b.designName}`);
      lines.push(`    Size:      ${b.widthUnits} × ${b.depthUnits} × ${b.heightUnits} units`);
      lines.push(`    Quantity:  ${b.quantity}`);
      // Extended variants of one design differ only by overhang, so the file
      // name alone can't say which goes where. This is that mapping.
      if (b.atPositions && b.atPositions.length > 0) {
        lines.push(`    ${positionLabel(b.atPositions)} — extended to fit`);
      }
      if (b.companions && b.companions.length > 0) {
        lines.push(`    Includes:  ${b.companions.join(', ')}`);
      }
      if (b.splitPieces && b.splitPieces > 1) {
        lines.push(
          `    Split:     ${b.splitPieces} pieces — too large for the print bed.`,
          b.splitConnectors === false
            ? '               Print all pieces and join them at the cut faces.'
            : '               Print all pieces and join them with the printed connectors.'
        );
        // The body was cut to fit; its lid and dividers were not, so on a very
        // large design they may still overrun the bed.
        if (b.oversizedCompanions && b.oversizedCompanions.length > 0) {
          lines.push(
            `               ${b.oversizedCompanions.join(' and ')} ship at full size and may need`,
            '               splitting separately in the bin designer.'
          );
        }
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
    if (baseplate.imagePath) {
      lines.push(`  See ${baseplate.imagePath} for a labeled top-view of where each piece goes.`);
    }
    lines.push('');
  }

  const labels = input.labels ?? [];
  if (labels.length > 0) {
    lines.push('─── Label plates ────────────────────────────────', '');
    lines.push(
      '  Swappable label plates for socket-mode bins, packed onto bed-sized',
      '  sheets in the labels/ folder. Print each sheet once (flat, no',
      '  supports); a single filament swap at the text layers prints',
      '  two-color labels.',
      ''
    );
    for (const group of labels) {
      lines.push(`  Design: ${group.designName}`);
      for (const path of group.sheetPaths) {
        lines.push(`    ${path}`);
      }
      for (const p of group.plates) {
        const label = p.text.length > 0 ? `"${p.text}"` : '(blank)';
        const icon = p.icon !== undefined ? ` [${p.icon}]` : '';
        lines.push(`      ${p.quantity}× ${p.widthU}U${icon} ${label}`);
      }
      if (group.oversizedCount !== undefined && group.oversizedCount > 0) {
        lines.push(
          `      ${group.oversizedCount} ${plural(group.oversizedCount, 'plate')} skipped (wider than the print bed).`
        );
      }
      lines.push('');
    }
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
  if (skipped.imprintDesignsStepSkipped !== undefined && skipped.imprintDesignsStepSkipped > 0) {
    skippedLines.push(
      `  ${skipped.imprintDesignsStepSkipped} ${plural(skipped.imprintDesignsStepSkipped, 'design')} skipped (STEP is not available for mesh imprint cutouts — export STL or 3MF).`
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
