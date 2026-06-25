import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The inspector body instantiates useExport(), which talks to the generation
// bridge — mock it (as useExport's own test does) so canExport resolves.
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({
    exportBin: vi.fn(),
    exportCombined: vi.fn(),
    exportSplitBin: vi.fn(),
  }),
  bridgeManager: {
    get engineReady() {
      return true;
    },
    subscribe: (listener: (ready: boolean) => void) => {
      listener(true);
      return () => {};
    },
    refresh: () => {},
  },
  workerPoolManager: {
    get: () => null,
    acquire: () => Promise.reject(new Error('No pool in test')),
    release: () => {},
  },
}));

import { RightInspectorBody } from './RightInspectorBody';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('RightInspectorBody', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      generation: { ...useDesignerStore.getState().generation, mesh: null },
      ui: {
        ...useDesignerStore.getState().ui,
        selectedCompartmentId: null,
        selectedColorZone: null,
        selectedDividerKey: null,
      },
    });
  });

  it('renders the live estimate readout', () => {
    render(<RightInspectorBody />);
    expect(screen.getByText(/^\$\d/)).toBeInTheDocument();
  });

  it('shows a dash for triangles until a mesh is generated', () => {
    render(<RightInspectorBody />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
