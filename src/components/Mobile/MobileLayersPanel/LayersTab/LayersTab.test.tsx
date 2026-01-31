import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LayersTab } from './LayersTab';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/features/layers', () => ({
  LayersPanel: () => <div data-testid="layers-panel" />,
}));

describe('LayersTab', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LayersTab />);
  });
});
