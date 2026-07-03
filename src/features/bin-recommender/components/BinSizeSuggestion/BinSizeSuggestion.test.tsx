import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gridUnits, heightUnits } from '@/core/types';
import type { BinSizePrediction } from '../../types';

vi.mock('../../useBinSizeSuggestion', () => ({ useBinSizeSuggestion: vi.fn() }));
vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

import { useBinSizeSuggestion } from '../../useBinSizeSuggestion';
import { BinSizeSuggestion } from './BinSizeSuggestion';

const useSuggestion = vi.mocked(useBinSizeSuggestion);

const drawer = { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) };
const current = { width: gridUnits(1), depth: gridUnits(1), height: heightUnits(3) };
const suggestion: BinSizePrediction = {
  size: { width: gridUnits(2), depth: gridUnits(2), height: heightUnits(3) },
  p: 0.6,
  n: 40,
  source: 'label',
};

function renderComponent(opts: { fits: boolean; onApply?: () => void }) {
  const onApply = opts.onApply ?? vi.fn();
  return render(
    <BinSizeSuggestion
      label="screws"
      drawer={drawer}
      current={current}
      onApply={onApply}
      canFit={() => opts.fits}
    />
  );
}

describe('BinSizeSuggestion', () => {
  beforeEach(() => useSuggestion.mockReset());

  it('renders nothing when there is no suggestion', () => {
    useSuggestion.mockReturnValue(null);
    const { container } = renderComponent({ fits: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the size and an Apply button when the suggestion fits', () => {
    useSuggestion.mockReturnValue(suggestion);
    const onApply = vi.fn();
    renderComponent({ fits: true, onApply });
    expect(screen.getByText(/2×2×3/)).toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledWith(suggestion.size);
  });

  it('shows "Won\'t fit here" and no Apply button when it does not fit', () => {
    useSuggestion.mockReturnValue(suggestion);
    renderComponent({ fits: false });
    expect(screen.getByText(/2×2×3/)).toBeInTheDocument();
    expect(screen.getByText(/Won't fit here/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('hides after dismissal', () => {
    useSuggestion.mockReturnValue(suggestion);
    renderComponent({ fits: true });
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByText(/2×2×3/)).not.toBeInTheDocument();
  });
});
