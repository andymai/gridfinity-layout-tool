import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GhostAuthoredDividers } from './GhostAuthoredDividers';

vi.mock('@react-three/drei', () => ({
  Line: () => null,
  Text: ({ children }: { children: ReactNode }) => <span data-testid="label">{children}</span>,
}));

function seed(
  layout: 'even' | 'custom',
  customGrid?: { cols: number; rows: number; cells: number[] }
) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      style: 'slotted',
      slotConfig: { ...DEFAULT_BIN_PARAMS.slotConfig, layout, customGrid },
    },
  });
}

describe('GhostAuthoredDividers', () => {
  beforeEach(() => resetAllStores());

  it('renders a numbered label per divider in custom mode', () => {
    seed('custom', { cols: 2, rows: 2, cells: [0, 1, 2, 3] });
    const { getAllByTestId } = render(<GhostAuthoredDividers />);
    // 2x2 with 4 distinct cells → one vertical + one horizontal divider.
    const labels = getAllByTestId('label').map((n) => n.textContent);
    expect(labels.sort()).toEqual(['1', '2']);
  });

  it('renders nothing in even (parametric) layout', () => {
    seed('even');
    const { container } = render(<GhostAuthoredDividers />);
    expect(container.querySelector('[data-testid="label"]')).toBeNull();
  });
});
