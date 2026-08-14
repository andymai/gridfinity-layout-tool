import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { FrontLabel } from './FrontLabel';

type Props = Record<string, unknown>;

const mocks = vi.hoisted(() => ({ text: null as Props | null, line: null as Props | null }));

vi.mock('@react-three/drei', () => ({
  Text: (props: Props) => {
    mocks.text = props;
    return <div data-testid="r3f-text">{props.children as ReactNode}</div>;
  },
  Line: (props: Props) => {
    mocks.line = props;
    return <div data-testid="line" />;
  },
}));

function mesh(naturalWidth: number, blockHeight = 0.6) {
  const half = naturalWidth / 2;
  return {
    textRenderInfo: {
      blockBounds: [-half, -blockHeight, half, 0],
      visibleBounds: [-half + 0.02, -blockHeight + 0.1, half - 0.02, -0.05],
    },
  };
}

function sync(payload: unknown): void {
  const onSync = mocks.text?.onSync as ((m: unknown) => void) | undefined;
  if (!onSync) throw new Error('Text was rendered without an onSync handler');
  act(() => onSync(payload));
}

describe('FrontLabel', () => {
  beforeEach(() => {
    mocks.text = null;
    mocks.line = null;
    resetAllStores();
  });

  it('renders the layout name in uppercase', () => {
    render(<FrontLabel drawerWidth={10} label="My Layout" />);
    expect(mocks.text?.children).toBe('MY LAYOUT');
  });

  it('centres along the front edge below the dimension line', () => {
    const { container } = render(<FrontLabel drawerWidth={10} label="My Layout" />);
    expect(container.querySelector('group')?.getAttribute('position')).toBe('5,-2.2,0.01');
  });

  it('centres wrapped lines instead of ragging them left', () => {
    render(<FrontLabel drawerWidth={10} label="My Layout" />);
    expect(mocks.text?.textAlign).toBe('center');
  });

  it('scales the band with the drawer', () => {
    render(<FrontLabel drawerWidth={10} label="A very long drawer layout name indeed" />);
    sync(mesh(40));
    expect(mocks.text?.maxWidth).toBe(15);
  });

  it('holds a minimum band on a narrow drawer', () => {
    // Proportionally a 2u drawer would get 3 units; the floor raises it to 8.5.
    render(<FrontLabel drawerWidth={2} label="A very long drawer layout name indeed" />);
    sync(mesh(30));
    expect(mocks.text?.maxWidth).toBe(8.5);
  });

  it('shrinks a long name before wrapping it', () => {
    render(<FrontLabel drawerWidth={10} label="Workshop drawer three" />);
    sync(mesh(18));
    const fontSize = mocks.text?.fontSize as number;
    expect(fontSize).toBeGreaterThanOrEqual(0.36);
    expect(fontSize).toBeLessThan(0.5);
    expect(mocks.text?.maxWidth).toBeUndefined();
  });

  it('draws the underline across the ink, not across the band', () => {
    render(<FrontLabel drawerWidth={10} label="My Layout" />);
    sync(mesh(6));

    const points = mocks.line?.points as [number, number, number][];
    expect(points[0][0]).toBeCloseTo(-2.98, 6);
    expect(points[1][0]).toBeCloseTo(2.98, 6);
  });

  it('drops the underline below the last line of a wrapped label', () => {
    render(<FrontLabel drawerWidth={10} label="A very long drawer layout name indeed" />);
    sync(mesh(40)); // wraps → props change → troika re-lays-out
    sync(mesh(15, 1.2)); // two lines tall

    const points = mocks.line?.points as [number, number, number][];
    // Text top sits at 0.5 * 1.2 / 2 = 0.3; the block runs 1.2 below that.
    expect(points[0][1]).toBeCloseTo(0.3 - 1.2 - 0.45, 6);
  });

  it('renders an empty label without a rule under it', () => {
    const { queryByTestId } = render(<FrontLabel drawerWidth={10} label="" />);
    expect(mocks.text?.children).toBe('');
    expect(queryByTestId('line')).toBeNull();
  });
});
