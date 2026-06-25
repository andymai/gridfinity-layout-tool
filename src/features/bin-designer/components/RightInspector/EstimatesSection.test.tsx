import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstimatesSection } from './EstimatesSection';
import type { PrintEstimate } from '@/features/bin-designer/utils/printEstimates';

const estimate: PrintEstimate = {
  volumeMm3: 1000,
  gramsFilament: 18.4,
  metersFilament: 6.2,
  printTimeMinutes: 72,
  costUSD: 0.42,
};

describe('EstimatesSection', () => {
  it('renders weight, cost, and triangle count', () => {
    render(<EstimatesSection estimates={estimate} triangleCount={1234} />);
    expect(screen.getByText('18 g')).toBeInTheDocument();
    expect(screen.getByText('$0.42')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('shows a dash for triangles until the mesh lands', () => {
    render(<EstimatesSection estimates={estimate} triangleCount={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
