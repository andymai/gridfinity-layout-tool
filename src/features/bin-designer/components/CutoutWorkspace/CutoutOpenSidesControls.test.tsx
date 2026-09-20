import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutOpenSidesControls } from './CutoutOpenSidesControls';

vi.mock('@/design-system', async () => ({
  ...(await vi.importActual<typeof DesignSystem>('@/design-system')),
  NumberField: ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid={`compact-input-${label}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

function rect(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'r1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 30,
    depth: 12,
    cutDepth: 8,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function seed(cutouts: Cutout[], solid = true): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      style: solid ? 'solid' : DEFAULT_BIN_PARAMS.style,
      base: { ...DEFAULT_BIN_PARAMS.base, solid },
      cutouts,
    },
  });
}

describe('CutoutOpenSidesControls', () => {
  beforeEach(() => seed([rect()]));

  it('toggles a side on and off, keeping the stored set canonical', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutOpenSidesControls
        cutout={rect({ openSides: [{ side: 'right' }] })}
        onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.openSide.frontAria'));
    expect(onUpdate).toHaveBeenLastCalledWith({
      openSides: [{ side: 'front' }, { side: 'right' }],
    });
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.openSide.rightAria'));
    expect(onUpdate).toHaveBeenLastCalledWith({ openSides: undefined });
  });

  it('unfolds a row per opened side with the pocket width and the opening form', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutOpenSidesControls
        cutout={rect({
          openSides: [{ side: 'right' }, { side: 'front', widthMm: 8, tunnel: true }],
        })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.getByTestId('open-side-row-right')).toBeInTheDocument();
    // Each field's label names its side, so two openings never read alike.
    const rows = [
      screen.getByTestId(
        'compact-input-binDesigner.cutouts.openSideWidth · binDesigner.cutouts.openSide.front'
      ),
      screen.getByTestId(
        'compact-input-binDesigner.cutouts.openSideWidth · binDesigner.cutouts.openSide.right'
      ),
    ];
    // Front carries its explicit 8mm; right shows the full 12mm depth.
    expect(rows[0]).toHaveValue('8');
    expect(rows[1]).toHaveValue('12');
    fireEvent.change(rows[1], { target: { value: '5' } });
    expect(onUpdate).toHaveBeenLastCalledWith({
      openSides: [
        { side: 'front', widthMm: 8, tunnel: true },
        { side: 'right', widthMm: 5 },
      ],
    });
    // Typing the full width back clears the override.
    fireEvent.change(rows[0], { target: { value: '30' } });
    expect(onUpdate).toHaveBeenLastCalledWith({
      openSides: [{ side: 'front', tunnel: true }, { side: 'right' }],
    });
  });

  it('switches a side between open top and tunnel', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutOpenSidesControls
        cutout={rect({ openSides: [{ side: 'right' }] })}
        onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByText('binDesigner.cutouts.openSideForm.tunnel'));
    expect(onUpdate).toHaveBeenLastCalledWith({ openSides: [{ side: 'right', tunnel: true }] });
  });

  it('marks stored sides pressed and shows the plain hint when buildable', () => {
    render(
      <CutoutOpenSidesControls
        cutout={rect({ openSides: [{ side: 'left' }] })}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.getByLabelText('binDesigner.cutouts.openSide.leftAria')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('binDesigner.cutouts.openSide.rightAria')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByText('binDesigner.cutouts.openSidesHint')).toBeInTheDocument();
  });

  it('disables the chips with a reason when the breach cannot be built', () => {
    render(
      <CutoutOpenSidesControls
        cutout={rect({ openSides: [{ side: 'left' }], leanDeg: 10 })}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.getByLabelText('binDesigner.cutouts.openSide.leftAria')).toBeDisabled();
    expect(screen.getByLabelText('binDesigner.cutouts.openSide.leftAria')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('binDesigner.cutouts.openSidesBlocked.lean')).toBeInTheDocument();
    expect(screen.queryByTestId('open-side-row-left')).not.toBeInTheDocument();
  });

  it('names the host as the reason on a cavity bin', () => {
    seed([rect()], false);
    render(<CutoutOpenSidesControls cutout={rect()} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText('binDesigner.cutouts.openSide.leftAria')).toBeDisabled();
    expect(screen.getByText('binDesigner.cutouts.openSidesBlocked.host')).toBeInTheDocument();
  });

  it('names the taper as the reason on a tapered host', () => {
    useDesignerStore.setState((s) => ({
      params: {
        ...s.params,
        overhang: {
          enabled: true,
          left: 3,
          right: 3,
          front: 3,
          back: 3,
          taper: {
            enabled: true,
            profile: 'chamfer',
            bandHeight: 5,
            left: 3,
            right: 3,
            front: 3,
            back: 3,
          },
        },
      },
    }));
    render(<CutoutOpenSidesControls cutout={rect()} onUpdate={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.openSidesBlocked.taper')).toBeInTheDocument();
  });
});
