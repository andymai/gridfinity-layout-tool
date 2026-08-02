import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLabsStore } from '@/core/store';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_GENERATION_STATE,
  DEFAULT_UI_STATE,
} from '@/features/bin-designer/constants';
import { DesignerHeader } from './DesignerHeader';
import type { DesignNameEditor } from './useDesignNameEditor';
import { createRef } from 'react';

// Mock child components
vi.mock('@/shared/components/ToolSwitcher', () => ({
  ToolSwitcher: () => <div data-testid="tool-switcher">ToolSwitcher</div>,
}));

vi.mock('@/shared/components/HeaderSupportLinks', () => ({
  HeaderSupportLinks: () => <div data-testid="header-support-links" />,
}));

function createMockNameEditor(overrides: Partial<DesignNameEditor> = {}): DesignNameEditor {
  return {
    isEditingName: false,
    editNameValue: '',
    nameInputRef: createRef<HTMLInputElement>(),
    setEditNameValue: vi.fn(),
    handleNameClick: vi.fn(),
    handleNameSubmit: vi.fn(),
    handleNameKeyDown: vi.fn(),
    handleNameTouchStart: vi.fn(),
    handleNameTouchEnd: vi.fn(),
    startEditing: vi.fn(),
    ...overrides,
  };
}

describe('DesignerHeader', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useDesignerStore.setState({
      params: DEFAULT_BIN_PARAMS,
      designName: 'Test Design',
      currentDesignId: null,
      saveStatus: 'idle',
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
      history: {
        past: [],
        future: [],
      },
      ui: {
        ...DEFAULT_UI_STATE,
        designListOpen: false,
        exportDialogOpen: false,
        previewCompartments: null,
        previewSelection: null,
      },
    });
  });

  it('renders desktop layout with support links', () => {
    render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
    expect(screen.getByTestId('header-support-links')).toBeInTheDocument();
  });

  it('renders design name on desktop', () => {
    render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
    expect(screen.getByText('Test Design')).toBeInTheDocument();
  });

  it('renders undo/redo buttons', () => {
    render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
    expect(screen.getAllByLabelText(/Undo/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Redo/).length).toBeGreaterThan(0);
  });

  it('disables undo when no history', () => {
    render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
    screen.getAllByLabelText(/Undo/).forEach((btn) => expect(btn).toBeDisabled());
  });

  it('enables undo when history exists', () => {
    useDesignerStore.setState({
      history: {
        past: [{ params: DEFAULT_BIN_PARAMS, mesh: null }],
        future: [],
      },
    });
    render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
    expect(screen.getAllByLabelText(/Undo/)[0]).not.toBeDisabled();
  });

  it('renders mobile layout without support links', () => {
    render(<DesignerHeader isDesktop={false} nameEditor={createMockNameEditor()} />);
    expect(screen.queryByTestId('header-support-links')).not.toBeInTheDocument();
  });

  describe('community publish entry', () => {
    function setCommunityFlag(enabled: boolean): void {
      useLabsStore.setState((s) => ({
        preferences: {
          ...s.preferences,
          enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: enabled },
        },
      }));
    }

    it('hides the Publish button while the flag is off', () => {
      setCommunityFlag(false);
      render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
      expect(screen.queryByLabelText('Publish to the community showcase')).not.toBeInTheDocument();
    });

    it('shows a disabled Publish button next to Export until the mesh is ready', () => {
      setCommunityFlag(true);
      render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
      expect(screen.getByLabelText('Publish to the community showcase')).toBeDisabled();
    });

    it('enables Publish once the mesh is ready, on desktop and mobile', () => {
      setCommunityFlag(true);
      useDesignerStore.setState({
        generation: {
          ...DEFAULT_GENERATION_STATE,
          mesh: {
            error: null,
            vertices: new Float32Array([0, 0, 0]),
            normals: new Float32Array([0, 0, 1]),
          } as unknown as (typeof DEFAULT_GENERATION_STATE)['mesh'],
        },
      });
      const desktop = render(<DesignerHeader isDesktop nameEditor={createMockNameEditor()} />);
      expect(screen.getByLabelText('Publish to the community showcase')).not.toBeDisabled();
      desktop.unmount();
      render(<DesignerHeader isDesktop={false} nameEditor={createMockNameEditor()} />);
      expect(screen.getByLabelText('Publish to the community showcase')).not.toBeDisabled();
    });
  });
});
