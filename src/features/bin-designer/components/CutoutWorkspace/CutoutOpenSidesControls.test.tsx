import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Cutout } from '@/features/bin-designer/types';
import { CutoutOpenSidesControls } from './CutoutOpenSidesControls';

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

describe('CutoutOpenSidesControls', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      },
    });
  });

  it('toggles a side on and off, keeping the stored set canonical', () => {
    const onUpdate = vi.fn();
    render(<CutoutOpenSidesControls cutout={rect({ openSides: ['right'] })} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.openSide.frontAria'));
    expect(onUpdate).toHaveBeenLastCalledWith({ openSides: ['front', 'right'] });
    fireEvent.click(screen.getByLabelText('binDesigner.cutouts.openSide.rightAria'));
    expect(onUpdate).toHaveBeenLastCalledWith({ openSides: undefined });
  });

  it('marks stored sides pressed and shows the plain hint when buildable', () => {
    render(<CutoutOpenSidesControls cutout={rect({ openSides: ['left'] })} onUpdate={vi.fn()} />);
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
        cutout={rect({ openSides: ['left'], rotation: 30 })}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.getByLabelText('binDesigner.cutouts.openSide.leftAria')).toBeDisabled();
    expect(screen.getByLabelText('binDesigner.cutouts.openSide.leftAria')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('binDesigner.cutouts.openSidesBlocked.rotation')).toBeInTheDocument();
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
