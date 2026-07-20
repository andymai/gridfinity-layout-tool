/**
 * Pure planning step for the swappable-label-plate half of a whole-layout
 * export (#2666, PR 3).
 *
 * Enumerates socket-mode linked designs, derives their plate sets via the
 * same plan math that cut the sockets, multiplies by placed-bin quantities
 * (each socket wants its own plate), and shelf-packs everything onto
 * bed-sized sheets. Sheets never mix designs — text style options ride
 * per-request, and different designs may use different fonts/modes.
 *
 * Spanning-socket designs label whole bins, so their plate text comes from
 * each placed bin's label (falling back to the design name) rather than
 * from compartment texts.
 */

import type { Bin } from '@/core/types';
import type { TextStyleDefaults } from '@/shared/types/bin';
// Deep import (not the barrel): this code only runs inside the lazy
// layout-export chunk (same rationale as planLayoutBinExport's deep imports).
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import {
  LABEL_PLATE_HEIGHT_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { planLabelPlates } from '@/shared/utils/labelSocketPlan';
import type { LoadedDesign } from './planLayoutBinExport';

/** One plate placed on a sheet, center coordinates in mm (sheet-centered). */
export interface PlacedLabelPlate {
  readonly widthU: LabelPlateWidthU;
  readonly text: string;
  readonly position: readonly [number, number];
}

export interface LabelPlateManifestEntry {
  readonly widthU: LabelPlateWidthU;
  readonly text: string;
  readonly quantity: number;
}

export interface LabelPlateDesignGroup {
  readonly designName: string;
  readonly textDefaults: TextStyleDefaults;
  readonly sheets: readonly (readonly PlacedLabelPlate[])[];
  readonly manifestPlates: readonly LabelPlateManifestEntry[];
}

export interface LabelPlateExportPlan {
  readonly groups: readonly LabelPlateDesignGroup[];
  readonly totalPlates: number;
}

/** Border kept clear around each sheet and gap between plates (mm). */
const SHEET_MARGIN = 10;
const SHEET_GAP = 4;

/**
 * Shelf-pack plates (already expanded to physical quantities) onto sheets of
 * `bedW × bedD` mm, widest-first so long plates anchor rows. Returns sheets
 * of centered plate positions. Plates wider than the usable bed are dropped
 * by the caller's fit test before this runs (standard widths cap at 120mm).
 */
function packSheets(
  plates: readonly { widthU: LabelPlateWidthU; text: string }[],
  bedW: number,
  bedD: number
): (readonly PlacedLabelPlate[])[] {
  const usableW = bedW - 2 * SHEET_MARGIN;
  const usableD = bedD - 2 * SHEET_MARGIN;
  const rowPitch = LABEL_PLATE_HEIGHT_MM + SHEET_GAP;
  const sorted = [...plates].sort((a, b) => b.widthU - a.widthU);

  const sheets: PlacedLabelPlate[][] = [];
  let current: { plates: { widthU: LabelPlateWidthU; text: string; x: number; y: number }[] } = {
    plates: [],
  };
  let cursorX = 0;
  let cursorY = 0;

  const flush = (): void => {
    if (current.plates.length === 0) return;
    // Center the packed extent on the origin.
    const maxX = Math.max(...current.plates.map((p) => p.x + labelPlateWidthMm(p.widthU)));
    const maxY = Math.max(...current.plates.map((p) => p.y + LABEL_PLATE_HEIGHT_MM));
    sheets.push(
      current.plates.map((p) => ({
        widthU: p.widthU,
        text: p.text,
        position: [
          p.x + labelPlateWidthMm(p.widthU) / 2 - maxX / 2,
          p.y + LABEL_PLATE_HEIGHT_MM / 2 - maxY / 2,
        ] as const,
      }))
    );
    current = { plates: [] };
    cursorX = 0;
    cursorY = 0;
  };

  for (const plate of sorted) {
    const w = labelPlateWidthMm(plate.widthU);
    if (cursorX > 0 && cursorX + w > usableW) {
      cursorX = 0;
      cursorY += rowPitch;
    }
    if (cursorY + LABEL_PLATE_HEIGHT_MM > usableD) {
      flush();
    }
    current.plates.push({ widthU: plate.widthU, text: plate.text, x: cursorX, y: cursorY });
    cursorX += w + SHEET_GAP;
  }
  flush();
  return sheets;
}

export function planLabelPlateExport(
  bins: Bin[],
  loaded: readonly LoadedDesign[],
  bedWidthMm: number,
  bedDepthMm: number
): LabelPlateExportPlan {
  const designById = new Map(
    loaded.filter((l) => l.design?.params).map((l) => [l.id, l.design] as const)
  );

  const groups: LabelPlateDesignGroup[] = [];
  let totalPlates = 0;

  for (const [id, design] of designById) {
    const params = design?.params;
    if (!design || !params) continue;
    if (!params.label.enabled || (params.label.mode ?? 'text') !== 'socket') continue;

    const linkedBins = bins.filter((b) => b.linkedDesignId === id);
    if (linkedBins.length === 0) continue;

    const clearanceMm = effectiveLabelSocketClearance(undefined, params.label.plateFitOffset);
    const planned = planLabelPlates(
      params.compartments,
      binDimensions(params).innerW,
      clearanceMm,
      ''
    );
    if (planned.length === 0) continue;

    // Expand to physical plates: per-compartment plates repeat per placed
    // bin; a spanning plate instead takes each bin's own label text.
    const spanning = planned.length === 1 && planned[0].compartmentId === null;
    const physical: { widthU: LabelPlateWidthU; text: string }[] = spanning
      ? linkedBins.map((b) => ({
          widthU: planned[0].widthU,
          text: (b.label ?? '').trim() || design.name,
        }))
      : linkedBins.flatMap(() => planned.map((p) => ({ widthU: p.widthU, text: p.text })));

    // Manifest quantities collapse identical (width, text) plates.
    const counts = new Map<string, LabelPlateManifestEntry>();
    for (const p of physical) {
      const key = `${p.widthU}|${p.text}`;
      const existing = counts.get(key);
      if (existing) {
        counts.set(key, { ...existing, quantity: existing.quantity + 1 });
      } else {
        counts.set(key, { widthU: p.widthU, text: p.text, quantity: 1 });
      }
    }

    totalPlates += physical.length;
    groups.push({
      designName: design.name,
      textDefaults: params.textDefaults,
      sheets: packSheets(physical, bedWidthMm, bedDepthMm),
      manifestPlates: [...counts.values()],
    });
  }

  return { groups, totalPlates };
}
