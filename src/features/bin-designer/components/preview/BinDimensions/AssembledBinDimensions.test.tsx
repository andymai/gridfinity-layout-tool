import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssembledBinDimensions } from './AssembledBinDimensions';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { mm } from '@/core/types';

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Line: () => <div data-testid="line" />,
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
}));

function texts(): string[] {
  return screen.getAllByTestId('r3f-text').map((n) => n.textContent ?? '');
}

function setPlate(plate: typeof DEFAULT_BASEPLATE_PARAMS | undefined): void {
  useLayoutStore.setState((s) => ({ layout: { ...s.layout, baseplateParams: plate } }));
}

describe('AssembledBinDimensions', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      // 6u body (42mm) + 4.4mm lip.
      params: {
        ...DEFAULT_BIN_PARAMS,
        height: 6,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
    setPlate(DEFAULT_BASEPLATE_PARAMS);
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, showAssembledHeightBreakdown: false },
    }));
  });

  it('labels the height with the assembled total from the stores', () => {
    render(<AssembledBinDimensions width={2} depth={2} gridUnitMm={42} />);
    expect(texts()).toContain('46.4mm');
  });

  it('follows the layout baseplate rather than assuming a plain one', () => {
    setPlate({ ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true, magnetDepth: mm(2) });
    render(<AssembledBinDimensions width={2} depth={2} gridUnitMm={42} />);
    expect(texts()).toContain('48.9mm');
  });

  it('shows no band labels while collapsed', () => {
    render(<AssembledBinDimensions width={2} depth={2} gridUnitMm={42} />);
    expect(texts().some((s) => s.startsWith('Bin '))).toBe(false);
  });

  it('translates the band labels when expanded', () => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, showAssembledHeightBreakdown: true },
    }));
    render(<AssembledBinDimensions width={2} depth={2} gridUnitMm={42} />);
    expect(texts()).toEqual(expect.arrayContaining(['Bin 42mm', 'Stacking lip 4.4mm']));
  });

  it('passes the stack pitch label straight through', () => {
    render(
      <AssembledBinDimensions width={2} depth={2} gridUnitMm={42} stackPitchLabel="stacks +42mm" />
    );
    expect(texts()).toContain('stacks +42mm');
  });
});
