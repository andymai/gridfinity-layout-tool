import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { BinNameLabel } from './BinNameLabel';

type Props = Record<string, unknown>;

const mocks = vi.hoisted(() => ({ text: null as Props | null }));

vi.mock('@react-three/drei', () => ({
  Text: (props: Props) => {
    mocks.text = props;
    return <div data-testid="r3f-text">{props.children as ReactNode}</div>;
  },
  Line: () => <div data-testid="r3f-line" />,
}));

function mesh(naturalWidth: number) {
  const half = naturalWidth / 2;
  return {
    textRenderInfo: {
      blockBounds: [-half, -8.4, half, 0],
      visibleBounds: [-half, -7.4, half, -1],
    },
  };
}

function sync(payload: unknown): void {
  const onSync = mocks.text?.onSync as ((m: unknown) => void) | undefined;
  if (!onSync) throw new Error('Text was rendered without an onSync handler');
  act(() => onSync(payload));
}

describe('BinNameLabel', () => {
  beforeEach(() => {
    mocks.text = null;
  });

  it('renders the name in uppercase', () => {
    render(<BinNameLabel width={2} depth={3} name="lowercase bin" />);
    expect(mocks.text?.children).toBe('LOWERCASE BIN');
  });

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
  ])('renders nothing for a %s name', (_label, name) => {
    const { container } = render(<BinNameLabel width={2} depth={3} name={name} />);
    expect(container.firstChild).toBeNull();
  });

  it('sits below the front edge, scaled by the depth pitch', () => {
    // 1u deep at 42mm → half-depth 21mm, then the 32mm front offset.
    const { container } = render(<BinNameLabel width={1} depth={1} name="BITS" />);
    expect(container.querySelector('group')?.getAttribute('position')).toBe('0,-53,0.01');
  });

  it('uses the depth-axis pitch on a non-square grid', () => {
    const { container } = render(
      <BinNameLabel width={1} depth={1} gridUnitMm={42} gridUnitMmY={20} name="BITS" />
    );
    expect(container.querySelector('group')?.getAttribute('position')).toBe('0,-42,0.01');
  });

  it('gives a 1x1 bin a band far wider than its own footprint', () => {
    // Proportionally a 1x1 would get 42 * 1.5 = 63mm; the floor raises it to 120mm.
    render(<BinNameLabel width={1} depth={1} name="HEX DRIVER BITS SET" />);
    sync(mesh(180));
    expect(mocks.text?.maxWidth).toBe(120);
  });

  it('scales the band with the bin once it exceeds the floor', () => {
    // 4u wide → 168mm, so the band is the proportional 252mm rather than the floor.
    render(<BinNameLabel width={4} depth={2} name="HEX DRIVER BITS SET" />);
    sync(mesh(400));
    expect(mocks.text?.maxWidth).toBe(252);
  });

  it('keeps a name that fits at full size on one line', () => {
    render(<BinNameLabel width={4} depth={2} name="HEX DRIVER BITS SET" />);
    sync(mesh(180));
    expect(mocks.text?.fontSize).toBe(7);
    expect(mocks.text?.maxWidth).toBeUndefined();
  });

  it('shrinks a long name on a small bin before wrapping it', () => {
    render(<BinNameLabel width={1} depth={1} name="SCREWS M3 x 12mm FLAT" />);
    sync(mesh(145));
    const fontSize = mocks.text?.fontSize as number;
    expect(fontSize).toBeGreaterThanOrEqual(5);
    expect(fontSize).toBeLessThan(7);
    expect(mocks.text?.maxWidth).toBeUndefined();
  });

  it('centres wrapped lines instead of ragging them left', () => {
    render(<BinNameLabel width={1} depth={1} name="HEX DRIVER BITS SET" />);
    expect(mocks.text?.textAlign).toBe('center');
  });
});
