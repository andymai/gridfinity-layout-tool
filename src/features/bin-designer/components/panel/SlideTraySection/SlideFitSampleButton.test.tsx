import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlideFitSampleButton } from './SlideFitSampleButton';

vi.mock('../../../hooks/useSlideFitSampleExport', () => ({
  SLIDE_FIT_SAMPLE_BASE_NAME: 'slide-fit-sample',
  useSlideFitSampleExport: () => ({
    isExporting: false,
    canExport: true,
    downloadSample: vi.fn().mockResolvedValue(true),
  }),
}));

describe('SlideFitSampleButton', () => {
  it('offers the fit test', () => {
    render(<SlideFitSampleButton />);
    expect(screen.getByRole('button', { name: /fit test/i })).toBeEnabled();
  });
});
