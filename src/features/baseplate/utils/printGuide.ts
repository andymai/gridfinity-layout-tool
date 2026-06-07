/**
 * Print guide generator for split baseplate exports.
 *
 * Produces a plain-text (.txt) guide included in export ZIPs with:
 * - Header: baseplate dimensions, settings
 * - Piece table: unique shapes with mm dimensions, features, copy counts
 * - ASCII grid map: visual assembly layout, front at bottom
 */

import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';
import type { PieceGroup } from './pieceFingerprint';
import { colToLetter } from './splitPlanner';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  TONGUE_PROTRUSION,
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  SNAP_CLIP_CLEARANCE,
  effectiveClearance,
} from '@/shared/constants/connectors';

const SOCKET_HEIGHT = GRIDFINITY_SPEC.SOCKET_HEIGHT;
/** Retaining floor thickness above magnet holes (generation-specific, not in GRIDFINITY_SPEC) */
const MAGNET_FLOOR = 0.5;

export interface PrintGuideInput {
  readonly tiling: BaseplateTiling;
  readonly groups: Map<string, PieceGroup>;
  readonly groupNames: Map<string, string>;
  readonly parentParams: BaseplateParams;
  readonly fileExtension: string;
  readonly baseFileName: string;
  /** Dovetail key part, when present — printed `count` times. */
  readonly connectorKey?: { readonly fileName: string; readonly count: number };
}

export function generatePrintGuide(input: PrintGuideInput): string {
  const { tiling, groups, groupNames, parentParams, fileExtension, baseFileName, connectorKey } =
    input;

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
    ...(connectorKey ? [generateConnectorKeySection(connectorKey, parentParams)] : []),
    generateGridMap(tiling, groups, groupNames),
    generateFooter(),
  ];

  return sections.join('\n\n');
}

function generateConnectorKeySection(
  key: { fileName: string; count: number },
  params: BaseplateParams
): string {
  const copyText = key.count === 1 ? 'Print 1 copy' : `Print ${key.count} copies`;
  const offset = params.connectorFitOffset ?? 0;
  const isSnapClip = params.connectorStyle === 'snapClip';
  // Total clearance = both per-side pocket walls of the seated part combined.
  const baseClearance = isSnapClip ? SNAP_CLIP_CLEARANCE : DOVETAIL_KEY_CLEARANCE;
  const totalClearance = 2 * effectiveClearance(baseClearance, offset);
  const partName = isSnapClip ? 'snap_clip' : 'dovetail_key';
  const seatLine = isSnapClip
    ? '    Press one into each seam junction from the top until it clicks; the bridge sits flush.'
    : '    Hammer one into each seam junction from the top, flush with the surface.';
  const fitNote =
    offset === 0
      ? `    Fit is a tight press fit (~${totalClearance.toFixed(2)}mm total clearance). For best results:`
      : `    Fit offset ${formatSignedMm(offset)} applied → ~${totalClearance.toFixed(2)}mm total clearance. For best results:`;
  const tips = isSnapClip
    ? [
        '      • Use a 0.4mm nozzle — larger nozzles lose the barb detail.',
        '      • Set initial-layer horizontal expansion to about -0.1 to -0.2mm to',
        '        cancel first-layer squish (the biggest cause of an over-tight clip).',
        '      • Print flat on the bed (as oriented) so the barbs print in-plane; 2+ walls.',
        "      • Won't click in? Raise the Connector fit offset (looser). Too loose? Lower it.",
      ]
    : [
        '      • Use a 0.4mm nozzle — larger nozzles lose the dovetail detail.',
        '      • Set initial-layer horizontal expansion to about -0.1 to -0.2mm to',
        '        cancel first-layer squish (the biggest cause of an over-tight key).',
        '      • Print the key flat on the bed (as oriented); 2+ walls.',
        "      • Won't seat? Raise the Connector fit offset (looser). Too loose? Lower it.",
      ];
  return [
    '─── Connector keys ──────────────────────────────',
    '',
    `  ${partName} (${key.fileName})`,
    `    ${copyText}`,
    seatLine,
    '',
    fitNote,
    ...tips,
  ].join('\n');
}

/** Signed mm string for print-guide notes, e.g. "+0.05mm", "-0.10mm". */
function formatSignedMm(value: number): string {
  // toFixed(2) matches the 0.05 step precision and the clearance values already
  // printed with toFixed(2) in this file, and guards against float noise if a
  // future path writes connectorFitOffset without snapping.
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}mm`;
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
  if (params.connectorNubs)
    features.push(
      params.connectorStyle === 'dovetailKey'
        ? 'dovetail key connectors'
        : params.connectorStyle === 'snapClip'
          ? 'snap clip connectors'
          : 'connectors'
    );

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

  // Surface the connector fit offset whenever connectors are on and the user
  // has dialed it off-nominal — applies to the integral dovetail (which has no
  // dedicated tuning section) as well as the dovetail key.
  const offset = params.connectorFitOffset ?? 0;
  if (params.connectorNubs && offset !== 0) {
    const baseClearance =
      params.connectorStyle === 'dovetailKey'
        ? DOVETAIL_KEY_CLEARANCE
        : params.connectorStyle === 'snapClip'
          ? SNAP_CLIP_CLEARANCE
          : TONGUE_CLEARANCE;
    const perSide = effectiveClearance(baseClearance, offset);
    lines.push(
      `  Connector fit: ${formatSignedMm(offset)} (${perSide.toFixed(3)}mm per-side clearance)`
    );
  }

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
    // Dovetail key and snap clip connectors are flush at the seam (both sides
    // female), so no tongue protrusion is added to the piece bbox — only the
    // integral dovetail protrudes.
    const isIntegralDovetail =
      parentParams.connectorStyle === undefined || parentParams.connectorStyle === 'dovetail';
    const tongue = parentParams.connectorNubs && isIntegralDovetail ? TONGUE_PROTRUSION : 0;
    const isPaired = !!parentParams.preferIdenticalPieces && !!parentParams.connectorNubs;
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
    if (parentParams.connectorNubs)
      features.push(
        parentParams.connectorStyle === 'dovetailKey'
          ? 'dovetail key grooves'
          : parentParams.connectorStyle === 'snapClip'
            ? 'snap clip pockets'
            : 'connectors'
      );
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
    '  https://gridfinitylayouttool.com',
    '─────────────────────────────────────────────────',
  ].join('\n');
}
