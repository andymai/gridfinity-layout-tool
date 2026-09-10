import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { DividerTiltList } from './DividerTiltList';

vi.mock('./DividerDiagrams', () => ({
  DividerMiniDiagram: () => <svg data-testid="mini" />,
}));

type Props = ComponentProps<typeof DividerTiltList>;
type Row = Props['rows'][number];

const row = (key: string, a: number, b: number, extra: Partial<Row> = {}): Row =>
  ({
    key,
    numberA: a,
    numberB: b,
    offsetStart: 0,
    offsetEnd: 0,
    leanDeg: 0,
    hasTilt: false,
    angleDeg: 0,
    ...extra,
  }) as Row;

function renderList(rows: Row[], hasAnyOverride = false) {
  const handlers = {
    hoverDivider: vi.fn(),
    selectDivider: vi.fn(),
    resetAll: vi.fn(),
  } as unknown as Props['handlers'];
  const t = ((key: string, vars?: Record<string, string>) =>
    vars ? `${key}:${Object.values(vars).join(',')}` : key) as unknown as Props['t'];
  render(
    <DividerTiltList
      rows={rows}
      compartments={{ cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] }}
      hoveredKey={null}
      hasAnyOverride={hasAnyOverride}
      handlers={handlers}
      t={t}
    />
  );
  return { handlers };
}

describe('DividerTiltList', () => {
  it('lists rows by ascending display number and selects on click', () => {
    const { handlers } = renderList([row('b', 3, 4), row('a', 2, 1)]);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('binDesigner.angledDividers.editRowLabel:1,2');
    expect(buttons[1]).toHaveAccessibleName('binDesigner.angledDividers.editRowLabel:3,4');
    fireEvent.click(buttons[1]);
    expect(handlers.selectDivider).toHaveBeenCalledWith('b');
  });

  it('offers reset-all only once an override exists', () => {
    renderList([row('a', 1, 2)]);
    expect(screen.queryByText('binDesigner.angledDividers.resetAll')).not.toBeInTheDocument();
    const { handlers } = renderList([row('a', 1, 2)], true);
    fireEvent.click(screen.getByText('binDesigner.angledDividers.resetAll'));
    expect(handlers.resetAll).toHaveBeenCalledOnce();
  });
});
