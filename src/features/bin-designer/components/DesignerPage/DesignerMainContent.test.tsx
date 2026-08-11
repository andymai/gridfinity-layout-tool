import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignerMainContent } from './DesignerMainContent';

vi.mock('@/features/bin-designer/components/ParameterPanel', () => ({
  ParameterPanel: () => <div data-testid="parameter-panel">Parameter Panel</div>,
}));

vi.mock('@/features/bin-designer/components/PreviewCanvas', () => ({
  PreviewCanvas: () => <div data-testid="preview-canvas">Preview Canvas</div>,
}));

vi.mock('@/features/bin-designer/components/CutoutWorkspace', () => ({
  CutoutWorkspace: () => <div data-testid="cutout-workspace">Cutout Workspace</div>,
}));

vi.mock('@/features/bin-designer/components/BentoWorkspace', () => ({
  BentoWorkspace: () => <div data-testid="bento-workspace">Bento Workspace</div>,
}));

vi.mock('@/features/bin-designer/components/CutoutWorkspace/ResizeDivider', () => ({
  ResizeDivider: () => <div data-testid="resize-divider">Resize Divider</div>,
}));

const base = {
  isDesktop: true,
  isMobile: false,
  isLandscape: false,
  cutoutEditorOpen: false,
  bentoWorkspaceOpen: false,
};

describe('DesignerMainContent', () => {
  it('renders desktop side-by-side layout', () => {
    render(<DesignerMainContent {...base} />);
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('renders cutout workspace when cutout editor is open on desktop', () => {
    render(<DesignerMainContent {...base} cutoutEditorOpen />);
    expect(screen.getByTestId('cutout-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('resize-divider')).toBeInTheDocument();
    expect(screen.queryByTestId('parameter-panel')).not.toBeInTheDocument();
  });

  it('renders bento workspace when it is open on desktop', () => {
    render(<DesignerMainContent {...base} bentoWorkspaceOpen />);
    expect(screen.getByTestId('bento-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('resize-divider')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('parameter-panel')).not.toBeInTheDocument();
  });

  it('prefers the cutout workspace if both flags somehow stand', () => {
    // The store keeps them mutually exclusive; this pins the tie-break so a
    // regression there cannot render two workspaces into one pane.
    render(<DesignerMainContent {...base} cutoutEditorOpen bentoWorkspaceOpen />);
    expect(screen.getByTestId('cutout-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('bento-workspace')).not.toBeInTheDocument();
  });

  it('renders stacked layout on mobile portrait', () => {
    render(<DesignerMainContent {...base} isDesktop={false} isMobile />);
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('falls back to the panel when the bento workspace is open off desktop', () => {
    render(<DesignerMainContent {...base} isDesktop={false} isMobile bentoWorkspaceOpen />);
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('bento-workspace')).not.toBeInTheDocument();
  });

  it('renders landscape layout', () => {
    render(<DesignerMainContent {...base} isDesktop={false} isLandscape />);
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('shows cutout desktop-only banner on non-desktop with cutout open', () => {
    render(<DesignerMainContent {...base} isDesktop={false} cutoutEditorOpen />);
    expect(screen.getByText(/desktop/i)).toBeInTheDocument();
  });
});
