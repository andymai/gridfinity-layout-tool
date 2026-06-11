import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DividerHeightControl } from './DividerHeightControl';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { calculateDividerHeight } from '@/shared/utils/slotMath';
import { resetAllStores } from '@/test/testUtils';

// Derive the real "auto" (full interior) height from the defaults using the
// same helpers the component does, so the assertions actually pin the bound
// rather than passing against an arbitrarily large constant.
const FULL_HEIGHT = calculateDividerHeight(
  { height: 'auto' },
  binDimensions(DEFAULT_BIN_PARAMS).wallHeight,
  DEFAULT_BIN_PARAMS.base.stackingLip
);

describe('DividerHeightControl', () => {
  beforeEach(() => {
    resetAllStores();
    useDesignerStore.setState(() => ({ params: DEFAULT_BIN_PARAMS }));
  });

  const dividerHeight = () => useDesignerStore.getState().params.compartments.dividerHeight;

  it('shows the auto label by default', () => {
    render(<DividerHeightControl />);
    expect(screen.getByText(/Auto/)).toBeInTheDocument();
  });

  it('decrementing from auto produces a numeric partial height below full', async () => {
    render(<DividerHeightControl />);
    fireEvent.click(screen.getByRole('button', { name: /decrease|minus|−|-/i }));

    // Deferred commit flushes after an idle delay.
    await waitFor(() => expect(typeof dividerHeight()).toBe('number'));
    const h = dividerHeight() as number;
    expect(h).toBeLessThan(FULL_HEIGHT);
    expect(h).toBeGreaterThanOrEqual(2);
  });

  it('never commits a height taller than the auto (full interior) value', async () => {
    useDesignerStore.getState().setCompartmentDividerHeight(10);
    render(<DividerHeightControl />);
    const inc = screen.getByRole('button', { name: /increase|plus|\+/i });
    for (let i = 0; i < 100; i++) fireEvent.click(inc);

    // Driving the stepper past full must snap back to 'auto', never exceed full.
    await waitFor(() => expect(dividerHeight()).toBeUndefined());
  });
});
