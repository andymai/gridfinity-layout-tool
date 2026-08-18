import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutSocketControls } from './CutoutSocketControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

import type { Cutout } from '@/features/bin-designer/types';
import type { CutoutSocketPlanView } from '@/features/bin-designer/hooks/useCutoutSocketPlan';
import type {
  CutoutSocketPlacement,
  CutoutSocketSkipReason,
} from '@/shared/utils/cutoutLabelSocketPlan';

const cutout = (o: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: 'M4',
  groupId: null,
  labelMode: 'socket',
  ...o,
});

function planWith(socket: Partial<CutoutSocketPlacement> = {}): CutoutSocketPlanView {
  const placement: CutoutSocketPlacement = {
    cutoutId: 'c1',
    centerX: 0,
    centerY: 20,
    widthU: 2,
    vertical: false,
    fittingWidthsU: [1, 2],
    text: 'M4',
    ...socket,
  };
  return {
    byCutoutId: new Map([['c1', placement]]),
    skippedByCutoutId: new Map(),
    innerW: 120,
    innerD: 80,
    socketCount: 1,
    skippedCount: 0,
  };
}

function planSkipping(reason: CutoutSocketSkipReason): CutoutSocketPlanView {
  return {
    byCutoutId: new Map(),
    skippedByCutoutId: new Map([['c1', reason]]),
    innerW: 120,
    innerD: 80,
    socketCount: 0,
    skippedCount: 1,
  };
}

describe('CutoutSocketControls', () => {
  it('offers only the widths the plan says fit', () => {
    render(
      <CutoutSocketControls
        cutout={cutout()}
        plan={planWith({ fittingWidthsU: [1] })}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'binDesigner.cutoutSocket.widthU' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'binDesigner.cutoutSocket.widthU' })).toHaveLength(
      1
    );
  });

  it('shows Auto as selected until a width is pinned', () => {
    const { rerender } = render(
      <CutoutSocketControls
        cutout={cutout()}
        plan={planWith()}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );
    const auto = screen.getByRole('button', { name: 'binDesigner.cutoutSocket.widthAuto' });
    expect(auto.getAttribute('aria-pressed')).toBe('true');

    rerender(
      <CutoutSocketControls
        cutout={cutout({ labelPlateWidthU: 1 })}
        plan={planWith()}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );
    expect(
      screen
        .getByRole('button', { name: 'binDesigner.cutoutSocket.widthAuto' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  // A width the pocket cannot take must never read as active, or the panel
  // claims a plate the board will not have a socket for.
  it('keeps Auto selected when a stored override no longer fits', () => {
    render(
      <CutoutSocketControls
        cutout={cutout({ labelPlateWidthU: 3 })}
        plan={planWith({ fittingWidthsU: [1, 2] })}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );

    expect(
      screen
        .getByRole('button', { name: 'binDesigner.cutoutSocket.widthAuto' })
        .getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('clears the override when Auto is chosen', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutSocketControls
        cutout={cutout({ labelPlateWidthU: 1 })}
        plan={planWith()}
        disabled={false}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutoutSocket.widthAuto' }));
    expect(onUpdate).toHaveBeenCalledWith({ labelPlateWidthU: undefined });
  });

  it('writes the orientation as a label angle', () => {
    const onUpdate = vi.fn();
    render(
      <CutoutSocketControls
        cutout={cutout()}
        plan={planWith()}
        disabled={false}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutoutSocket.vertical' }));
    expect(onUpdate).toHaveBeenCalledWith({ textAngle: 90 });

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutoutSocket.horizontal' }));
    expect(onUpdate).toHaveBeenCalledWith({ textAngle: 0 });
  });

  // Going inert without saying why is the failure mode: the user moved a
  // cutout and the socket silently stopped being cut.
  it.each([
    ['centerAnchor', 'binDesigner.cutoutSocket.blockedCenterAnchor'],
    ['tooShallow', 'binDesigner.cutoutSocket.blockedTooShallow'],
    ['capped', 'binDesigner.cutoutSocket.blockedCapped'],
    ['noRoom', 'binDesigner.cutoutSocket.blockedNoRoom'],
  ] as const)('explains a %s skip instead of showing controls', (reason, message) => {
    render(
      <CutoutSocketControls
        cutout={cutout()}
        plan={planSkipping(reason)}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByRole('status').textContent).toBe(message);
    expect(screen.queryByRole('button', { name: 'binDesigner.cutoutSocket.widthAuto' })).toBeNull();
  });

  // The no-room copy advises trying the other orientation, so the one control
  // that can unblock the plan must stay mounted with the warning. The other
  // refusals are not orientation's to fix.
  it('keeps the orientation toggle mounted on a no-room skip', () => {
    render(
      <CutoutSocketControls
        cutout={cutout()}
        plan={planSkipping('noRoom')}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );
    expect(
      screen.getByRole('group', { name: 'binDesigner.cutoutSocket.orientation' })
    ).toBeInTheDocument();
  });

  it('offers no orientation toggle for refusals orientation cannot fix', () => {
    render(
      <CutoutSocketControls
        cutout={cutout()}
        plan={planSkipping('tooShallow')}
        disabled={false}
        onUpdate={vi.fn()}
      />
    );
    expect(
      screen.queryByRole('group', { name: 'binDesigner.cutoutSocket.orientation' })
    ).toBeNull();
  });
});
