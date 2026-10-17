import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('shows the tallest stack meter even with one layer', () => {
    render(<LayersTab />);
    expect(screen.getByTestId('tallest-stack-meter')).toBeInTheDocument();
  });
});
