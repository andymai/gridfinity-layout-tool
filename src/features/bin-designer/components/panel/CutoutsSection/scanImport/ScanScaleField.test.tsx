import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanScaleField } from './ScanScaleField';
import { scaleTargetMm } from './scanIngest';
import type { ParsedScan } from './scanIngest';

// The echo mock fills only placeholders in the key, so it would drop the size.
vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, params?: Record<string, unknown>): string =>
      params ? `${key} ${Object.values(params).join('x')}` : key,
}));

const parsed = {
  specs: [],
  sized: { width: 100, depth: 50, longest: 100 },
  sizedByLongest: false,
} as unknown as ParsedScan;

describe('ScanScaleField', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('shows the size a typed measurement gives and reports each edit', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ScanScaleField svg="<svg/>" parsed={parsed} targetText="200" onChange={onChange} />
    );
    // 200mm along a 100px longest side doubles the 100 × 50 outline.
    expect(
      screen.getByText('binDesigner.cutouts.scanImport.resultSize 200x100')
    ).toBeInTheDocument();
    rerender(<ScanScaleField svg="<svg/>" parsed={parsed} targetText="75" onChange={onChange} />);
    expect(
      screen.getByText('binDesigner.cutouts.scanImport.resultSize 75x37.5')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('binDesigner.cutouts.scanImport.scaleLabel'), {
      target: { value: '150' },
    });
    expect(onChange).toHaveBeenCalledWith('150');
  });

  it('reads only a positive number as a size', () => {
    expect(scaleTargetMm('42.5')).toBe(42.5);
    expect(scaleTargetMm('0')).toBeNull();
    expect(scaleTargetMm('')).toBeNull();
  });
});
