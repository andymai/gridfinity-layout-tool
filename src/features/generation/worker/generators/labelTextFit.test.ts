/**
 * Runs against the real kernel and the real font: the whole point of the
 * overflow report is that it agrees with what `buildTextSolid` will decide, and
 * a stubbed text metric would agree with nothing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont } from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planLabelTextOverflow } from './labelTextFit';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
  const buffer = readFileSync(
    resolve(__dirname, '../../../../shared/fonts/assets/AtkinsonHyperlegible-Regular.ttf')
  );
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 30_000);

/** A narrow 1x2 bin: each compartment tab is ~19mm wide, so a long caption
 *  cannot reach `minFontSize` (3mm) and the builder drops it. */
/**
 * Fixtures pin the NEUTRAL type style rather than inheriting the shipped
 * default. What is under test is the host math (does this caption fit this
 * tab, this plate, this band), and reading the design's current look would
 * re-tune every threshold here the next time that look changes.
 */
const params = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  textDefaults: DEFAULT_TEXT_STYLE_DEFAULTS,
  width: 1,
  depth: 2,
  compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
  label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
  ...over,
});

describe('planLabelTextOverflow', () => {
  it('reports nothing when labels are disabled', () => {
    expect(
      planLabelTextOverflow(params({ label: { ...DEFAULT_BIN_PARAMS.label, enabled: false } }))
    ).toEqual([]);
  });

  it('reports nothing for a caption that fits', () => {
    expect(
      planLabelTextOverflow(
        params({
          compartments: {
            cols: 2,
            rows: 1,
            thickness: 1.2,
            cells: [0, 1],
            compartmentTexts: ['M3', ''],
          },
        })
      )
    ).toEqual([]);
  });

  it('reports the compartment whose caption cannot reach the legibility floor', () => {
    const overflow = planLabelTextOverflow(
      params({
        compartments: {
          cols: 2,
          rows: 1,
          thickness: 1.2,
          cells: [0, 1],
          compartmentTexts: ['M3', 'PHILLIPSPANHEADSTAINLESS114'],
        },
      })
    );
    expect(overflow).toEqual([{ scope: 'compartment', index: 1 }]);
  });

  it('does not report a caption that wraps to fit, which used to print blank', () => {
    // The same caption with spaces in it: auto-wrap breaks it across lines
    // rather than dropping it, so there is nothing to report. Before wrapping
    // existed this printed an empty tab and the mesh held no evidence of it.
    const overflow = planLabelTextOverflow(
      params({
        compartments: {
          cols: 1,
          rows: 1,
          thickness: 1.2,
          cells: [0],
          compartmentTexts: ['PHILLIPS PAN HEAD 1-1/4 STAINLESS'],
        },
      })
    );
    expect(overflow).toEqual([]);
  });

  it('reports each overflowing compartment once under edges: both', () => {
    // 'both' plans the same compartment at two anchors with identical widths;
    // reporting per planned slot would double every entry.
    const overflow = planLabelTextOverflow(
      params({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, edges: 'both' },
        compartments: {
          cols: 1,
          rows: 1,
          thickness: 1.2,
          cells: [0],
          compartmentTexts: ['PHILLIPSPANHEADSTAINLESS114'],
        },
      })
    );
    expect(overflow).toEqual([{ scope: 'compartment', index: 0 }]);
  });

  it('keys the report by ROW when the label spans the full width', () => {
    const overflow = planLabelTextOverflow(
      params({
        width: 1,
        depth: 2,
        compartments: { cols: 1, rows: 2, thickness: 1.2, cells: [0, 1] },
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          span: true,
          rowTexts: ['', 'PHILLIPSPANHEADSTAINLESS114'],
        },
      })
    );
    expect(overflow).toEqual([{ scope: 'row', index: 1 }]);
  });

  it('measures the swappable caption against the plate band, icon included', () => {
    // An icon shares the plate's readable band, so it shrinks the text budget
    // by more than a third on a 1U plate. Asserting that CONTRAST — the same
    // caption fitting bare and overflowing beside an icon — proves the plate's
    // own host math is what's measured, without pinning a millimetre threshold
    // that a future margin tweak would invalidate.
    //
    // The caption is long enough that it WRAPS in both cases: what separates
    // them is that the icon leaves too little width for even three lines.
    const socketLabel = {
      ...DEFAULT_BIN_PARAMS.label,
      enabled: true,
      mode: 'socket' as const,
      depth: 14,
    };
    const base = {
      cols: 1,
      rows: 1,
      thickness: 1.2,
      cells: [0],
      compartmentTexts: ['M3 CAP SCREWS A2 STAINLESS HEX'],
    };

    const bare = planLabelTextOverflow(
      params({ width: 1, depth: 2, label: socketLabel, compartments: base })
    );
    const withIcon = planLabelTextOverflow(
      params({
        width: 1,
        depth: 2,
        label: socketLabel,
        compartments: { ...base, labelIcons: ['magnet'] },
      })
    );

    expect(bare).toEqual([]);
    expect(withIcon).toEqual([{ scope: 'compartment', index: 0 }]);
  });

  it('reports a swappable caption once when both edges seat a plate', () => {
    // `edges: 'both'` seats the same compartment's plate at each anchor and both
    // carry the same text, so the raw seat list would report it twice.
    const overflow = planLabelTextOverflow(
      params({
        width: 1,
        depth: 2,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          mode: 'socket',
          depth: 14,
          edges: 'both',
        },
        compartments: {
          cols: 1,
          rows: 1,
          thickness: 1.2,
          cells: [0],
          compartmentTexts: ['M3 CAP SCREWS A2 STAINLESS HEX SOCKET BUTTON HEAD FLANGED SERRATED'],
        },
      })
    );
    expect(overflow).toEqual([{ scope: 'compartment', index: 0 }]);
  });
});
