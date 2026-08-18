import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { FittedFloorLabel } from './FittedFloorLabel';

type Props = Record<string, unknown>;

const mocks = vi.hoisted(() => ({ text: null as Props | null, line: null as Props | null }));

vi.mock('@react-three/drei', () => ({
  Text: (props: Props) => {
    mocks.text = props;
    return <div data-testid="r3f-text">{props.children as ReactNode}</div>;
  },
  Line: (props: Props) => {
    mocks.line = props;
    return <div data-testid="r3f-line" />;
  },
}));

/**
 * A troika sync payload. `blockBounds` spans the whole block (the band once
 * wrapped); `visibleBounds` is tight to the glyphs. Both are anchored, so a
 * centered block straddles x = 0 and a top-anchored one hangs below y = 0.
 */
function mesh(naturalWidth: number, blockHeight = 8.4, inkInset = 0.5) {
  const half = naturalWidth / 2;
  return {
    textRenderInfo: {
      blockBounds: [-half, -blockHeight, half, 0],
      visibleBounds: [-half + inkInset, -blockHeight + 1, half - inkInset, -1],
    },
  };
}

function sync(payload: unknown): void {
  const onSync = mocks.text?.onSync as ((m: unknown) => void) | undefined;
  if (!onSync) throw new Error('Text was rendered without an onSync handler');
  act(() => onSync(payload));
}

function baseProps() {
  return {
    text: 'HEX DRIVER BITS',
    band: 120,
    baseFontSize: 7,
    minFontSize: 5,
    position: [0, -53, 0.01] as [number, number, number],
    color: '#ffffff',
    fillOpacity: 0.6,
  };
}

describe('FittedFloorLabel', () => {
  beforeEach(() => {
    mocks.text = null;
    mocks.line = null;
  });

  it('centres each line, not just the block', () => {
    // troika anchors a wrapped block on maxWidth, so without textAlign the
    // short last line sits left of centre. This is the alignment defect.
    render(<FittedFloorLabel {...baseProps()} />);
    expect(mocks.text?.textAlign).toBe('center');
    expect(mocks.text?.anchorX).toBe('center');
  });

  it('lets an unbreakable word wrap instead of overflowing the band', () => {
    render(<FittedFloorLabel {...baseProps()} />);
    expect(mocks.text?.overflowWrap).toBe('break-word');
  });

  it('measures at the base size, unwrapped, and invisible', () => {
    render(<FittedFloorLabel {...baseProps()} />);
    expect(mocks.text?.fontSize).toBe(7);
    expect(mocks.text?.maxWidth).toBeUndefined();
    expect(mocks.text?.fillOpacity).toBe(0);
    expect(mocks.text?.children).toBe('HEX DRIVER BITS');
  });

  it('anchors the block by its top, half a base line above the datum', () => {
    const { container } = render(<FittedFloorLabel {...baseProps()} />);
    expect(mocks.text?.anchorY).toBe('top');
    // 7mm at lineHeight 1.2 → a single line still centres on the caller's datum.
    expect(mocks.text?.position).toEqual([0, 4.2, 0]);
    expect(container.querySelector('group')?.getAttribute('position')).toBe('0,-53,0.01');
  });

  it('reveals the label at the base size once a short name measures', () => {
    render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(90));
    expect(mocks.text?.fontSize).toBe(7);
    expect(mocks.text?.maxWidth).toBeUndefined();
    expect(mocks.text?.fillOpacity).toBe(0.6);
  });

  it('shrinks a long name onto one line', () => {
    render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(145));
    expect(mocks.text?.fontSize).toBeCloseTo(5.79, 2);
    expect(mocks.text?.maxWidth).toBeUndefined();
  });

  it('wraps rather than shrinking below the floor', () => {
    render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(180));
    expect(mocks.text?.fontSize).toBe(7);
    expect(mocks.text?.maxWidth).toBe(120);
  });

  it('truncates when a wrapped block at the floor still overflows', () => {
    render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(700));
    expect(mocks.text?.children).toMatch(/…$/);
    expect(mocks.text?.fontSize).toBe(5);
  });

  it('re-measures when the text changes', () => {
    const { rerender } = render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(145));
    expect(mocks.text?.fontSize).toBeCloseTo(5.79, 2);

    rerender(<FittedFloorLabel {...baseProps()} text="BITS" />);
    expect(mocks.text?.fontSize).toBe(7);
    expect(mocks.text?.fillOpacity).toBe(0);
  });

  it('re-measures when letterSpacing changes', () => {
    // Letter spacing changes glyph layout, so the old measurement no longer
    // describes the text and must not be reused.
    const { rerender } = render(<FittedFloorLabel {...baseProps()} letterSpacing={0.08} />);
    sync(mesh(145));
    expect(mocks.text?.fillOpacity).toBe(0.6);

    rerender(<FittedFloorLabel {...baseProps()} letterSpacing={0.4} />);
    expect(mocks.text?.fillOpacity).toBe(0);
    expect(mocks.text?.fontSize).toBe(7);
  });

  // The natural width does not depend on the band, so a band change re-fits
  // synchronously from the stored measurement — no troika round trip, and
  // never a transparent frame. Keying the measurement on the band made a
  // settled fit permanently invisible after a resize: the re-rendered props
  // equalled the layout troika already had, its sync() is a no-op without a
  // syncable-prop change, and onSync never fired again.
  it('re-fits from the stored measurement when the band changes', () => {
    const { rerender } = render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(145));
    expect(mocks.text?.fillOpacity).toBe(0.6);
    const shrunk = mocks.text?.fontSize as number;
    expect(shrunk).toBeLessThan(7);

    // A wider band relaxes the fit back to the base size, still visible.
    rerender(<FittedFloorLabel {...baseProps()} band={252} />);
    expect(mocks.text?.fillOpacity).toBe(0.6);
    expect(mocks.text?.fontSize).toBe(7);
  });

  it('stays visible when the band changes on a settled fit', () => {
    // The exact reported ordering: a short name settles at the base size,
    // then the bin is widened. The re-render carries props identical to the
    // settled layout, so no sync ever fires again — visibility must not
    // depend on one.
    const { rerender } = render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(90));
    expect(mocks.text?.fillOpacity).toBe(0.6);

    rerender(<FittedFloorLabel {...baseProps()} band={189} />);
    expect(mocks.text?.fillOpacity).toBe(0.6);
    expect(mocks.text?.fontSize).toBe(7);
    expect(mocks.text?.maxWidth).toBeUndefined();
  });

  it('re-measures when the text changes', () => {
    const { rerender } = render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(145));
    expect(mocks.text?.fillOpacity).toBe(0.6);

    rerender(<FittedFloorLabel {...baseProps()} text="NEW NAME" />);
    expect(mocks.text?.fillOpacity).toBe(0);
    expect(mocks.text?.fontSize).toBe(7);
    expect(mocks.text?.maxWidth).toBeUndefined();
  });

  it('draws no underline unless one is asked for', () => {
    const { queryByTestId } = render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(90));
    expect(queryByTestId('r3f-line')).toBeNull();
  });

  it('has ink ready if the underline is switched on after measuring', () => {
    // troika will not re-sync for a caller-side prop it does not consume, so
    // ink captured only when an underline was already wanted would stay null.
    const { rerender, getByTestId } = render(<FittedFloorLabel {...baseProps()} />);
    sync(mesh(90));

    rerender(<FittedFloorLabel {...baseProps()} underline={{ gap: 0.45, opacity: 0.25 }} />);
    expect(getByTestId('r3f-line')).toBeTruthy();
  });

  it('spans the underline across the ink and drops it below the last line', () => {
    const { getByTestId } = render(
      <FittedFloorLabel {...baseProps()} underline={{ gap: 0.45, opacity: 0.25 }} />
    );
    sync(mesh(90));

    expect(getByTestId('r3f-line')).toBeTruthy();
    const points = mocks.line?.points as [number, number, number][];
    // visibleBounds, not blockBounds — the widest line, not the band.
    expect(points[0][0]).toBeCloseTo(-44.5, 6);
    expect(points[1][0]).toBeCloseTo(44.5, 6);
    // Block bottom is topY (4.2) - 8.4, then the gap below that.
    expect(points[0][1]).toBeCloseTo(-4.65, 6);
    expect(points[0][1]).toBe(points[1][1]);
  });

  it('measures the ink in the measuring pass when the fit changes nothing', () => {
    // troika's sync() is a no-op when no layout input changed, so a fit that
    // leaves every prop alone never gets a second callback. One sync has to be
    // enough or the underline never appears on a name that already fits.
    const { getByTestId } = render(
      <FittedFloorLabel {...baseProps()} underline={{ gap: 0.45, opacity: 0.25 }} />
    );
    sync(mesh(90));
    expect(getByTestId('r3f-line')).toBeTruthy();
  });

  it('measures the ink on the applied pass when the fit did change props', () => {
    const { queryByTestId, getByTestId } = render(
      <FittedFloorLabel {...baseProps()} underline={{ gap: 0.45, opacity: 0.25 }} />
    );
    sync(mesh(180)); // wraps → props changed → troika re-lays-out and calls back again
    expect(queryByTestId('r3f-line')).toBeNull();

    sync(mesh(120, 16.8));
    expect(getByTestId('r3f-line')).toBeTruthy();
    const points = mocks.line?.points as [number, number, number][];
    expect(points[0][1]).toBeCloseTo(4.2 - 16.8 - 0.45, 6);
  });

  it('ignores a sync that carries no render info', () => {
    render(<FittedFloorLabel {...baseProps()} />);
    sync({ textRenderInfo: null });
    expect(mocks.text?.fillOpacity).toBe(0);
  });

  it('ignores a degenerate ink measurement rather than drawing a zero-width rule', () => {
    const { queryByTestId } = render(
      <FittedFloorLabel {...baseProps()} underline={{ gap: 0.45, opacity: 0.25 }} />
    );
    sync({
      textRenderInfo: { blockBounds: [-45, -8.4, 45, 0], visibleBounds: [0, 0, 0, 0] },
    });
    expect(queryByTestId('r3f-line')).toBeNull();
  });
});
