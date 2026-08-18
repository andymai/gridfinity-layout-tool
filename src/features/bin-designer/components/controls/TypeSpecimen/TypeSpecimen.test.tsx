import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypeSpecimen } from './TypeSpecimen';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';

vi.mock('@/features/bin-designer/hooks/useTypeMeasurer', () => ({
  useTypeMeasurer: () => null,
}));

describe('TypeSpecimen', () => {
  it('draws nothing and says so while the face is still loading', () => {
    render(<TypeSpecimen text="M3 HEX" style={DEFAULT_TEXT_STYLE_DEFAULTS} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('img').querySelector('path')).toBeNull();
  });
});
