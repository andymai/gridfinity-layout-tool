import type * as DesignSystem from '@/design-system';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantSection } from './VariantSection';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams, Cutout, DesignOverrides } from '@/features/bin-designer/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/design-system', async () => ({
  ...(await vi.importActual<typeof DesignSystem>('@/design-system')),
  NumberField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange?: (value: number) => void;
  }) => (
    <input
      data-testid={`num-${label}`}
      value={value}
      onChange={(e) => onChange?.(Number(e.target.value))}
    />
  ),
}));

const bit: Cutout = {
  id: 'bit',
  shape: 'circle',
  x: 10,
  y: 10,
  width: 6.35,
  depth: 6.35,
  cutDepth: 10,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  name: 'Shank',
  groupId: null,
};

const parentParams: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 6,
  cutouts: [bit],
};

function renderSection(overrides: DesignOverrides = {}, orphans: never[] = []) {
  const onChange = vi.fn();
  const onDetach = vi.fn();
  const onClearOrphans = vi.fn();
  render(
    <VariantSection
      parentName="Router Bit Holder"
      parentParams={parentParams}
      overrides={overrides}
      orphans={orphans}
      onChange={onChange}
      onDetach={onDetach}
      onClearOrphans={onClearOrphans}
    />
  );
  return { onChange, onDetach, onClearOrphans };
}

describe('VariantSection', () => {
  it('says where everything else comes from', () => {
    renderSection();
    expect(screen.getByText('binDesigner.variants.panelLocked')).toBeInTheDocument();
  });

  it('reports a variant that claims nothing', () => {
    renderSection();
    expect(screen.getByText('binDesigner.variants.noneClaimed')).toBeInTheDocument();
  });

  it('does not report that once something is claimed', () => {
    renderSection({ dimensions: { width: 4 } });
    expect(screen.queryByText('binDesigner.variants.noneClaimed')).toBeNull();
  });

  // Claiming seeds with the parent's current value, so the act of claiming
  // never changes the geometry by itself.
  it('claims a dimension at the parent’s current value', () => {
    const { onChange } = renderSection();

    fireEvent.click(screen.getAllByText('binDesigner.variants.claim')[0]);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dimensions: expect.objectContaining({ width: 2 }) })
    );
  });

  it('releases a claimed dimension back to the parent', () => {
    const { onChange } = renderSection({ dimensions: { width: 4 } });

    fireEvent.click(screen.getAllByText('binDesigner.variants.release')[0]);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dimensions: {} }));
  });

  it('edits a claimed dimension', () => {
    const { onChange } = renderSection({ dimensions: { width: 4 } });

    fireEvent.change(screen.getByTestId('num-binDesigner.variants.field.width'), {
      target: { value: '6' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dimensions: expect.objectContaining({ width: 6 }) })
    );
  });

  it('lists the parent’s cutouts by name', () => {
    renderSection();
    expect(screen.getByText('Shank')).toBeInTheDocument();
  });

  it('claims a cutout field at the parent’s value', () => {
    const { onChange } = renderSection();

    fireEvent.click(screen.getByText('Shank'));
    const claims = screen.getAllByText('binDesigner.variants.claim');
    fireEvent.click(claims[claims.length - 5]);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cutouts: { bit: expect.objectContaining({ width: 6.35 }) } })
    );
  });

  // An entry with nothing left in it would keep reporting a claim that is gone.
  it('drops a cutout entry when its last field is released', () => {
    const { onChange } = renderSection({ cutouts: { bit: { width: 12.7 } } });

    fireEvent.click(screen.getByText('Shank'));
    fireEvent.click(screen.getByText('binDesigner.variants.release'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cutouts: {} }));
  });

  it('surfaces overrides pointing at deleted cutouts', () => {
    renderSection({ cutouts: { gone: { width: 4 } } }, []);
    // The section renders orphans from the prop, not by re-deriving them.
    expect(screen.queryByText('binDesigner.variants.orphanTitle')).toBeNull();
  });

  it('offers to forget orphaned claims', () => {
    const { onClearOrphans } = renderSection({}, [
      { cutoutId: 'gone', override: { width: 4 } },
    ] as never);

    expect(screen.getByText('binDesigner.variants.orphanTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('binDesigner.variants.orphanClear'));
    expect(onClearOrphans).toHaveBeenCalled();
  });

  it('offers detaching from the parent', () => {
    const { onDetach } = renderSection();
    fireEvent.click(screen.getByText('binDesigner.variants.detach'));
    expect(onDetach).toHaveBeenCalled();
  });
});
