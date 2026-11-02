import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutFitControls } from './CutoutFitControls';
import { hasFitControls } from './cutoutSectionVisibility';
import type { Cutout } from '@/features/bin-designer/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'circle',
    x: 0,
    y: 0,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('hasFitControls', () => {
  it('is true for insert shapes with enough depth to bevel', () => {
    expect(hasFitControls(makeCutout({ shape: 'circle' }))).toBe(true);
    expect(hasFitControls(makeCutout({ shape: 'polygon' }))).toBe(true);
    expect(hasFitControls(makeCutout({ shape: 'slot' }))).toBe(true);
    // Rectangle: no clearance, but a chamfer is allowed.
    expect(hasFitControls(makeCutout({ shape: 'rectangle' }))).toBe(true);
  });

  it('is true for a path cutout (clearance + chamfer)', () => {
    expect(hasFitControls(makeCutout({ shape: 'path' }))).toBe(true);
  });
});

describe('CutoutFitControls', () => {
  it('shows clearance and chamfer for a circle', () => {
    render(<CutoutFitControls cutout={makeCutout({ shape: 'circle' })} onUpdate={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.clearance')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.chamfer')).toBeInTheDocument();
  });

  it('shows only chamfer for a rectangle (no clearance)', () => {
    render(<CutoutFitControls cutout={makeCutout({ shape: 'rectangle' })} onUpdate={vi.fn()} />);
    expect(screen.queryByText('binDesigner.cutouts.clearance')).not.toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.chamfer')).toBeInTheDocument();
  });

  it('hides the chamfer when the cut is too shallow to bevel', () => {
    render(
      <CutoutFitControls
        cutout={makeCutout({ shape: 'circle', cutDepth: 0.1 })}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.queryByText('binDesigner.cutouts.chamfer')).not.toBeInTheDocument();
  });

  it('offers a chamfer or a round for the entry edge', () => {
    const onUpdate = vi.fn();
    render(<CutoutFitControls cutout={makeCutout({ shape: 'circle' })} onUpdate={onUpdate} />);
    const chamfer = screen.getByRole('button', {
      name: 'binDesigner.cutouts.entryProfile.chamfer',
    });
    expect(chamfer).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutouts.entryProfile.round' }));
    expect(onUpdate).toHaveBeenCalledWith({ entryProfile: 'round' });
  });

  it('names the size after the shape the edge has', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutFitControls
        cutout={makeCutout({ shape: 'circle', entryProfile: 'round' })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.getByText('binDesigner.cutouts.entryRound')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.cutouts.chamfer')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'binDesigner.cutouts.entryProfile.chamfer' })
    );
    expect(onUpdate).toHaveBeenCalledWith({ entryProfile: undefined });
  });
});
