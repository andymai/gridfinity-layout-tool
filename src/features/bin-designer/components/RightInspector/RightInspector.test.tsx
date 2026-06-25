import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Expanding the inspector renders the body, which instantiates useExport() —
// mock the generation bridge (as useExport's own test does).
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

import { RightInspector } from './RightInspector';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';

describe('RightInspector', () => {
  beforeEach(() => {
    localStorage.clear();
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        style: 'standard',
        compartments: createUniformGrid(2, 1, 1.2),
      },
      itemKind: 'bin',
      ui: {
        ...useDesignerStore.getState().ui,
        cutoutEditorOpen: false,
        selectedCompartmentId: null,
        selectedColorZone: null,
        selectedDividerKey: null,
      },
    });
  });

  it('renders nothing while the cutout editor is open', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, cutoutEditorOpen: true },
    });
    const { container } = render(<RightInspector />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the collapsed rail by default on a narrow desktop (jsdom is 1024px)', () => {
    render(<RightInspector />);
    // Collapsed rail exposes only the expand affordance.
    expect(screen.getByLabelText('Expand inspector')).toBeInTheDocument();
    expect(screen.queryByLabelText('Collapse inspector')).toBeNull();
  });

  it('auto-expands the rail when an element is selected', () => {
    render(<RightInspector />);
    expect(screen.getByLabelText('Expand inspector')).toBeInTheDocument();

    act(() => useDesignerStore.getState().setSelectedCompartmentId(1));

    // Now expanded: the collapse affordance + body are shown.
    expect(screen.getByLabelText('Collapse inspector')).toBeInTheDocument();
  });
});
