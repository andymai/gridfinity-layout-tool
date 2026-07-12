/**
 * Print guide generator for split baseplate exports.
 *
 * Produces a plain-text (.txt) guide included in export ZIPs with:
 * - Header: baseplate dimensions, settings
 * - Piece table: unique shapes with mm dimensions, features, copy counts
 * - ASCII grid map: visual assembly layout, front at bottom
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { StackPrintParams } from '@/core/types';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';
import type { PieceGroup } from './pieceFingerprint';
import { colToLetter } from './splitPlanner';
import { planPhysicalStacks } from './stackPrint';
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
  readonly parentParams: ResolvedBaseplateParams;
  readonly fileExtension: string;
  readonly baseFileName: string;
  /** Dovetail key part, when present — printed `count` times. */
  readonly connectorKey?: { readonly fileName: string; readonly count: number };
  /** Detached margin rails (issue #2392), when present — each is its own file. */
  readonly margins?: readonly {
    readonly fileName: string;
    readonly side: string;
    readonly lengthMm: number;
    readonly bandThicknessMm: number;
  }[];
  /** Stack-print config, when enabled — each file is a pre-stacked tower. */
  readonly stackPrint?: StackPrintParams;
  /** Max tiles per stack (from the printer's build height). */
  readonly stackCap?: number;
  /** Whole-layout copy multiplier (stacking only); ≥1, defaults to 1. */
  readonly copies?: number;
}

export function generatePrintGuide(input: PrintGuideInput): string {
  const { tiling, groups, groupNames, parentParams, fileExtension, baseFileName, connectorKey } =
    input;
  const stackPrint = input.stackPrint?.enabled ? input.stackPrint : undefined;

  const sections = [
    generateHeader(tiling, parentParams, groupNames.size),
    ...(stackPrint ? [generateStackingSection(stackPrint)] : [generateAssemblyIntro()]),
    generatePieceTable(
      groups,
      groupNames,
      parentParams,
      tiling.pieces,
      fileExtension,
      baseFileName,
      stackPrint,
      input.stackCap,
      input.copies
    ),
    ...(connectorKey ? [generateConnectorKeySection(connectorKey, parentParams)] : []),
    ...(input.margins && input.margins.length > 0 ? [generateMarginSection(input.margins)] : []),
    generateGridMap(tiling),
    generateFooter(),
  ];

  return sections.join('\n\n');
}

/**
 * Standalone stack-print note for single-piece exports that have no split
 * piece table (e.g. one plate stacked into several capped-height towers).
 */
export function generateStackPrintNote(stack: StackPrintParams): string {
  return `${generateStackingSection(stack)}\n\n${generateFooter()}`;
}

/**
 * Up-front instruction for the unstacked split export: the ZIP carries one file
 * per piece (named by grid label), so the user prints every file once instead
 * of reading a copy count and duplicating shapes by hand.
 */
function generateAssemblyIntro(): string {
  return [
    '─── How to print ────────────────────────────────',
    '',
    '  This ZIP has ONE FILE PER PIECE, named by its grid position (e.g. A1).',
    '  Print every file once — nothing here needs to be duplicated by hand.',
    '  Pieces that share an identical shape are grouped together below, so a',
    '  reprint can use any copy. Place each piece using the assembly map at the',
    '  bottom of this guide.',
  ].join('\n');
}

/**
 * Standalone margin guide for single-body detached exports that have no split
 * piece table — the unsplit ZIP still ships a guide listing its rail files.
 */
export function generateMarginGuide(margins: NonNullable<PrintGuideInput['margins']>): string {
  return `${generateMarginSection(margins)}\n\n${generateFooter()}`;
}

function generateMarginSection(margins: NonNullable<PrintGuideInput['margins']>): string {
  const rows = margins.map(
    (m) =>
      `  ${m.fileName}  —  ${m.side}, ${m.lengthMm.toFixed(1)} × ${m.bandThicknessMm.toFixed(1)} mm`
  );
  return [
    '─── Detached margins ────────────────────────────',
    '',
    '  These rails are the drawer-fit padding, printed separately. Fit them',
    '  around the body after printing; a misprinted rail can be reprinted alone.',
    '',
    ...rows,
  ].join('\n');
}

function generateStackingSection(stack: StackPrintParams): string {
  const gap = stack.gapMm;
  return [
    '─── Stack printing ──────────────────────────────',
    '',
    '  Each file is a ready-made VERTICAL STACK — print it ONCE to get all of its',
    '  plates in a single job.',
    '',
    '  ORIENTATION — print exactly as oriented in the file. The bottom plate is',
    '  right-side up (solid bed adhesion); every plate above it is flipped upside',
    '  down so the stack prints without supports. Do not lay it flat or re-orient.',
    '',
    '  SLICER SETUP — no special settings and NO supports are needed; slice it as',
    '  a single object and print. The air gap is built into the model, so any',
    `  slicer reproduces it automatically. One rule: keep your layer height AT OR`,
    `  BELOW the ${gap}mm gap. A taller layer height collapses the gap and fuses the`,
    '  plates together.',
    '',
    `  SEPARATION — a ${gap}mm air gap sits between every plate so they don't fuse.`,
    '  After printing, flex the stack or work a thin flat-head screwdriver into',
    '  each gap to crack the plates apart. Go gently.',
    '',
    ...buildEasierSeparation(gap),
  ].join('\n');
}

/**
 * "Easier separation" multi-material steps. The leading "widen the gap" step is
 * only emitted when the gap is still too tight (< 0.4mm) — once the user has
 * already exported at 0.4mm+ it would tell them to redo what they've done, so
 * it is dropped and the remaining steps renumber accordingly.
 */
function buildEasierSeparation(gap: number): string[] {
  const lines = [
    '  EASIER SEPARATION (multi-material / AMS printers, optional)',
    '  Fill each gap with a peel-away support interface in a non-stick filament so',
    '  the plates lift apart with no prying. PETG against PLA (either way round)',
    '  releases cleanly; a dedicated "Support for PLA" filament works too. This is',
    '  all slicer setup — the model itself does not change.',
    '',
  ];
  let step = 1;
  if (gap < 0.4) {
    lines.push(
      `    ${step++}. Give the interface room. A ${gap}mm gap is too tight for a clean`,
      "       interface layer, so set this tool's Gap to about 0.4mm and re-export",
      '       before doing the steps below.'
    );
  }
  lines.push(
    `    ${step++}. Load the non-stick filament as your second material / extruder.`,
    `    ${step++}. Turn on supports and point the support interface at that filament:`,
    '',
    '       PrusaSlicer (Expert mode):',
    '         - Print Settings > Support material > Generate support material: ON',
    '         - Uncheck "Support on build plate only" (the gaps are inside the model)',
    '         - Top contact Z distance: 0 (interface touches, then peels)',
    '         - Top interface layers: 1-2',
    '         - Multiple Extruders > Support material/raft interface extruder: set',
    '           to the non-stick filament',
    '',
    '       Bambu Studio / Orca Slicer:',
    '         - Enable Support (Auto or Manual)',
    '         - Support > Interface filament: the non-stick filament',
    '         - Support > Top Z distance: 0',
    '         - Support > Top interface layers: 1-2',
    '',
    `    ${step}. Slice and check the preview — every gap should be filled with the`,
    '       non-stick color. Print, lift the plates apart, and peel the interface',
    '       layer off each one.'
  );
  return lines;
}

function generateConnectorKeySection(
  key: { fileName: string; count: number },
  params: ResolvedBaseplateParams
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
  params: ResolvedBaseplateParams,
  uniqueCount: number
): string {
  const features: string[] = [];
  if (params.outline !== undefined) features.push('custom drawer shape');
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
    `  Build-plate loads: ${tiling.bedLoads}`,
  ];

  if (params.outline !== undefined && tiling.pieces.length > 1) {
    lines.push(
      '',
      '  Shaped plate: grid positions outside the drawer shape are not',
      '  printed (their labels are skipped below). Seams the shape crosses',
      '  have no connectors — align those pieces by their outline instead.'
    );
  }

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
  parentParams: ResolvedBaseplateParams,
  pieces: readonly BaseplatePiece[],
  ext: string,
  baseName: string,
  stackPrint?: StackPrintParams,
  stackCap?: number,
  copies = 1
): string {
  const lines = ['─── Pieces ──────────────────────────────────────', ''];
  const copyMult = Math.max(1, Math.floor(copies));

  for (const [fp, group] of groups) {
    const name = names.get(fp) ?? 'unknown';
    const params = group.params;
    // Stacking duplicates the whole layout `copyMult` times; the non-stacked
    // path lists physical drawer slots, so it keeps the raw piece count.
    const count = group.indices.length * copyMult;

    // Slab dimensions plus dovetail tongue protrusion on join edges where the
    // tongue is male — matches the actual STL bbox so users know what fits the
    // bed. Under preferIdenticalPieces (paired mode) every join edge carries a
    // tongue regardless of side, so both sides of each axis claim protrusion.
    // Dovetail key and snap clip connectors are flush at the seam (both sides
    // female), so no tongue protrusion is added to the piece bbox — only the
    // integral dovetail protrudes.
    // Integral male-tongue styles (legacy dovetail + puzzle) protrude past the
    // wall; key/clip styles are flush at the seam. Puzzle reach == TONGUE_PROTRUSION.
    const isIntegralTongue =
      parentParams.connectorStyle === undefined ||
      parentParams.connectorStyle === 'dovetail' ||
      parentParams.connectorStyle === 'puzzle';
    const tongue = parentParams.connectorNubs && isIntegralTongue ? TONGUE_PROTRUSION : 0;
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

    lines.push(`  ${name}`);
    lines.push(`    Grid:      ${params.width} × ${params.depth} units`);
    lines.push(
      `    Size:      ${widthMm.toFixed(1)} × ${depthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm`
    );
    if (features.length > 0) {
      lines.push(`    Features:  ${features.join(', ')}`);
    }

    if (stackPrint) {
      // Each physical stack is one file; an over-tall group splits into several.
      const towers = planPhysicalStacks([{ label: name, quantity: count }], stackCap);
      for (let s = 0; s < towers.length; s++) {
        const label = towers.length > 1 ? `${name}_${s + 1}` : name;
        const copies = towers[s].copies;
        const towerH = copies * heightMm + (copies - 1) * stackPrint.gapMm;
        lines.push(
          `    ${baseName}_${label}${ext} — print once = ${copies} plate${copies === 1 ? '' : 's'} (stack ${towerH.toFixed(1)}mm tall)`
        );
      }
      lines.push(`    Assembles: ${positions}`);
    } else {
      // One file per physical slot, named by grid label. Listing the slots that
      // share this shape lets a reprint use any copy; the assembly map places them.
      const fileLabel =
        group.indices.length === 1
          ? 'Print this file once:'
          : `Print each of these ${group.indices.length} files once:`;
      lines.push(`    ${fileLabel}`);
      for (const idx of group.indices) {
        const p = pieces[idx];
        const rot = p.placementRotationDeg === 180 ? '  (rotate 180° to seat)' : '';
        lines.push(`      ${baseName}_${p.label}${ext}${rot}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateGridMap(tiling: BaseplateTiling): string {
  // Each cell shows its piece's grid label, which is exactly the file-name
  // suffix (baseplate_A1.stl → "A1"), so the map doubles as a file-to-slot key.
  const labelLookup = new Map<string, string>();
  let maxNameLen = 3;
  for (const p of tiling.pieces) {
    labelLookup.set(`${p.col},${p.row}`, p.label);
    maxNameLen = Math.max(maxNameLen, p.label.length);
  }
  const cellWidth = maxNameLen + 4; // "[ name  ]"

  const lines = ['─── Assembly Layout (front of drawer at bottom) ─', ''];

  // Rows printed top-to-bottom (highest row at top, Row 1 at bottom)
  for (let r = tiling.rows - 1; r >= 0; r--) {
    const rowLabel = `Row ${r + 1}:`.padEnd(8);
    const cells: string[] = [];

    for (let c = 0; c < tiling.cols; c++) {
      const name = labelLookup.get(`${c},${r}`) ?? '?';
      cells.push(`[ ${name.padEnd(maxNameLen)} ]`);
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
