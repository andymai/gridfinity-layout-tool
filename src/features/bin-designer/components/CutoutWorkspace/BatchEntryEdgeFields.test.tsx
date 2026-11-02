import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { maxEntryChamfer } from '@/features/bin-designer/types';
import { BatchEntryEdgeFields } from './BatchEntryEdgeFields';

vi.mock('@/design-system', async () => ({
  ...(await vi.importActual<typeof DesignSystem>('@/design-system')),
  NumberField: ({
    label,
    value,
    indeterminate,
    onChange,
  }: {
    label: string;
    value: number;
    indeterminate?: boolean;
    onChange: (v: number) => void;
  }) => (
    <input
      aria-label={label}
      data-indeterminate={indeterminate ? 'yes' : 'no'}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function cut(id: string, overrides: Partial<Cutout> = {}): Cutout {
  return {
    id,
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    depth: 20,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const CHAMFER = 'binDesigner.cutouts.chamfer';

describe('BatchEntryEdgeFields', () => {
  it('clamps each width to its own depth and skips shapes without an edge', () => {
    const onUpdateBatch = vi.fn();
    const cutouts = [cut('a'), cut('b', { cutDepth: 1 }), cut('t', { shape: 'text' })];
    render(<BatchEntryEdgeFields cutouts={cutouts} onUpdateBatch={onUpdateBatch} />);
    fireEvent.change(screen.getByLabelText(CHAMFER), { target: { value: '3' } });
    expect(onUpdateBatch).toHaveBeenCalledWith(
      new Map([
        ['a', { chamferWidth: Math.min(3, maxEntryChamfer(10)) }],
        ['b', { chamferWidth: Math.min(3, maxEntryChamfer(1)) }],
      ])
    );
  });

  it('shows differing widths as mixed, and a shared round under its own name', () => {
    const { rerender } = render(
      <BatchEntryEdgeFields
        cutouts={[cut('a', { chamferWidth: 1 }), cut('b', { chamferWidth: 2 })]}
        onUpdateBatch={vi.fn()}
      />
    );
    expect(screen.getByLabelText(CHAMFER)).toHaveAttribute('data-indeterminate', 'yes');
    rerender(
      <BatchEntryEdgeFields
        cutouts={[
          cut('a', { chamferWidth: 1, entryProfile: 'round' }),
          cut('b', { chamferWidth: 1, entryProfile: 'round' }),
        ]}
        onUpdateBatch={vi.fn()}
      />
    );
    expect(screen.getByLabelText('binDesigner.cutouts.entryRound')).toHaveValue('1');
  });

  it('writes a round, and a chamfer as the field left out', () => {
    const onUpdateBatch = vi.fn();
    render(
      <BatchEntryEdgeFields
        cutouts={[cut('a'), cut('b', { entryProfile: 'round' })]}
        onUpdateBatch={onUpdateBatch}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutouts.entryProfile.round' }));
    expect(onUpdateBatch).toHaveBeenLastCalledWith(
      new Map([
        ['a', { entryProfile: 'round' }],
        ['b', { entryProfile: 'round' }],
      ])
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'binDesigner.cutouts.entryProfile.chamfer' })
    );
    expect(onUpdateBatch).toHaveBeenLastCalledWith(
      new Map([
        ['a', { entryProfile: undefined }],
        ['b', { entryProfile: undefined }],
      ])
    );
  });

  it('renders nothing when no selected shape takes an entry edge', () => {
    const { container } = render(
      <BatchEntryEdgeFields cutouts={[cut('t', { shape: 'text' })]} onUpdateBatch={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
