import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanScaleField } from './ScanScaleField';
import { scaleTargetMm } from './scanIngest';
import type { ParsedScan } from './scanIngest';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

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
    render(<ScanScaleField svg="<svg/>" parsed={parsed} targetText="200" onChange={onChange} />);
    expect(screen.getByText('binDesigner.cutouts.scanImport.resultSize')).toBeInTheDocument();

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
