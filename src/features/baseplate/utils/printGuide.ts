/**
 * Print guide generator for split baseplate exports.
 *
 * Produces a plain-text (.txt) guide included in export ZIPs with:
 * - Header: baseplate dimensions, settings
 * - Piece table: unique shapes with mm dimensions, features, copy counts
 * - ASCII grid map: visual assembly layout, front at bottom
 */

import type { BaseplateParams } from '@/shared/types/bin';
import { resolveConnectorStyle } from '@/shared/types/bin';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';
import type { PieceGroup } from './pieceFingerprint';
import { colToLetter } from './splitPlanner';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

const SOCKET_HEIGHT = GRIDFINITY_SPEC.SOCKET_HEIGHT;
/** Retaining floor thickness above magnet holes (generation-specific, not in GRIDFINITY_SPEC) */
const MAGNET_FLOOR = 0.5;
/** Dovetail tongue protrusion past the slab wall on a male join edge (mm).
 *  Mirrors `TONGUE_PROTRUSION` in `features/generation/.../generatorConstants.ts`. */
const TONGUE_PROTRUSION_MM = 1.5;

export interface PrintGuideInput {
  readonly tiling: BaseplateTiling;
  readonly groups: Map<string, PieceGroup>;
  readonly groupNames: Map<string, string>;
  readonly parentParams: BaseplateParams;
  readonly fileExtension: string;
  readonly baseFileName: string;
  /** Filename of the snap clip part inside the ZIP (e.g. `snap-clip.stl`,
   *  `snap-clip.step`). Only used when `connectorStyle === 'snap'`. */
  readonly snapClipFileName?: string;
}

export function generatePrintGuide(input: PrintGuideInput): string {
  const {
    tiling,
    groups,
    groupNames,
    parentParams,
    fileExtension,
    baseFileName,
    snapClipFileName,
  } = input;

  const sections = [
    generateHeader(tiling, parentParams, groupNames.size),
    generatePieceTable(
      groups,
      groupNames,
      parentParams,
      tiling.pieces,
      fileExtension,
      baseFileName
    ),
    generateGridMap(tiling, groups, groupNames),
  ];

  if (resolveConnectorStyle(parentParams) === 'snap') {
    sections.push(generateSnapClipSection(tiling, snapClipFileName ?? 'snap-clip.stl'));
  }

  sections.push(generateFooter());
  return sections.join('\n\n');
}

function countSnapClips(tiling: BaseplateTiling): number {
  // One clip per cell along each +X/+Y seam — walking only right/back edges
  // matches snapClipPositions.ts and avoids double-counting shared seams.
  let count = 0;
  for (const piece of tiling.pieces) {
    const widthCells = Math.ceil(piece.widthUnits);
    const depthCells = Math.ceil(piece.depthUnits);
    if (piece.edges.right === 'join') count += depthCells;
    if (piece.edges.back === 'join') count += widthCells;
  }
  return count;
}

function generateSnapClipSection(tiling: BaseplateTiling, clipFileName: string): string {
  const clipCount = countSnapClips(tiling);
  return [
    '─── Snap Clips ──────────────────────────────────',
    '',
    `  Quantity:    ${clipCount} clip${clipCount === 1 ? '' : 's'} total`,
    `  File:        ${clipFileName} (one model, print N copies)`,
    '  Material:    PETG recommended (ears must flex elastically)',
    '  Speed:       ~25mm/s — thin walls need slower print',
    '  Layer:       0.2mm',
    '  Infill:      0% with 2 wall loops, 0 top/bottom layers — the clip is',
    '               a thin-walled spring; solid infill defeats the snap action',
    '  Orientation: flat on the build plate, no supports needed',
    '',
    '  Installation: slide the clip into one piece’s seam-edge pocket so',
    '               half its length sits inside; align the second piece’s',
    '               pocket with the protruding half and press the pieces',
    '               together. The clip’s ears compress past the pocket waist',
    '               and snap into the wider mid-section, locking the seam.',
  ].join('\n');
}

function generateHeader(
  tiling: BaseplateTiling,
  params: BaseplateParams,
  uniqueCount: number
): string {
  const features: string[] = [];
  if (params.magnetHoles) features.push('magnets');
  const hasPadding =
    params.paddingLeft > 0 ||
    params.paddingRight > 0 ||
    params.paddingFront > 0 ||
    params.paddingBack > 0;
  if (hasPadding) features.push('padded');
  const style = resolveConnectorStyle(params);
  if (style === 'dovetail') features.push('dovetails');
  else if (style === 'snap') features.push('snap clips');

  const featureStr = features.length > 0 ? features.join(', ') : 'standard';
  const totalPieces = tiling.pieces.length;

  const lines = [
    '═══════════════════════════════════════════════════',
    '  Gridfinity Baseplate Print Guide',
    '═══════════════════════════════════════════════════',
    '',
    `  Grid size:    ${tiling.totalWidthUnits} × ${tiling.totalDepthUnits} units`,
    `  Grid unit:    ${params.gridUnitMm}mm`,
    `  Features:     ${featureStr}`,
    `  Total pieces: ${totalPieces}${totalPieces > 1 ? ` (${uniqueCount} unique)` : ''}`,
  ];

  return lines.join('\n');
}

function generatePieceTable(
  groups: Map<string, PieceGroup>,
  names: Map<string, string>,
  parentParams: BaseplateParams,
  pieces: readonly BaseplatePiece[],
  ext: string,
  baseName: string
): string {
  const lines = ['─── Pieces ──────────────────────────────────────', ''];

  for (const [fp, group] of groups) {
    const name = names.get(fp) ?? 'unknown';
    const params = group.params;
    const count = group.indices.length;

    // Slab dimensions plus dovetail tongue protrusion on join edges where the
    // tongue is male — matches the actual STL bbox so users know what fits the
    // bed. Under preferIdenticalPieces (paired mode) every join edge carries a
    // tongue regardless of side, so both sides of each axis claim protrusion.
    // Only dovetail style protrudes; snap-clip and 'none' have no tongue.
    const parentStyle = resolveConnectorStyle(parentParams);
    const tongue = parentStyle === 'dovetail' ? TONGUE_PROTRUSION_MM : 0;
    const isPaired = !!parentParams.preferIdenticalPieces && parentStyle === 'dovetail';
    const startMale = !parentParams.invertDovetails;
    const widthMm =
      params.width * params.gridUnitMm +
      params.paddingLeft +
      params.paddingRight +
      (params.edges?.left === 'join' && (isPaired || startMale) ? tongue : 0) +
      (params.edges?.right === 'join' && (isPaired || !startMale) ? tongue : 0);
    const depthMm =
      params.depth * params.gridUnitMm +
      params.paddingFront +
      params.paddingBack +
      (params.edges?.front === 'join' && (isPaired || startMale) ? tongue : 0) +
      (params.edges?.back === 'join' && (isPaired || !startMale) ? tongue : 0);
    const heightMm =
      SOCKET_HEIGHT + (parentParams.magnetHoles ? MAGNET_FLOOR + parentParams.magnetDepth : 0);

    // Under preferIdenticalPieces opposite-corner pieces share a mesh, so one
    // of each pair is assembled rotated 180° around its center. Annotate the
    // label so the print guide explains why two slots ship from the same file.
    const positions = group.indices
      .map((i) => {
        const p = pieces[i];
        return p.placementRotationDeg === 180 ? `${p.label} (rotate 180°)` : p.label;
      })
      .join(', ');

    const features: string[] = [];
    if (parentParams.magnetHoles) features.push('magnet holes');
    if (parentStyle === 'dovetail') features.push('dovetails');
    else if (parentStyle === 'snap') features.push('snap clips');
    const hasPadding =
      params.paddingLeft > 0 ||
      params.paddingRight > 0 ||
      params.paddingFront > 0 ||
      params.paddingBack > 0;
    if (hasPadding) {
      const sides: string[] = [];
      if (params.paddingLeft > 0) sides.push(`${params.paddingLeft}mm left`);
      if (params.paddingRight > 0) sides.push(`${params.paddingRight}mm right`);
      if (params.paddingFront > 0) sides.push(`${params.paddingFront}mm front`);
      if (params.paddingBack > 0) sides.push(`${params.paddingBack}mm back`);
      features.push(`padding: ${sides.join(', ')}`);
    }

    const fileName = `${baseName}_${name}${ext}`;
    const copyText = count === 1 ? 'Print 1 copy' : `Print ${count} copies`;

    lines.push(`  ${name} (${fileName})`);
    lines.push(`    Grid:      ${params.width} × ${params.depth} units`);
    lines.push(
      `    Size:      ${widthMm.toFixed(1)} × ${depthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm`
    );
    if (features.length > 0) {
      lines.push(`    Features:  ${features.join(', ')}`);
    }
    lines.push(`    ${copyText} → ${positions}`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateGridMap(
  tiling: BaseplateTiling,
  groups: Map<string, PieceGroup>,
  names: Map<string, string>
): string {
  // Build lookup: piece index → group name
  const pieceNameLookup = new Map<number, string>();
  for (const [fp, group] of groups) {
    const name = names.get(fp) ?? '?';
    for (const idx of group.indices) {
      pieceNameLookup.set(idx, name);
    }
  }

  const maxNameLen = Math.max(...[...names.values()].map((n) => n.length), 3);
  const cellWidth = maxNameLen + 4; // "[ name  ]"

  const lines = ['─── Assembly Layout (front of drawer at bottom) ─', ''];

  // Precompute (col, row) → piece index for O(1) lookups
  const gridLookup = new Map<string, number>();
  for (let i = 0; i < tiling.pieces.length; i++) {
    const p = tiling.pieces[i];
    gridLookup.set(`${p.col},${p.row}`, i);
  }

  // Rows printed top-to-bottom (highest row at top, Row 1 at bottom)
  for (let r = tiling.rows - 1; r >= 0; r--) {
    const rowLabel = `Row ${r + 1}:`.padEnd(8);
    const cells: string[] = [];

    for (let c = 0; c < tiling.cols; c++) {
      const pieceIdx = gridLookup.get(`${c},${r}`);
      const name = pieceIdx !== undefined ? (pieceNameLookup.get(pieceIdx) ?? '?') : '?';
      const padded = name.padEnd(maxNameLen);
      cells.push(`[ ${padded} ]`);
    }

    lines.push(`  ${rowLabel}${cells.join('')}`);
  }

  // Column labels
  const colLabels: string[] = [];
  for (let c = 0; c < tiling.cols; c++) {
    colLabels.push(`Col ${colToLetter(c)}`.padEnd(cellWidth));
  }
  lines.push(`  ${''.padEnd(8)}${colLabels.join('')}`);
  lines.push('');
  lines.push('  ▼ Front of drawer');

  return lines.join('\n');
}

function generateFooter(): string {
  return [
    '─────────────────────────────────────────────────',
    '  Generated by Gridfinity Layout Tool',
    '  https://gridfinity.xyz',
    '─────────────────────────────────────────────────',
  ].join('\n');
}
