import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
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

vi.mock('@/shared/components/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

const qualifyingCutout = {
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
} as unknown as (typeof DEFAULT_BIN_PARAMS.cutouts)[number];

const readyMesh = {
  error: null,
  vertices: new Float32Array([0, 0, 0]),
  normals: new Float32Array([0, 0, 1]),
} as unknown as (typeof DEFAULT_GENERATION_STATE)['mesh'];

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

const PUBLISH_LABEL = 'Publish to the community showcase';

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
    render(<DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />);
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
  });

  it('renders design name on desktop', () => {
    render(<DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />);
    expect(screen.getByText('Test Design')).toBeInTheDocument();
  });

  it('renders undo/redo buttons', () => {
    render(<DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />);
    expect(screen.getAllByLabelText(/Undo/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Redo/).length).toBeGreaterThan(0);
  });

  it('disables undo when no history', () => {
    render(<DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />);
    screen.getAllByLabelText(/Undo/).forEach((btn) => expect(btn).toBeDisabled());
  });

  it('enables undo when history exists', () => {
    useDesignerStore.setState({
      history: {
        past: [{ params: DEFAULT_BIN_PARAMS, mesh: null }],
        future: [],
      },
    });
    render(<DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />);
    expect(screen.getAllByLabelText(/Undo/)[0]).not.toBeDisabled();
  });

  describe('below desktop', () => {
    function openMenu() {
      fireEvent.click(screen.getByRole('button', { name: 'More links' }));
    }

    it.each([
      ['tablet', false],
      ['phone', true],
    ])('opens Settings from the menu on a %s', (_width, isMobile) => {
      const handler = vi.fn();
      window.addEventListener('open-settings-modal', handler);
      render(
        <DesignerHeader isDesktop={false} isMobile={isMobile} nameEditor={createMockNameEditor()} />
      );

      openMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));

      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener('open-settings-modal', handler);
    });

    it('keeps every action in the tablet bar', () => {
      render(
        <DesignerHeader isDesktop={false} isMobile={false} nameEditor={createMockNameEditor()} />
      );
      expect(screen.getByLabelText('Open design list')).toBeInTheDocument();
      expect(screen.getByLabelText('Export bin as STL')).toBeInTheDocument();
      expect(screen.getByLabelText('Version history')).toBeInTheDocument();
      expect(screen.getByTestId('language-selector')).toBeInTheDocument();
    });

    it('leaves undo, redo and the menu in the phone bar', () => {
      render(<DesignerHeader isDesktop={false} isMobile nameEditor={createMockNameEditor()} />);
      expect(screen.getByLabelText(/Undo/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Redo/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Open design list')).toBeNull();
      expect(screen.queryByLabelText('Export bin as STL')).toBeNull();
      expect(screen.queryByLabelText(PUBLISH_LABEL)).toBeNull();
      expect(screen.queryByLabelText('Version history')).toBeNull();
      expect(screen.queryByTestId('language-selector')).toBeNull();
    });

    it('moves export, publish and version history into the phone menu', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, cutouts: [qualifyingCutout] },
        generation: { ...DEFAULT_GENERATION_STATE, mesh: readyMesh },
      });
      render(<DesignerHeader isDesktop={false} isMobile nameEditor={createMockNameEditor()} />);
      openMenu();

      fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }));
      expect(useDesignerStore.getState().ui.exportDialogOpen).toBe(true);

      openMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Version history' }));
      expect(useDesignerStore.getState().ui.versionsOpen).toBe(true);

      openMenu();
      expect(screen.getByRole('menuitem', { name: 'Publish' })).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('disables the phone menu export until the mesh is ready', () => {
      render(<DesignerHeader isDesktop={false} isMobile nameEditor={createMockNameEditor()} />);
      openMenu();
      expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('community publish entry', () => {
    it('shows a disabled Publish button next to Export until the mesh is ready', () => {
      render(<DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />);
      expect(screen.getByLabelText(PUBLISH_LABEL)).toBeDisabled();
    });

    it('enables Publish once the mesh is ready and a qualifying cutout exists, on desktop and mobile', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, cutouts: [qualifyingCutout] },
        generation: { ...DEFAULT_GENERATION_STATE, mesh: readyMesh },
      });
      const desktop = render(
        <DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />
      );
      expect(screen.getByLabelText(PUBLISH_LABEL)).not.toBeDisabled();
      desktop.unmount();
      render(
        <DesignerHeader isDesktop={false} isMobile={false} nameEditor={createMockNameEditor()} />
      );
      expect(screen.getByLabelText(PUBLISH_LABEL)).not.toBeDisabled();
    });

    it('stays enabled without a cutout so the dialog can explain the policy', () => {
      // A `title` tooltip does not exist on touch, so gating the button here
      // left phone users with a dead control and no stated reason.
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, cutouts: [] },
        generation: { ...DEFAULT_GENERATION_STATE, mesh: readyMesh },
      });
      const desktop = render(
        <DesignerHeader isDesktop isMobile={false} nameEditor={createMockNameEditor()} />
      );
      expect(screen.getByLabelText(PUBLISH_LABEL)).not.toBeDisabled();
      desktop.unmount();

      render(
        <DesignerHeader isDesktop={false} isMobile={false} nameEditor={createMockNameEditor()} />
      );
      expect(screen.getByLabelText(PUBLISH_LABEL)).not.toBeDisabled();
    });
  });
});
