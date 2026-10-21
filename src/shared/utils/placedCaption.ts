/**
 * A placed bin's layout label as its linked design's caption.
 *
 * Several layout bins link to one design, and a design with a single label
 * caption has nowhere to say which bin holds what. When that one caption is
 * blank, each placement prints its own layout label there instead. A design
 * with several captions has no sensible label-to-caption mapping, and one with
 * its own text keeps it, so neither changes.
 *
 * An overlay on the params a placement is built from, like a placed overhang or
 * slant: nothing here is persisted onto the design or the bin.
 */

import type { BinParams, LabelTabFit } from '@/shared/types/bin';
import { spanningTabEligible } from '@/shared/types/bin';
import { effectiveLabelSocketClearance } from '@/shared/constants/labelPlates';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { isPartialMask } from './cellMask';
import { labelTabsSpanRows } from './labelSocketPlan';
import { isSlottedBody } from './slotFreeWalls';

export interface CaptionSlot {
  readonly scope: 'compartment' | 'row';
  readonly index: number;
}

/**
 * The design's caption slot when it has exactly one and it is blank, else null.
 *
 * `nozzleSizeMm` decides whether a socket design's plates fall back to one per
 * row, so it must be the nozzle the design is built for; it defaults to the one
 * merged onto `params` at a generation boundary.
 */
export function blankCaptionSlot(
  params: BinParams,
  nozzleSizeMm: number | undefined = params.nozzleSizeMm
): CaptionSlot | null {
  const { label, compartments } = params;
  // Neither a slotted body nor a custom footprint builds label tabs.
  if (!label.enabled || isSlottedBody(params) || isPartialMask(params.cellMask)) return null;

  const inner = cutoutInterior(params);
  const clearanceMm = effectiveLabelSocketClearance(nozzleSizeMm, label.plateFitOffset);
  if (labelTabsSpanRows(params, inner.innerW, clearanceMm)) {
    const row = soleTabRow(params, inner.innerD);
    if (row === null || (label.rowTexts?.[row] ?? '').trim() !== '') return null;
    return { scope: 'row', index: row };
  }

  if (new Set(compartments.cells).size !== 1) return null;
  const id = compartments.cells[0];
  if ((compartments.compartmentTexts?.[id] ?? '').trim() !== '') return null;
  return { scope: 'compartment', index: id };
}

// Judged by the worker's own eligibility, as the designer's row list is, so the
// one row it offers a caption field for is the one this fills.
function soleTabRow(params: BinParams, innerDmm: number): number | null {
  const { label, compartments } = params;
  const edges = label.edges ?? 'back';
  const fit: LabelTabFit = {
    tabDepth: label.depth,
    inset: label.inset ?? 0,
    cellD: innerDmm / compartments.rows,
    bothEdges: edges === 'both',
  };
  let sole: number | null = null;
  for (let row = 0; row < compartments.rows; row++) {
    const hosts =
      ((edges === 'back' || edges === 'both') &&
        spanningTabEligible(compartments, row, 'back', fit)) ||
      ((edges === 'front' || edges === 'both') &&
        spanningTabEligible(compartments, row, 'front', fit));
    if (!hosts) continue;
    if (sole !== null) return null;
    sole = row;
  }
  return sole;
}

export function placementCaption(binLabel: string): string | null {
  const caption = binLabel.trim();
  return caption === '' ? null : caption;
}

function withEntry(texts: readonly string[] | undefined, index: number, text: string): string[] {
  const next = Array.from(
    { length: Math.max(texts?.length ?? 0, index + 1) },
    (_, i) => texts?.[i] ?? ''
  );
  next[index] = text;
  return next;
}

/**
 * `params` with its blank single caption filled from `binLabel`, or the same
 * reference when the placement keeps the design's captions. Covers plates too:
 * a socket design's caption is what its plate prints.
 */
export function withPlacedCaption(
  params: BinParams,
  binLabel: string,
  nozzleSizeMm?: number
): BinParams {
  const caption = placementCaption(binLabel);
  if (caption === null) return params;
  const slot = blankCaptionSlot(params, nozzleSizeMm);
  if (slot === null) return params;
  if (slot.scope === 'row') {
    return {
      ...params,
      label: { ...params.label, rowTexts: withEntry(params.label.rowTexts, slot.index, caption) },
    };
  }
  return {
    ...params,
    compartments: {
      ...params.compartments,
      compartmentTexts: withEntry(params.compartments.compartmentTexts, slot.index, caption),
    },
  };
}

// A socket tab's caption is printed on its plate, never cut into the tab, so a
// socket design's body stays the design's own and its placements keep sharing
// one mesh and one file.
function tabCarriesCaption(params: BinParams): boolean {
  return (params.label.mode ?? 'text') !== 'socket';
}

export function withPlacedTabCaption(params: BinParams, binLabel: string): BinParams {
  return tabCarriesCaption(params) ? withPlacedCaption(params, binLabel) : params;
}

export function takesPlacedTabCaption(params: BinParams): boolean {
  return tabCarriesCaption(params) && blankCaptionSlot(params) !== null;
}
